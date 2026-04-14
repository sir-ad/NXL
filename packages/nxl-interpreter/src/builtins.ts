import type { Environment } from './environment.js';
import {
  mkNative, mkNumber, mkString, mkBool, mkList, mkDict, NULL,
  display, repr,
  type Value, type NativeValue,
} from './values.js';
import { RuntimeError, TypeError } from './errors.js';

function assertArity(name: string, args: Value[], min: number, max = min): void {
  if (args.length < min || args.length > max) {
    throw new RuntimeError(
      `${name}() expects ${min === max ? min : `${min}–${max}`} argument(s), got ${args.length}`
    );
  }
}

function assertKind<K extends Value['kind']>(
  name: string,
  v: Value,
  kind: K
): asserts v is Extract<Value, { kind: K }> {
  if (v.kind !== kind) {
    throw new TypeError(`${name}() expected ${kind}, got ${v.kind}`);
  }
}

const BUILTINS: NativeValue[] = [
  // I/O
  mkNative('print', (args) => {
    console.log(args.map(display).join(' '));
    return NULL;
  }),

  mkNative('println', (args) => {
    console.log(args.map(display).join(' '));
    return NULL;
  }),

  // Type conversion
  mkNative('str', (args) => {
    assertArity('str', args, 1);
    return mkString(display(args[0]));
  }),

  mkNative('num', (args) => {
    assertArity('num', args, 1);
    const v = args[0];
    if (v.kind === 'number') return v;
    if (v.kind === 'string') {
      const n = Number(v.value);
      if (isNaN(n)) throw new RuntimeError(`num(): cannot convert "${v.value}" to number`);
      return mkNumber(n);
    }
    if (v.kind === 'bool') return mkNumber(v.value ? 1 : 0);
    throw new TypeError(`num(): cannot convert ${v.kind} to number`);
  }),

  mkNative('bool', (args) => {
    assertArity('bool', args, 1);
    const v = args[0];
    if (v.kind === 'bool') return v;
    if (v.kind === 'number') return mkBool(v.value !== 0);
    if (v.kind === 'string') return mkBool(v.value.length > 0);
    if (v.kind === 'null') return mkBool(false);
    if (v.kind === 'list') return mkBool(v.items.length > 0);
    if (v.kind === 'dict') return mkBool(v.entries.size > 0);
    return mkBool(true);
  }),

  mkNative('int', (args) => {
    assertArity('int', args, 1);
    const v = args[0];
    if (v.kind === 'number') return mkNumber(Math.trunc(v.value));
    if (v.kind === 'string') {
      const n = parseInt(v.value, 10);
      if (isNaN(n)) throw new RuntimeError(`int(): cannot convert "${v.value}" to int`);
      return mkNumber(n);
    }
    throw new TypeError(`int(): cannot convert ${v.kind}`);
  }),

  mkNative('float', (args) => {
    assertArity('float', args, 1);
    const v = args[0];
    if (v.kind === 'number') return v;
    if (v.kind === 'string') {
      const n = parseFloat(v.value);
      if (isNaN(n)) throw new RuntimeError(`float(): cannot convert "${v.value}" to float`);
      return mkNumber(n);
    }
    throw new TypeError(`float(): cannot convert ${v.kind}`);
  }),

  // Type introspection
  mkNative('type', (args) => {
    assertArity('type', args, 1);
    return mkString(args[0].kind);
  }),

  mkNative('repr', (args) => {
    assertArity('repr', args, 1);
    return mkString(repr(args[0]));
  }),

  // Collections — universal
  mkNative('len', (args) => {
    assertArity('len', args, 1);
    const v = args[0];
    if (v.kind === 'list') return mkNumber(v.items.length);
    if (v.kind === 'string') return mkNumber(v.value.length);
    if (v.kind === 'dict') return mkNumber(v.entries.size);
    throw new TypeError(`len(): cannot get length of ${v.kind}`);
  }),

  // Range
  mkNative('range', (args) => {
    if (args.length === 1) {
      assertKind('range', args[0], 'number');
      const n = Math.trunc(args[0].value);
      return mkList(Array.from({ length: n }, (_, i) => mkNumber(i)));
    }
    if (args.length === 2) {
      assertKind('range', args[0], 'number');
      assertKind('range', args[1], 'number');
      const start = Math.trunc(args[0].value);
      const end = Math.trunc(args[1].value);
      const items: Value[] = [];
      for (let i = start; i < end; i++) items.push(mkNumber(i));
      return mkList(items);
    }
    if (args.length === 3) {
      assertKind('range', args[0], 'number');
      assertKind('range', args[1], 'number');
      assertKind('range', args[2], 'number');
      const start = Math.trunc(args[0].value);
      const end = Math.trunc(args[1].value);
      const step = Math.trunc(args[2].value);
      if (step === 0) throw new RuntimeError('range(): step cannot be zero');
      const items: Value[] = [];
      if (step > 0) {
        for (let i = start; i < end; i += step) items.push(mkNumber(i));
      } else {
        for (let i = start; i > end; i += step) items.push(mkNumber(i));
      }
      return mkList(items);
    }
    throw new RuntimeError('range() expects 1–3 arguments');
  }),

  // List operations
  mkNative('push', (args) => {
    assertArity('push', args, 2);
    assertKind('push', args[0], 'list');
    args[0].items.push(args[1]);
    return args[0];
  }),

  mkNative('pop', (args) => {
    assertArity('pop', args, 1);
    assertKind('pop', args[0], 'list');
    if (args[0].items.length === 0) throw new RuntimeError('pop(): list is empty');
    return args[0].items.pop()!;
  }),

  mkNative('append', (args) => {
    assertArity('append', args, 2);
    assertKind('append', args[0], 'list');
    return mkList([...args[0].items, args[1]]);
  }),

  mkNative('concat', (args) => {
    if (args.length < 2) throw new RuntimeError('concat() expects at least 2 arguments');
    if (args[0].kind === 'list') {
      const result: Value[] = [];
      for (const a of args) {
        assertKind('concat', a, 'list');
        result.push(...a.items);
      }
      return mkList(result);
    }
    if (args[0].kind === 'string') {
      return mkString(args.map(a => {
        if (a.kind !== 'string') throw new TypeError('concat(): expected string');
        return a.value;
      }).join(''));
    }
    throw new TypeError('concat(): expected list or string');
  }),

  mkNative('slice', (args) => {
    if (args.length < 2 || args.length > 3) throw new RuntimeError('slice() expects 2–3 arguments');
    const v = args[0];
    assertKind('slice', args[1], 'number');
    const start = Math.trunc(args[1].value);
    const end = args[2] ? (assertKind('slice', args[2], 'number'), Math.trunc(args[2].value)) : undefined;
    if (v.kind === 'list') return mkList(v.items.slice(start, end));
    if (v.kind === 'string') return mkString(v.value.slice(start, end));
    throw new TypeError('slice(): expected list or string');
  }),

  mkNative('reverse', (args) => {
    assertArity('reverse', args, 1);
    if (args[0].kind === 'list') return mkList([...args[0].items].reverse());
    if (args[0].kind === 'string') return mkString([...args[0].value].reverse().join(''));
    throw new TypeError('reverse(): expected list or string');
  }),

  mkNative('sort', (args) => {
    assertArity('sort', args, 1);
    assertKind('sort', args[0], 'list');
    const sorted = [...args[0].items].sort((a, b) => {
      if (a.kind === 'number' && b.kind === 'number') return a.value - b.value;
      if (a.kind === 'string' && b.kind === 'string') return a.value < b.value ? -1 : a.value > b.value ? 1 : 0;
      throw new RuntimeError('sort(): list must contain numbers or strings');
    });
    return mkList(sorted);
  }),

  mkNative('map', (args) => {
    assertArity('map', args, 2);
    assertKind('map', args[0], 'list');
    if (args[1].kind !== 'function' && args[1].kind !== 'native') {
      throw new TypeError('map(): second argument must be a function');
    }
    // Mapping is handled at call time — we return a lazy descriptor here;
    // the caller (interpreter) handles invocation. For now, we use a simple
    // synchronous native that calls the function value synchronously.
    throw new RuntimeError('map(): use pipeline syntax instead — list → select expr');
  }),

  // Dict operations
  mkNative('keys', (args) => {
    assertArity('keys', args, 1);
    assertKind('keys', args[0], 'dict');
    return mkList([...args[0].entries.keys()].map(mkString));
  }),

  mkNative('values', (args) => {
    assertArity('values', args, 1);
    assertKind('values', args[0], 'dict');
    return mkList([...args[0].entries.values()]);
  }),

  mkNative('items', (args) => {
    assertArity('items', args, 1);
    assertKind('items', args[0], 'dict');
    return mkList(
      [...args[0].entries.entries()].map(([k, v]) => mkList([mkString(k), v]))
    );
  }),

  mkNative('get', (args) => {
    assertArity('get', args, 2, 3);
    assertKind('get', args[0], 'dict');
    assertKind('get', args[1], 'string');
    const val = args[0].entries.get(args[1].value);
    return val ?? (args[2] ?? NULL);
  }),

  mkNative('set', (args) => {
    assertArity('set', args, 3);
    assertKind('set', args[0], 'dict');
    assertKind('set', args[1], 'string');
    const newMap = new Map(args[0].entries);
    newMap.set(args[1].value, args[2]);
    return mkDict(newMap);
  }),

  mkNative('has', (args) => {
    assertArity('has', args, 2);
    if (args[0].kind === 'dict') {
      assertKind('has', args[1], 'string');
      return mkBool(args[0].entries.has(args[1].value));
    }
    if (args[0].kind === 'list') {
      return mkBool(args[0].items.some(item => {
        if (item.kind !== args[1].kind) return false;
        if (item.kind === 'string') return item.value === (args[1] as typeof item).value;
        if (item.kind === 'number') return item.value === (args[1] as typeof item).value;
        return false;
      }));
    }
    throw new TypeError('has(): expected dict or list');
  }),

  // String operations
  mkNative('split', (args) => {
    assertArity('split', args, 1, 2);
    assertKind('split', args[0], 'string');
    const sep = args[1]?.kind === 'string' ? args[1].value : ' ';
    return mkList(args[0].value.split(sep).map(mkString));
  }),

  mkNative('join', (args) => {
    assertArity('join', args, 1, 2);
    assertKind('join', args[0], 'list');
    const sep = args[1]?.kind === 'string' ? args[1].value : '';
    return mkString(args[0].items.map(display).join(sep));
  }),

  mkNative('trim', (args) => {
    assertArity('trim', args, 1);
    assertKind('trim', args[0], 'string');
    return mkString(args[0].value.trim());
  }),

  mkNative('upper', (args) => {
    assertArity('upper', args, 1);
    assertKind('upper', args[0], 'string');
    return mkString(args[0].value.toUpperCase());
  }),

  mkNative('lower', (args) => {
    assertArity('lower', args, 1);
    assertKind('lower', args[0], 'string');
    return mkString(args[0].value.toLowerCase());
  }),

  mkNative('starts_with', (args) => {
    assertArity('starts_with', args, 2);
    assertKind('starts_with', args[0], 'string');
    assertKind('starts_with', args[1], 'string');
    return mkBool(args[0].value.startsWith(args[1].value));
  }),

  mkNative('ends_with', (args) => {
    assertArity('ends_with', args, 2);
    assertKind('ends_with', args[0], 'string');
    assertKind('ends_with', args[1], 'string');
    return mkBool(args[0].value.endsWith(args[1].value));
  }),

  mkNative('contains', (args) => {
    assertArity('contains', args, 2);
    assertKind('contains', args[0], 'string');
    assertKind('contains', args[1], 'string');
    return mkBool(args[0].value.includes(args[1].value));
  }),

  mkNative('replace', (args) => {
    assertArity('replace', args, 3);
    assertKind('replace', args[0], 'string');
    assertKind('replace', args[1], 'string');
    assertKind('replace', args[2], 'string');
    return mkString(args[0].value.replaceAll(args[1].value, args[2].value));
  }),

  // Math
  mkNative('abs', (args) => {
    assertArity('abs', args, 1);
    assertKind('abs', args[0], 'number');
    return mkNumber(Math.abs(args[0].value));
  }),

  mkNative('floor', (args) => {
    assertArity('floor', args, 1);
    assertKind('floor', args[0], 'number');
    return mkNumber(Math.floor(args[0].value));
  }),

  mkNative('ceil', (args) => {
    assertArity('ceil', args, 1);
    assertKind('ceil', args[0], 'number');
    return mkNumber(Math.ceil(args[0].value));
  }),

  mkNative('round', (args) => {
    assertArity('round', args, 1);
    assertKind('round', args[0], 'number');
    return mkNumber(Math.round(args[0].value));
  }),

  mkNative('sqrt', (args) => {
    assertArity('sqrt', args, 1);
    assertKind('sqrt', args[0], 'number');
    return mkNumber(Math.sqrt(args[0].value));
  }),

  mkNative('max', (args) => {
    if (args.length === 0) throw new RuntimeError('max() requires at least one argument');
    if (args.length === 1 && args[0].kind === 'list') {
      const items = args[0].items;
      if (items.length === 0) throw new RuntimeError('max(): empty list');
      return items.reduce((m, v) => {
        if (v.kind !== 'number') throw new TypeError('max(): list must contain numbers');
        if (m.kind !== 'number') throw new TypeError('max(): list must contain numbers');
        return v.value > m.value ? v : m;
      });
    }
    return args.reduce((m, v) => {
      if (v.kind !== 'number' || m.kind !== 'number') throw new TypeError('max(): expected numbers');
      return v.value > m.value ? v : m;
    });
  }),

  mkNative('min', (args) => {
    if (args.length === 0) throw new RuntimeError('min() requires at least one argument');
    if (args.length === 1 && args[0].kind === 'list') {
      const items = args[0].items;
      if (items.length === 0) throw new RuntimeError('min(): empty list');
      return items.reduce((m, v) => {
        if (v.kind !== 'number') throw new TypeError('min(): list must contain numbers');
        if (m.kind !== 'number') throw new TypeError('min(): list must contain numbers');
        return v.value < m.value ? v : m;
      });
    }
    return args.reduce((m, v) => {
      if (v.kind !== 'number' || m.kind !== 'number') throw new TypeError('min(): expected numbers');
      return v.value < m.value ? v : m;
    });
  }),

  mkNative('sum', (args) => {
    assertArity('sum', args, 1);
    assertKind('sum', args[0], 'list');
    let total = 0;
    for (const item of args[0].items) {
      if (item.kind !== 'number') throw new TypeError('sum(): list must contain numbers');
      total += item.value;
    }
    return mkNumber(total);
  }),

  // Functional helpers
  mkNative('filter', (_args) => {
    throw new RuntimeError('filter(): use pipeline syntax instead — list → select expr');
  }),

  // Null / existence
  mkNative('is_null', (args) => {
    assertArity('is_null', args, 1);
    return mkBool(args[0].kind === 'null');
  }),

  mkNative('coalesce', (args) => {
    for (const a of args) {
      if (a.kind !== 'null') return a;
    }
    return NULL;
  }),

  // Assert
  mkNative('assert', (args) => {
    assertArity('assert', args, 1, 2);
    const cond = args[0];
    if (cond.kind === 'bool' && !cond.value || cond.kind === 'null') {
      const msg = args[1]?.kind === 'string' ? args[1].value : 'assertion failed';
      throw new RuntimeError(msg);
    }
    return NULL;
  }),

  // JSON
  mkNative('json_encode', (args) => {
    assertArity('json_encode', args, 1);
    function toJS(v: Value): unknown {
      switch (v.kind) {
        case 'null': return null;
        case 'bool': return v.value;
        case 'number': return v.value;
        case 'string': return v.value;
        case 'list': return v.items.map(toJS);
        case 'dict': {
          const obj: Record<string, unknown> = {};
          for (const [k, val] of v.entries) obj[k] = toJS(val);
          return obj;
        }
        default: return null;
      }
    }
    return mkString(JSON.stringify(toJS(args[0])));
  }),

  mkNative('json_decode', (args) => {
    assertArity('json_decode', args, 1);
    assertKind('json_decode', args[0], 'string');
    try {
      const parsed = JSON.parse(args[0].value);
      function fromJS(v: unknown): Value {
        if (v === null || v === undefined) return NULL;
        if (typeof v === 'boolean') return mkBool(v);
        if (typeof v === 'number') return mkNumber(v);
        if (typeof v === 'string') return mkString(v);
        if (Array.isArray(v)) return mkList(v.map(fromJS));
        if (typeof v === 'object') {
          const m = new Map<string, Value>();
          for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
            m.set(k, fromJS(val));
          }
          return mkDict(m);
        }
        return NULL;
      }
      return fromJS(parsed);
    } catch {
      throw new RuntimeError('json_decode(): invalid JSON');
    }
  }),
];

export function registerBuiltins(env: Environment): void {
  for (const b of BUILTINS) {
    env.define(b.name, b);
  }
  // Constants
  env.define('null', NULL);
  env.define('true', mkBool(true));
  env.define('false', mkBool(false));
  env.define('PI', mkNumber(Math.PI));
  env.define('E', mkNumber(Math.E));
  env.define('Infinity', mkNumber(Infinity));
  env.define('NaN', mkNumber(NaN));
}
