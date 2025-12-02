import { buildFinalLog } from "../lib/process-log-helpers.js";
import type { AuditLog, AuditLogOptions } from "../types.js";

export async function saveAuditLogs(
  prisma: any,
  logs: Omit<AuditLog, "id">[],
  options: AuditLogOptions
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
      await options.logger(finals as AuditLog[]);
    }
  } catch (error) {
    console.error("Failed to save audit log to database:", error);
  }
}
