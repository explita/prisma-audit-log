import type { AuditLog, HandlerArgs } from "../types.js";
import { saveAuditLogs } from "./process.js";

export async function handleDeleteMany(opts: HandlerArgs) {
  const { args, prisma, query, options, modelName } = opts;

  // Get the current state of records that will be deleted
  const currentRecords = await (prisma[modelName] as any).findMany({
    where: args["where"],
  });

  // Guard: if no records match, skip logging
  if (!currentRecords.length) {
    return query(args);
  }

  const result = await query(args);

  // Create audit logs for each deleted record
  const logs: Omit<AuditLog, "id">[] = currentRecords.map((record: any) => ({
    action: "DELETE",
    model: modelName,
    recordId: record.id,
    oldData: record,
  }));

  await saveAuditLogs(prisma, logs, options);

  return result;
}
