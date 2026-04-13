import type { ToonRecord, ToonValue } from './types.js';
import { inferSchema } from './schema.js';

export interface SerializeOptions {
  name?: string;
  includeCount?: boolean;
}

export function serialize(records: ToonRecord[], options: SerializeOptions = {}): string {
  if (records.length === 0) return '';

  const name = options.name ?? 'data';
  const { fields, count } = inferSchema(records, name);

  // Build header: name[count]{field1,field2,...}:
  const countStr = options.includeCount !== false ? `[${count}]` : '';
  const fieldStr = fields.map(f => f.name).join(',');
  const header = `${name}${countStr}{${fieldStr}}:`;

  // Build rows
  const rows = records.map(record =>
    fields.map(f => formatValue(record[f.name] ?? null)).join(',')
  );

  return [header, ...rows].join('\n');
}

function formatValue(value: ToonValue): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return String(value);

  // String: only quote if contains comma, newline, or leading/trailing whitespace
  const str = String(value);
  if (str.includes(',') || str.includes('\n') || str !== str.trim()) {
    return `"${str.replace(/"/g, '\\"')}"`;
  }
  return str;
}
