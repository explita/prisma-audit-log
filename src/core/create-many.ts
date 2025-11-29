import type { AuditLog, HandlerArgs } from "../types.js";
import { saveAuditLogs } from "./process.js";

/**
 * Handle createMany and createManyAndReturn operations
 * - createManyAndReturn: logs each created record using the returned rows
 * - createMany: logs best-effort using the input data (uses provided id if present)
 */
export async function handleCreateMany(opts: HandlerArgs) {
  const { args, prisma, query, options, modelName, operation } = opts;

  if (operation === "createManyAndReturn") {
    const created = await query(args);
    const rows: any[] = Array.isArray(created) ? created : [created];

    // Build logs
    const logs: Omit<AuditLog, "id">[] = rows.map((row) => ({
      action: "CREATE",
      model: modelName,
      recordId: String(row.id ?? "unknown"),
      newData: row,
    }));

    await saveAuditLogs(prisma, logs, options);

    return created;
  }

  // Fallback for createMany (does not return created records)
  const rawData = (args as any)?.data;
  const dataArray: any[] = Array.isArray(rawData)
    ? rawData
    : rawData
    ? [rawData]
    : [];

  // Guard: skip logging when data is empty or missing
  if (!dataArray.length) {
    return query(args);
  }

  const result = await query(args);

  const logs: Omit<AuditLog, "id">[] = dataArray.map((item) => ({
    action: "CREATE",
    model: modelName,
    recordId: String(item?.id ?? "unknown"),
    newData: item,
  }));

  await saveAuditLogs(prisma, logs, options);

  return result;
}
