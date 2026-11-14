# Prisma Audit Log

A Prisma extension for automatic audit logging of database operations.

Supports Prisma 6 and Prisma 7.

## Features

- ✅ Automatic logging of create, update, and delete operations
- ✅ Interactive transaction support: logs commit and roll back alongside business writes
- ✅ Commit-deferred logger: external loggers only receive records when transactions successfully commit
- ✅ Dynamic client resolution (`getClient`) for `AsyncLocalStorage` and custom transaction stores
- ✅ Optional error propagation (`propagateErrors`) to ensure data and audit records succeed together
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
  }),
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

#

### Interactive Transactions (`$transaction`)

Audit logs automatically participate in Prisma interactive transactions. If a transaction rolls back, all audit records, pre-read checks, and external logger calls roll back as well:

```typescript
await prisma.$transaction(async (tx) => {
  // Audit log is created inside the transaction
  await tx.user.create({
    data: { name: "Alice", email: "alice@example.com" },
  });

  // If this throws:
  // 1. The user record is rolled back
  // 2. The database audit log is rolled back
  // 3. The custom `logger` callback is NOT called!
  throw new Error("Business operation failed");
});
```

By default (`deferLoggerUntilCommit: true`), any custom `logger` callback is buffered and only fires after the transaction successfully commits. If the transaction rolls back, the buffered logs are safely discarded.

#### Using `AsyncLocalStorage` (`getClient`)

If your application manages transactions via `AsyncLocalStorage` (e.g. in NestJS or custom transaction middleware), you can provide `getClient` to explicitly resolve the active transaction client:

```typescript
import { AsyncLocalStorage } from "node:async_hooks";
import { Prisma } from "@prisma/client";

export const txStorage = new AsyncLocalStorage<Prisma.TransactionClient>();

const prisma = new PrismaClient().$extends(
  auditLogExtension({
    getClient: () => txStorage.getStore(),
    propagateErrors: true, // Roll back transaction if audit persistence fails
  }),
);

// In your transaction helper:
export async function runInTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction((tx) => {
    return txStorage.run(tx, () => fn(tx));
  });
}
```

## Configuration Options

| Option                  | Type                                                                                       | Description                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `includeModels`         | `string[]`                                                                                 | Only log operations on these models                                                                              |
| `excludeModels`         | `string[]`                                                                                 | Exclude these models from logging                                                                                |
| `getContext`            | `() => AuditContext`                                                                       | Function to get current context (user, IP, etc.)                                                                 |
| `getClient`             | `(params: { model: string; operation: string; args: any }) => any`                        | Function to resolve active Prisma client (e.g., from `AsyncLocalStorage`)                                        |
| `autoDetectTransaction` | `boolean`                                                                                  | Automatically detect interactive transactions and bind audit logs (default: `true`)                              |
| `deferLoggerUntilCommit`| `boolean`                                                                                  | Defer custom logger execution until interactive transactions commit; discards logs on rollback (default: `true`)  |
| `propagateErrors`       | `boolean`                                                                                  | Rethrow audit errors to abort/rollback surrounding transactions if audit saving fails (default: `false`)         |
| `maskFields`            | `string[]`                                                                                 | Fields to mask in logs                                                                                           |
| `maskValue`             | `any`                                                                                      | Value to use for masked fields (default: `[REDACTED]`)                                                           |
| `maxStringLength`       | `number`                                                                                   | Truncate long strings                                                                                            |
| `maxArrayLength`        | `number`                                                                                   | Truncate large arrays                                                                                            |
| `enabled`               | `boolean`                                                                                  | Enable or disable audit logging (defaults to `true`)                                                             |
| `maxPayloadBytes`       | `number`                                                                                   | Maximum JSON payload size (before truncation)                                                                    |
| `fieldFilters`          | `{ [model: string]: { include?: string[]; exclude?: string[] } }`                          | Configure field inclusion/exclusion per model. Use `include` to whitelist fields or `exclude` to blacklist them. |
| `skip`                  | `(params: { model: string; operation: string; args: any }) => boolean \| Promise<boolean>` | Skip logging for specific operations                                                                             |
| `logger`                | `(log: AuditLog[]) => void \| Promise<void>`                                               | Custom logger function for audit logs                                                                            |

#

## 💖 Support the Mission

Prisma Audit Log is built to provide effortless database transparency and accountability. If it has helped you track critical changes and prevent bugs, please consider supporting the project to ensure its continued growth and maintenance!

<p align="left">
  <a href="https://github.com/sponsors/explita">
    <img src="https://img.shields.io/badge/Sponsor_on_GitHub-EA4AAA?style=for-the-badge&logo=github-sponsors&logoColor=white" />
  </a>
  <a href="https://ko-fi.com/explita">
    <img src="https://img.shields.io/badge/Buy_Me_A_Coffee-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white" />
  </a>
</p>

### 🚀 Ways to Contribute

- **Give us a ⭐**: It helps others discover the project.
- **Join the Discussion**: Report [bugs](https://github.com/explita/prisma-audit-log/issues) or suggest new [features](https://github.com/explita/prisma-audit-log/discussions).
- **Spread the Word**: Share your experience with Prisma Audit Log on social media.

### 🙏 Our Amazing Supporters

_A huge thank you to everyone helping us build the future of database transparency!_

[![Contributors](https://contrib.rocks/image?repo=explita/prisma-audit-log)](https://github.com/explita/prisma-audit-log/graphs/contributors)

#

## License

MIT © [Explita](https://github.com/explita)
