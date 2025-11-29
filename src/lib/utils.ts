import type { AuditLogOptions } from "../types.js";

export function shouldSkipModel(
  modelName: string | undefined,
  options: AuditLogOptions
): boolean {
  if (!modelName) return true;

  // Skip if model is in exclude list
  if (options.excludeModels?.includes(modelName)) {
    return true;
  }

  // Skip if includeModels is specified and model is not in the list
  if (options.includeModels && !options.includeModels.includes(modelName)) {
    return true;
  }

  return false;
}

export function getChangedFields(oldObj: any, newObj: any): string[] {
  const changedFields: string[] = [];

  for (const key in newObj) {
    if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
      changedFields.push(key);
    }
  }

  return changedFields;
}

export function buildSnapshot(
  changedFields: string[],
  current: any,
  updated: any
) {
  // Build partial snapshots containing only changed fields
  const oldData = changedFields.reduce((acc: any, key: string) => {
    acc[key] = (current as any)[key];
    return acc;
  }, {} as Record<string, any>);

  const newData = changedFields.reduce((acc: any, key: string) => {
    acc[key] = (updated as any)[key];
    return acc;
  }, {} as Record<string, any>);

  return { newData, oldData };
}
