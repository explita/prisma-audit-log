import type { JsArgs } from "@prisma/client/runtime/client";

export interface AuditLogOptions {
  /**
   * Function to determine if audit logging should be skipped for the current operation
   * @returns true to skip logging, false or undefined to continue with logging
   */
  skip?: (params: {
    model: string;
    operation: string;
    args: any;
  }) => boolean | Promise<boolean>;

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
   * Configure field inclusion/exclusion per model
   * @example
   * {
   *   User: { exclude: ['password', 'tokens'] },
   *   Payment: { include: ['id', 'amount', 'status'] }
   * }
   */
  fieldFilters?: ModelFieldFilters;

  /**
   * Function to get extra context for the audit trail (e.g., userId, companyId, branchId, metadata, ...)
   * Return any additional fields your AuditLog model supports. They will be merged into the final log.
   */
  getContext?: () => AuditContext | Promise<AuditContext | undefined>;

  /**
   * Custom logger function
   * If not provided, logs will be written to console
   */
  logger?: (log: AuditLog | AuditLog[]) => void | Promise<void>;

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
}

export interface AuditLog {
  id: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "CREATE_upsert" | "UPDATE_upsert";
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
  operation: string;
  existingRecord?: any;
};

export type FieldFilterConfig = {
  include?: string[];
  exclude?: string[];
};

export type ModelFieldFilters = {
  [model: string]: FieldFilterConfig;
};

export interface FilterFieldsResult<T> {
  filteredData: T | undefined;
  filteredChangedFields?: string[];
}
