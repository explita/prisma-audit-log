# Prisma Audit Log

A Prisma extension for automatic audit logging of database operations.

## Features

- ✅ Automatic logging of create, update, and delete operations
- ✅ Efficient batch processing of logs with automatic fallback to single inserts
- ✅ Support for both single and batch operations
- ✅ Tracks changed fields for updates
- ✅ Context-aware logging with user and request information
- ✅ Customizable field masking and data sanitization
- ✅ Field-level filtering to include/exclude specific fields from logs
- ✅ Ignores updates where only `updatedAt`/`updated_at` changed (noise-free logs)
- ✅ Skip logging for specific operations using a callback function
- ✅ Proper handling of Decimal and other special types
- ✅ Ignores logging of AuditLog model
- ✅ TypeScript support

## Installation

```bash
npm install @explita/prisma-audit-log
# or
yarn add @explita/prisma-audit-log
# or
pnpm add @explita/prisma-audit-log
```

#

### Basic Setup

```typescript
import { PrismaClient } from "@prisma/client";
import { auditLogExtension } from "@explita/prisma-audit-log";
import { getContext } from "..."; // or your auth context

const prisma = new PrismaClient().$extends(
  auditLogExtension({
    // Optional: Only include specific models
    // includeModels: ['User', 'Post'],

    // Optional: Exclude specific models
    // excludeModels: ['SensitiveData'],

    // Get context for audit logs.
    // The values returned here will be merged with operation context.
    // Make sure whatever returned matches your audit log schema.
    getContext: () => {
      const { auth, req } = getContext();
      return {
        userId: auth.id,
        companyId: auth.companyId,
        ipAddress: req.ip,
        metadata: {
          ip: req.ip,
          browser: req.headers["user-agent"],
        },
      };
    },

    // Optional: Mask sensitive fields
    maskFields: ["password", "token"],
    maskValue: "[REDACTED]", // default value

    // Optional: Configure field inclusion/exclusion per model
    fieldFilters: {
      // Exclude sensitive fields from User model
      User: {
        exclude: ["password", "tokens", "refreshToken"],
      },
      // Only include specific fields for Payment model
      Payment: {
        include: ["id", "amount", "status", "createdAt"],
      },
    },

    // Optional: Truncate long values
    maxStringLength: 1000,
    maxArrayLength: 50,

    // Optional: Custom logger
    logger: (log) => {
      // Send logs to your logging service
      console.log("AUDIT:", log);
      // log can be an array of AuditLog objects
    },

    // Skip logging for specific operations
    skip: ({ model, operation, args }) => {
      // Skip logging for specific models or operations
      if (model === "Session" && operation === "create") return true;

      // Skip logging for specific conditions
      if (model === "User" && args?.data?.isSystemUpdate) return true;

      // Skip logging for specific operations on specific models
      if (model === "AuditLog" || model === "audit_logs") return true;

      return false;
    },

    // Timestamp-only updates are skipped automatically, so no extra config needed
  })
);
```

#

### Database Schema

Add this to your Prisma schema:

```prisma
model AuditLog {
  id            String   @id @default(cuid())
  userId        String?  @map("user_id")
  recordId      String   @map("record_id")
  action        String
  model         String
  oldData       Json?    @map("old_data")
  newData       Json?    @map("new_data")
  changedFields String[] @map("changed_fields")
  ipAddress     String?  @map("ip_address")
  userAgent     String?  @map("user_agent")
  metadata      Json?
  createdAt     DateTime @default(now()) @map("created_at")

  @@map("audit_logs")
}
```

#

### Example Usage

```typescript
// Example Fastify route
route.put("/test/:id", async (request, reply) => {
  // These operations will be automatically logged
  await db.branch.update({
    where: { id: "123" },
    data: { address: "123 Main St" },
  });

  await db.branch.updateMany({
    where: { phone: "0123456789" },
    data: { phone: "1023456789" },
  });

  reply.send("Operations completed");
});
```

## Configuration Options

| Option            | Type                                                                                       | Description                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `includeModels`   | `string[]`                                                                                 | Only log operations on these models                                                                              |
| `excludeModels`   | `string[]`                                                                                 | Exclude these models from logging                                                                                |
| `getContext`      | `() => AuditContext`                                                                       | Function to get current context (user, IP, etc.)                                                                 |
| `maskFields`      | `string[]`                                                                                 | Fields to mask in logs                                                                                           |
| `maskValue`       | `any`                                                                                      | Value to use for masked fields (default: `[REDACTED]`)                                                           |
| `maxStringLength` | `number`                                                                                   | Truncate long strings                                                                                            |
| `maxArrayLength`  | `number`                                                                                   | Truncate large arrays                                                                                            |
| `maxPayloadBytes` | `number`                                                                                   | Maximum JSON payload size (before truncation)                                                                    |
| `fieldFilters`    | `{ [model: string]: { include?: string[]; exclude?: string[] } }`                          | Configure field inclusion/exclusion per model. Use `include` to whitelist fields or `exclude` to blacklist them. |
| `skip`            | `(params: { model: string; operation: string; args: any }) => boolean \| Promise<boolean>` | Skip logging for specific operations                                                                             |
| `logger`          | `(log: AuditLog \| AuditLog[]) => void`                                                    | Custom logger function for audit logs                                                                            |

## License

MIT

---

Built with ❤️ by [Explita](https://explita.ng)
