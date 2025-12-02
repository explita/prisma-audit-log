import type { AuditLog, HandlerArgs } from "../types.js";
import { saveAuditLogs } from "./process.js";

export async function handleCreate(opts: HandlerArgs) {
  const { args, prisma, query, options, modelName } = opts;

  const result = await query(args);

  const auditLog: Omit<AuditLog, "id"> = {
    action: "CREATE",
    model: modelName,
    recordId: result.id,
    newData: result,
  };

  await saveAuditLogs(prisma, [auditLog], options);

  return result;
}
