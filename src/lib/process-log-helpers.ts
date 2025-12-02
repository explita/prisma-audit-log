import type {
  AuditLog,
  AuditLogOptions,
  FilterFieldsResult,
  ModelFieldFilters,
} from "../types.js";

function matchesMaskPath(
  maskPaths: string[] | undefined,
  keyPath: string[]
): boolean {
  if (!maskPaths || keyPath.length === 0) return false;
  return maskPaths.some((path) => {
    const segments = path.split(".");
    if (segments.length !== keyPath.length) return false;
    return segments.every(
      (segment, index) => segment === "*" || segment === keyPath[index]
    );
  });
}

function maskAndTruncate(
  value: any,
  opts: AuditLogOptions,
  keyPath: string[] = []
): any {
  const {
    maskFields,
    maskPaths,
    maskValue = "[REDACTED]",
    maxStringLength,
    maxArrayLength,
  } = opts;

  const currentKey = keyPath[keyPath.length - 1];
  const shouldMaskField = currentKey && maskFields?.includes(currentKey);
  const shouldMaskPath = matchesMaskPath(maskPaths, keyPath);

  if (shouldMaskField || shouldMaskPath) {
    return maskValue;
  }

  if (value == null) return value;

  if (value instanceof Date) {
    const iso = value.toISOString();
    if (maxStringLength && iso.length > maxStringLength) {
      return iso.slice(0, maxStringLength) + "…";
    }
    return iso;
  }

  if (typeof value === "string") {
    if (maxStringLength && value.length > maxStringLength) {
      return value.slice(0, maxStringLength) + "…";
    }
    return value;
  }

  if (Array.isArray(value)) {
    const limited = maxArrayLength ? value.slice(0, maxArrayLength) : value;
    return limited.map((v, i) =>
      maskAndTruncate(v, opts, [...keyPath, String(i)])
    );
  }

  // Handle Decimal type from Prisma
  if (
    value &&
    typeof value === "object" &&
    "constructor" in value &&
    ["Decimal", "Decimal2"].includes(value.constructor.name)
  ) {
    return value.toString();
  }

  if (typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = maskAndTruncate(v, opts, [...keyPath, k]);
    }
    return out;
  }

  return value;
}

function enforcePayloadLimit(value: any, opts: AuditLogOptions) {
  const { maxPayloadBytes } = opts;
  if (!maxPayloadBytes || value == null) return value;

  try {
    const json = JSON.stringify(value);
    if (json.length <= maxPayloadBytes) return value;
    return {
      truncated: true,
      originalSize: json.length,
      preview: json.slice(0, maxPayloadBytes),
    };
  } catch {
    return {
      truncated: true,
      reason: "serialization_failed",
    };
  }
}

export async function buildFinalLog(
  auditLog: Omit<AuditLog, "id">,
  options: AuditLogOptions
): Promise<Omit<AuditLog, "id">> {
  const finalLog: Omit<AuditLog, "id"> = {
    ...auditLog,
  };

  // Apply field filtering if configured
  if (options.fieldFilters) {
    if (finalLog.oldData) {
      const { filteredData } = filterFields(
        finalLog.oldData,
        auditLog.model,
        options.fieldFilters
      );
      finalLog.oldData = filteredData;
    }
    if (finalLog.newData) {
      const { filteredData, filteredChangedFields } = filterFields(
        finalLog.newData,
        auditLog.model,
        options.fieldFilters,
        finalLog.changedFields
      );
      finalLog.newData = filteredData;
      if (filteredChangedFields) {
        finalLog.changedFields = filteredChangedFields;
      }
    }
  }

  // Merge extra context
  if (options.getContext) {
    const context = await options.getContext();
    if (context && typeof context === "object") {
      Object.assign(finalLog, context);
    }
  }

  // Apply masking/truncation to payload sections
  if (finalLog.oldData) {
    finalLog.oldData = enforcePayloadLimit(
      maskAndTruncate(finalLog.oldData, options),
      options
    );
  }
  if (finalLog.newData) {
    finalLog.newData = enforcePayloadLimit(
      maskAndTruncate(finalLog.newData, options),
      options
    );
  }
  if (finalLog.metadata) {
    finalLog.metadata = enforcePayloadLimit(
      maskAndTruncate(finalLog.metadata, options),
      options
    );
  }

  return finalLog;
}

/**
 * Filter object fields based on include/exclude rules
 * @returns An object containing the filtered data and changedFields
 */
export function filterFields<T extends Record<string, any>>(
  data: T | undefined,
  model: string,
  fieldFilters?: ModelFieldFilters,
  changedFields?: string[]
): FilterFieldsResult<T> {
  if (!data)
    return { filteredData: data, filteredChangedFields: changedFields };

  const modelFilters = fieldFilters?.[model];
  if (!modelFilters)
    return { filteredData: data, filteredChangedFields: changedFields };

  // Handle both include and exclude being optional
  const include = "include" in modelFilters ? modelFilters.include : undefined;
  const exclude = "exclude" in modelFilters ? modelFilters.exclude : undefined;

  let filteredChangedFields = changedFields;

  // If include is specified, only include those fields
  if (include?.length) {
    const includeSet = new Set(include);
    const result = include.reduce((result, field) => {
      if (field in data) {
        result[field] = data[field];
      }
      return result;
    }, {} as Record<string, any>) as T;

    if (changedFields) {
      filteredChangedFields = changedFields.filter((field) =>
        includeSet.has(field)
      );
    }

    return { filteredData: result, filteredChangedFields };
  }

  // If exclude is specified, exclude those fields
  if (exclude?.length) {
    const excludeSet = new Set(exclude);
    const result = Object.entries(data).reduce((result, [key, value]) => {
      if (!excludeSet.has(key)) {
        result[key] = value;
      }
      return result;
    }, {} as Record<string, any>) as T;

    if (changedFields) {
      filteredChangedFields = changedFields.filter(
        (field) => !excludeSet.has(field)
      );
    }

    return { filteredData: result, filteredChangedFields };
  }

  return {
    filteredData: data,
    filteredChangedFields: changedFields,
  };
}
