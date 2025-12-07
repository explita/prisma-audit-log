import { buildSnapshot, getChangedFields } from "../lib/utils.js";
import type { AuditLog, HandlerArgs } from "../types.js";
import { saveAuditLogs } from "./process.js";

export async function handleUpdate(
  opts: HandlerArgs,
  action: AuditLog["action"] = "UPDATE"
) {
  const { args, prisma, query, options, modelName, existingRecord } = opts;

  // Use provided existingRecord or fetch it if not provided
  const current =
    existingRecord ||
    (await (prisma[modelName] as any).findUnique({
      where: args["where"],
    }));

  if (!current) {
    return query(args);
  }

  const result = await query(args);
  const changedFields = getChangedFields(current, result);

  if (changedFields.length === 0) return result;

  // Skip if only timestamps were updated
  if (
    changedFields.length === 1 &&
    (changedFields[0] === "updatedAt" || changedFields[0] === "updated_at")
  ) {
    return result;
  }

  const { oldData, newData } = buildSnapshot(changedFields, current, result);

  const auditLog: Omit<AuditLog, "id"> = {
    action,
    model: modelName,
    recordId: result.id,
    oldData,
    newData,
    changedFields,
  };

  await saveAuditLogs(prisma, [auditLog], options);
  return result;
}
