import { buildFinalLog } from "../lib/process-log-helpers.js";
import {
  bufferTransactionLogs,
  hookEngineTransactions,
} from "../lib/transaction-logger.js";
import type { AuditLog, AuditLogOptions } from "../types.js";

export async function saveAuditLogs(
  prisma: any,
  logs: Omit<AuditLog, "id">[],
  options: AuditLogOptions,
  internalParams?: any
) {
  if (!logs.length) return;

  try {
    const finals = await Promise.all(
      logs.map((log) => buildFinalLog(log, options))
    );

    if (!finals.length) return;

    if (prisma.auditLog?.createMany) {
      await prisma.auditLog.createMany({ data: finals });
    } else if (prisma.auditLog?.create) {
      // Fall back to individual inserts if createMany is not available
      for (const finalLog of finals) {
        await prisma.auditLog.create({
          data: finalLog,
        });
      }
    }

    if (options.logger && finals.length) {
      const internalTx = internalParams?.transaction;
      const isAuditedInTx =
        Boolean(options.getClient) || options.autoDetectTransaction !== false;
      const isItx =
        options.deferLoggerUntilCommit !== false &&
        isAuditedInTx &&
        internalTx?.kind === "itx" &&
        Boolean(internalTx.id);

      if (isItx) {
        hookEngineTransactions(prisma);
        bufferTransactionLogs(
          internalTx.id,
          finals as AuditLog[],
          options.logger
        );
      } else {
        await options.logger(finals as AuditLog[]);
      }
    }
  } catch (error) {
    console.error("Failed to save audit log to database:", error);
    if (options.propagateErrors) {
      throw error;
    }
  }
}
