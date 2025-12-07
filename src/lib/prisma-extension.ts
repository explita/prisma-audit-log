import { Prisma } from "@prisma/client/extension";
import { shouldSkipModel } from "./utils.js";
import { handleCreate } from "../core/create.js";
import { handleCreateMany } from "../core/create-many.js";
import { handleUpdateMany } from "../core/update-many.js";
import type { AuditLogOptions } from "../types.js";
import { handleDelete } from "../core/delete.js";
import { handleDeleteMany } from "../core/delete-many.js";
import { handleUpdate } from "../core/update.js";
import { handleUpsert } from "../core/upsert.js";

/**
 * Creates a Prisma extension that adds audit logging
 */
export function auditLogExtension(options: AuditLogOptions = {}) {
  return Prisma.defineExtension((prisma) => {
    return prisma.$extends({
      name: "auditLogExtension",
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const modelName = model?.toString();

            // Never audit the audit log model itself
            if (["auditLog", "AuditLog"].includes(modelName ?? "")) {
              return query(args);
            }

            // Skip if model is excluded or not included
            if (shouldSkipModel(modelName, options)) {
              return query(args);
            }

            // Check if the operation should be skipped via the skip callback
            if (options.skip) {
              const shouldSkip = await options.skip({
                model: modelName,
                operation,
                args,
              });

              if (shouldSkip) {
                return query(args);
              }
            }

            const queryArgs = {
              args,
              prisma,
              query,
              options,
              modelName,
              operation,
            };

            // Handle different operations
            switch (operation) {
              case "create":
                return handleCreate(queryArgs);
              case "createMany":
              case "createManyAndReturn":
                return handleCreateMany(queryArgs);

              case "delete":
                return handleDelete(queryArgs);
              case "deleteMany":
                return handleDeleteMany(queryArgs);

              case "update":
                return handleUpdate(queryArgs);
              case "updateMany":
              case "updateManyAndReturn":
                return handleUpdateMany(queryArgs);
              case "upsert":
                return handleUpsert(queryArgs);
              default:
                return query(args);
            }
          },
        },
      },
    });
  });
}
