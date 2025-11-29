import type { JsArgs } from "@prisma/client/runtime/client";

export interface AuditLogOptions {
  /**
   * Tables to include in audit logging
   * If not provided, all tables will be included
   */
  includeModels?: string[];

  /**
   * Tables to exclude from audit logging
   * Takes precedence over includeModels
   */
  excludeModels?: string[];

  /**
   * Function to get extra context for the audit trail (e.g., userId, companyId, branchId, metadata, ...)
   * Return any additional fields your AuditLog model supports. They will be merged into the final log.
   */
  getContext?: () => AuditContext | Promise<AuditContext | undefined>;

  /**
   * Custom logger function
   * If not provided, logs will be written to console
   */
  logger?: (log: AuditLog) => void | Promise<void>;

  /**
   * Keys to mask in oldData/newData/metadata. Exact match on property name.
   */
  maskFields?: string[];
  /**
   * Dot-delimited paths to mask (e.g., "payment.card.number"). Supports '*' wildcard per segment.
   */
  maskPaths?: string[];
  /** Value used to replace masked fields (default: "[REDACTED]") */
  maskValue?: any;
  /** Truncate long string values to this length (default: no limit) */
  maxStringLength?: number;
  /** Truncate arrays to this length (default: no limit) */
  maxArrayLength?: number;
  /** Maximum JSON payload size per field (old/new/metadata). Entries exceeding this will be replaced with a truncated preview */
  maxPayloadBytes?: number;
  /** Whether to use createMany for bulk inserts when available (default: true) */
  batchInsert?: boolean;
}

export interface AuditLog {
  id: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  model: string;
  recordId: string;
  oldData?: Record<string, any>;
  newData?: Record<string, any>;
  changedFields?: string[];
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

/**
 * Arbitrary context that can be merged into the audit log.
 * Include any additional fields your schema supports (e.g., companyId, branchId, tenantId, etc.)
 */
export interface AuditContext {
  userId?: string;
  metadata?: Record<string, any>;
  [key: string]: any;
}

export type HandlerArgs = {
  prisma: any;
  modelName: string;
  args: JsArgs;
  query: (args: JsArgs) => Promise<any>;
  options: AuditLogOptions;
  operation?: string;
};
