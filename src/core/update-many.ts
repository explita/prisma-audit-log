import { buildSnapshot, getChangedFields } from "../lib/utils.js";
import type { AuditLog, HandlerArgs } from "../types.js";
import { saveAuditLogs } from "./process.js";

export async function handleUpdateMany(opts: HandlerArgs) {
  const { args, prisma, query, options, modelName, operation } = opts;

  // Get the current state of records that will be updated
  const currentRecords = await (prisma[modelName] as any).findMany({
    where: args["where"],
  });

  // Guard: if no records will be updated, skip logging
  if (!currentRecords.length) {
    return query(args);
  }

  const ids = currentRecords.map((row: any) => row.id);

  const result = await query(args);

  //updated records
  const updatedRecords =
    operation == "createManyAndReturn"
      ? result
      : await prisma[modelName].findMany({
          where: { id: { in: ids } },
        });

  const logs: Omit<AuditLog, "id">[] = [];

  // Create audit logs for each updated record
  for (const current of currentRecords) {
    const updated = updatedRecords.find((r: any) => r.id === current.id);
    if (!updated) continue;

    const changedFields = getChangedFields(current, updated);

    if (
      changedFields.length === 1 &&
      (changedFields[0] === "updatedAt" || changedFields[0] === "updated_at")
    ) {
      continue;
    }

    const { oldData, newData } = buildSnapshot(changedFields, current, updated);

    logs.push({
      action: "UPDATE",
      model: modelName,
      recordId: current.id,
      oldData,
      newData,
      changedFields,
    });
  }

  await saveAuditLogs(prisma, logs, options);

  return result;
}
