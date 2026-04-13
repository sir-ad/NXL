import type { ToonField, ToonRecord, ToonValue } from './types.js';

export function inferType(value: ToonValue): ToonField['type'] {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  return 'string';
}

export function inferSchema(records: ToonRecord[], name: string): { fields: ToonField[]; count: number } {
  if (records.length === 0) return { fields: [], count: 0 };

  const fieldNames = Object.keys(records[0]);
  const fields: ToonField[] = fieldNames.map(fieldName => {
    const types = new Set<ToonField['type']>();
    for (const record of records) {
      types.add(inferType(record[fieldName] ?? null));
    }
    // If all same type, use it; otherwise omit type hint
    const type = types.size === 1 ? [...types][0] : undefined;
    return { name: fieldName, type };
  });

  return { fields, count: records.length };
}

export function coerceValue(raw: string, hint?: ToonField['type']): ToonValue {
  const trimmed = raw.trim();

  if (trimmed === '' || trimmed === 'null') return null;

  if (hint === 'boolean' || trimmed === 'true' || trimmed === 'false') {
    return trimmed === 'true';
  }

  if (hint === 'number') {
    const num = Number(trimmed);
    return Number.isNaN(num) ? trimmed : num;
  }

  // Auto-detect numbers when no hint
  if (hint === undefined || hint === 'string') {
    const num = Number(trimmed);
    if (!Number.isNaN(num) && trimmed !== '') {
      return num;
    }
  }

  return trimmed;
}
