import { buildSnapshot, getChangedFields } from "../lib/utils.js";
import type { AuditLog, HandlerArgs } from "../types.js";
import { saveAuditLogs } from "./process.js";

export async function handleUpdate(opts: HandlerArgs) {
  const { args, prisma, query, options, modelName } = opts;

  // Get the current state before update
  const current = await (prisma[modelName] as any).findUnique({
    where: args["where"],
  });

  const result = await query(args);

  if (current) {
    const changedFields = getChangedFields(current, result);

    if (
      changedFields.length === 1 &&
      (changedFields[0] === "updatedAt" || changedFields[0] === "updated_at")
    ) {
      return result;
    }

    const { oldData, newData } = buildSnapshot(changedFields, current, result);

    const auditLog: Omit<AuditLog, "id"> = {
      action: "UPDATE",
      model: modelName,
      recordId: result.id,
      oldData,
      newData,
      changedFields,
    };

    await saveAuditLogs(prisma, [auditLog], options);
  }

  return result;
}
