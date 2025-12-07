import type { HandlerArgs } from "../types.js";
import { handleCreate } from "./create.js";
import { handleUpdate } from "./update.js";

export async function handleUpsert(opts: HandlerArgs) {
  const { args, prisma, modelName } = opts;

  // Check if the record exists before performing the upsert
  const existingRecord = await (prisma[modelName] as any).findUnique({
    where: args["where"],
  });

  if (existingRecord) {
    // Handle update case with the existing record to avoid extra query
    // Pass a custom action to handleUpdate to indicate this is from an upsert
    return await handleUpdate(
      {
        ...opts,
        existingRecord,
      },
      "UPDATE_upsert"
    );
  } else {
    // Handle create case with custom action
    return await handleCreate(
      {
        ...opts,
      },
      "CREATE_upsert"
    );
  }
}
