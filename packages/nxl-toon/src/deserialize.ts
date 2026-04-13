import type { ToonField, ToonRecord, ToonSchema } from './types.js';
import { coerceValue } from './schema.js';

export function deserialize(input: string): { schema: ToonSchema; records: ToonRecord[] } {
  const lines = input.split('\n').filter(l => l.trim() !== '');
  if (lines.length === 0) return { schema: { name: '', count: null, fields: [] }, records: [] };

  const schema = parseHeader(lines[0]);
  const records: ToonRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const record: ToonRecord = {};
    for (let j = 0; j < schema.fields.length && j < values.length; j++) {
      record[schema.fields[j].name] = coerceValue(values[j], schema.fields[j].type);
    }
    records.push(record);
  }

  return { schema, records };
}

function parseHeader(line: string): ToonSchema {
  // Format: name[count]{field1,field2,...}:
  const headerMatch = line.match(/^(\w[\w-]*)(?:\[(\d+)\])?\{([^}]+)\}:$/);
  if (!headerMatch) {
    throw new Error(`Invalid TOON header: ${line}`);
  }

  const name = headerMatch[1];
  const count = headerMatch[2] ? parseInt(headerMatch[2], 10) : null;
  const fieldDefs = headerMatch[3].split(',').map(f => f.trim());

  const fields: ToonField[] = fieldDefs.map(fd => {
    // Support optional type hints: field:type
    const parts = fd.split(':');
    const fieldName = parts[0].trim();
    const type = parts[1]?.trim() as ToonField['type'] | undefined;
    return { name: fieldName, type };
  });

  return { name, count, fields };
}

function parseLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '\\' && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        values.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  values.push(current);

  return values;
}
