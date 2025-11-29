import type { AuditLog, AuditLogOptions } from "../types.js";

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
