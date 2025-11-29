import type { AuditLog, HandlerArgs } from "../types.js";
import { processAuditLog } from "./process.js";

export async function handleDelete(opts: HandlerArgs) {
  const { args, prisma, query, options, modelName } = opts;

  // Get the current state before delete
  const current = await (prisma[modelName] as any).findUnique({
    where: args["where"],
  });

  const result = await query(args);

  if (current) {
    const auditLog: Omit<AuditLog, "id"> = {
      action: "DELETE",
      model: modelName,
      recordId: current.id,
      oldData: current,
    };

    await processAuditLog(prisma, auditLog, options);
  }

  return result;
}
