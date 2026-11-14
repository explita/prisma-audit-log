import type { AuditLog } from "../types.js";

interface PendingTransactionLog {
  logs: AuditLog[];
  logger: (logs: AuditLog[]) => void | Promise<void>;
  timestamp: number;
}

const pendingTransactionLogs = new Map<string, PendingTransactionLog>();

/**
 * Buffers audit logs for an active interactive transaction until commit.
 */
export function bufferTransactionLogs(
  txId: string,
  logs: AuditLog[],
  logger: (logs: AuditLog[]) => void | Promise<void>
) {
  const now = Date.now();

  // Purge any stale entries older than 60 seconds (transactions that timed out or leaked)
  for (const [id, entry] of pendingTransactionLogs.entries()) {
    if (now - entry.timestamp > 60_000) {
      pendingTransactionLogs.delete(id);
    }
  }

  const existing = pendingTransactionLogs.get(txId);
  if (existing) {
    existing.logs.push(...logs);
  } else {
    pendingTransactionLogs.set(txId, {
      logs: [...logs],
      logger,
      timestamp: now,
    });
  }
}

/**
 * Flushes buffered audit logs to the logger callback upon successful transaction commit.
 */
export function flushTransactionLogs(txId: string) {
  const entry = pendingTransactionLogs.get(txId);
  if (!entry) return;
  pendingTransactionLogs.delete(txId);

  if (entry.logs.length && entry.logger) {
    try {
      const result = entry.logger(entry.logs);
      if (result && typeof (result as any).catch === "function") {
        (result as any).catch((err: unknown) => {
          console.error("Failed to execute audit logger after commit:", err);
        });
      }
    } catch (err) {
      console.error("Failed to execute audit logger after commit:", err);
    }
  }
}

/**
 * Discards buffered audit logs when an interactive transaction rolls back.
 */
export function discardTransactionLogs(txId: string) {
  pendingTransactionLogs.delete(txId);
}

function getEngine(client: any) {
  let curr = client;
  while (curr) {
    if (curr._engine && typeof curr._engine.transaction === "function") {
      return curr._engine;
    }
    curr = curr._appliedParent ?? curr._client;
  }
  return client?._engine;
}

/**
 * Hooks into Prisma's internal query engine to detect transaction commit and rollback events.
 */
export function hookEngineTransactions(client: any) {
  const engine = getEngine(client);
  if (!engine || typeof engine.transaction !== "function") {
    return;
  }

  // Prevent multiple hook installations on the same engine
  if (engine.__auditLogHookInstalled) {
    return;
  }
  engine.__auditLogHookInstalled = true;

  const originalTransaction = engine.transaction.bind(engine);

  engine.transaction = async function (
    action: string,
    headers: any,
    info: any,
    ...more: any[]
  ) {
    const txId = info?.id;
    try {
      const result = await originalTransaction(action, headers, info, ...more);
      if (action === "commit" && txId) {
        flushTransactionLogs(txId);
      }
      return result;
    } catch (error) {
      if (action === "commit" && txId) {
        discardTransactionLogs(txId);
      }
      throw error;
    } finally {
      if (action === "rollback" && txId) {
        discardTransactionLogs(txId);
      }
    }
  };
}
