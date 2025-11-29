import { buildFinalLog } from "../lib/process-log-helpers.js";
import type { AuditLog, AuditLogOptions } from "../types.js";

export async function processAuditLog(
  prisma: any,
  auditLog: Omit<AuditLog, "id">,
  options: AuditLogOptions
) {
  const finalLog = await buildFinalLog(auditLog, options);

  // Use custom logger if provided, otherwise log to console
  if (options.logger) {
    await options.logger(finalLog as AuditLog);
  }
  //  else {
  //   console.log("[AUDIT LOG]", finalLog);
  // }

  // Try to save to database if AuditLog model exists
  try {
    if (prisma.auditLog) {
      await prisma.auditLog.create({
        data: finalLog,
      });
    }
  } catch (error) {
    console.error("Failed to save audit log to database:", error);
  }
}

export async function saveAuditLogs(
  prisma: any,
  logs: Omit<AuditLog, "id">[],
  options: AuditLogOptions
) {
  if (!logs.length) return;

  if (options.batchInsert && prisma.auditLog?.createMany) {
    const finals = await Promise.all(
      logs.map((log) => buildFinalLog(log, options))
    );
    if (finals.length) {
      await prisma.auditLog.createMany({ data: finals });
      if (options.logger) {
        for (const entry of finals) {
          await options.logger(entry as AuditLog);
        }
      }
    }
    return;
  }

  for (const log of logs) {
    await processAuditLog(prisma, log, options);
  }
}
