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

  // ===== File I/O =====

  mkNative('read_file', (args) => {
    assertArity('read_file', args, 1);
    assertKind('read_file', args[0], 'string');
    try {
      const { readFileSync } = require('node:fs') as typeof import('node:fs');
      return mkString(readFileSync(args[0].value, 'utf8'));
    } catch (e: unknown) {
      throw new RuntimeError(`read_file(): cannot read '${args[0].value}': ${e instanceof Error ? e.message : String(e)}`);
    }
  }),

  mkNative('write_file', (args) => {
    assertArity('write_file', args, 2);
    assertKind('write_file', args[0], 'string');
    assertKind('write_file', args[1], 'string');
    try {
      const { writeFileSync } = require('node:fs') as typeof import('node:fs');
      writeFileSync(args[0].value, args[1].value, 'utf8');
      return NULL;
    } catch (e: unknown) {
      throw new RuntimeError(`write_file(): cannot write '${args[0].value}': ${e instanceof Error ? e.message : String(e)}`);
    }
  }),

  mkNative('file_exists', (args) => {
    assertArity('file_exists', args, 1);
    assertKind('file_exists', args[0], 'string');
    const { existsSync } = require('node:fs') as typeof import('node:fs');
    return mkBool(existsSync(args[0].value));
  }),

  mkNative('list_dir', (args) => {
    assertArity('list_dir', args, 1);
    assertKind('list_dir', args[0], 'string');
    try {
      const { readdirSync } = require('node:fs') as typeof import('node:fs');
      return mkList(readdirSync(args[0].value).map(f => mkString(String(f))));
    } catch (e: unknown) {
      throw new RuntimeError(`list_dir(): cannot list '${args[0].value}': ${e instanceof Error ? e.message : String(e)}`);
    }
  }),

  mkNative('make_dir', (args) => {
    assertArity('make_dir', args, 1);
    assertKind('make_dir', args[0], 'string');
    try {
      const { mkdirSync } = require('node:fs') as typeof import('node:fs');
      mkdirSync(args[0].value, { recursive: true });
      return NULL;
    } catch (e: unknown) {
      throw new RuntimeError(`make_dir(): cannot create '${args[0].value}': ${e instanceof Error ? e.message : String(e)}`);
    }
  }),

  // ===== Path =====

  mkNative('path_join', (args) => {
    if (args.length === 0) throw new RuntimeError('path_join() expects at least one argument');
    const { join } = require('node:path') as typeof import('node:path');
    const parts = args.map((a, i) => {
      if (a.kind !== 'string') throw new TypeError(`path_join(): argument ${i + 1} must be a string, got ${a.kind}`);
      return a.value;
    });
    return mkString(join(...parts));
  }),

  mkNative('path_basename', (args) => {
    assertArity('path_basename', args, 1);
    assertKind('path_basename', args[0], 'string');
    const { basename } = require('node:path') as typeof import('node:path');
    return mkString(basename(args[0].value));
  }),

  mkNative('path_dirname', (args) => {
    assertArity('path_dirname', args, 1);
    assertKind('path_dirname', args[0], 'string');
    const { dirname } = require('node:path') as typeof import('node:path');
    return mkString(dirname(args[0].value));
  }),

  mkNative('path_abs', (args) => {
    assertArity('path_abs', args, 1);
    assertKind('path_abs', args[0], 'string');
    const { resolve } = require('node:path') as typeof import('node:path');
    return mkString(resolve(args[0].value));
  }),

  mkNative('path_ext', (args) => {
    assertArity('path_ext', args, 1);
    assertKind('path_ext', args[0], 'string');
    const { extname } = require('node:path') as typeof import('node:path');
    return mkString(extname(args[0].value));
  }),

  // ===== Regex =====

  mkNative('regex_test', (args) => {
    assertArity('regex_test', args, 2);
    assertKind('regex_test', args[0], 'string');
    assertKind('regex_test', args[1], 'string');
    try {
      return mkBool(new RegExp(args[0].value).test(args[1].value));
    } catch (e: unknown) {
      throw new RuntimeError(`regex_test(): invalid pattern: ${e instanceof Error ? e.message : String(e)}`);
    }
  }),

  mkNative('regex_find', (args) => {
    assertArity('regex_find', args, 2);
    assertKind('regex_find', args[0], 'string');
    assertKind('regex_find', args[1], 'string');
    try {
      const matches = [...args[1].value.matchAll(new RegExp(args[0].value, 'g'))];
      return mkList(matches.map(m => mkString(m[0])));
    } catch (e: unknown) {
      throw new RuntimeError(`regex_find(): invalid pattern: ${e instanceof Error ? e.message : String(e)}`);
    }
  }),

  mkNative('regex_replace', (args) => {
    assertArity('regex_replace', args, 3);
    assertKind('regex_replace', args[0], 'string');
    assertKind('regex_replace', args[1], 'string');
    assertKind('regex_replace', args[2], 'string');
    try {
      return mkString(args[2].value.replace(new RegExp(args[0].value, 'g'), args[1].value));
    } catch (e: unknown) {
      throw new RuntimeError(`regex_replace(): invalid pattern: ${e instanceof Error ? e.message : String(e)}`);
    }
  }),

  mkNative('regex_groups', (args) => {
    assertArity('regex_groups', args, 2);
    assertKind('regex_groups', args[0], 'string');
    assertKind('regex_groups', args[1], 'string');
    try {
      const m = args[1].value.match(new RegExp(args[0].value));
      if (!m) return NULL;
      return mkList(m.slice(1).map(g => g == null ? NULL : mkString(g)));
    } catch (e: unknown) {
      throw new RuntimeError(`regex_groups(): invalid pattern: ${e instanceof Error ? e.message : String(e)}`);
    }
  }),

  // ===== Time =====

  mkNative('now', (args) => {
    assertArity('now', args, 0);
    return mkNumber(Date.now() / 1000);
  }),

  mkNative('timestamp', (args) => {
    assertArity('timestamp', args, 0);
    return mkNumber(Date.now());
  }),

  mkNative('sleep', async (args) => {
    assertArity('sleep', args, 1);
    assertKind('sleep', args[0], 'number');
    await new Promise(resolve => setTimeout(resolve, args[0].value * 1000));
    return NULL;
  }),

  // ===== Random =====

  mkNative('random', (args) => {
    assertArity('random', args, 0);
    return mkNumber(Math.random());
  }),

  mkNative('random_int', (args) => {
    assertArity('random_int', args, 2);
    assertKind('random_int', args[0], 'number');
    assertKind('random_int', args[1], 'number');
    const lo = Math.ceil(args[0].value);
    const hi = Math.floor(args[1].value);
    if (lo > hi) throw new RuntimeError('random_int(): min must be <= max');
    return mkNumber(Math.floor(Math.random() * (hi - lo + 1)) + lo);
  }),

  mkNative('random_choice', (args) => {
    assertArity('random_choice', args, 1);
    assertKind('random_choice', args[0], 'list');
    if (args[0].items.length === 0) throw new RuntimeError('random_choice(): empty list');
    return args[0].items[Math.floor(Math.random() * args[0].items.length)];
  }),

  // ===== Environment =====

  mkNative('env_get', (args) => {
    assertArity('env_get', args, 1, 2);
    assertKind('env_get', args[0], 'string');
    const val = process.env[args[0].value];
    if (val === undefined) return args[1] ?? NULL;
    return mkString(val);
  }),

  mkNative('env_set', (args) => {
    assertArity('env_set', args, 2);
    assertKind('env_set', args[0], 'string');
    assertKind('env_set', args[1], 'string');
    process.env[args[0].value] = args[1].value;
    return NULL;
  }),

  mkNative('env_keys', (args) => {
    assertArity('env_keys', args, 0);
    return mkList(Object.keys(process.env).map(mkString));
  }),

  // ===== HTTP =====

  mkNative('fetch_url', async (args) => {
    assertArity('fetch_url', args, 1, 2);
    assertKind('fetch_url', args[0], 'string');
    const url = args[0].value;
    const opts = args[1]?.kind === 'dict' ? args[1].entries : new Map<string, Value>();

    const methodVal = opts.get('method');
    const method = methodVal?.kind === 'string' ? methodVal.value : 'GET';

    const bodyVal = opts.get('body');
    const body = bodyVal?.kind === 'string' ? bodyVal.value : undefined;

    const headersMap: Record<string, string> = {};
    const headersVal = opts.get('headers');
    if (headersVal?.kind === 'dict') {
      for (const [k, v] of headersVal.entries) {
        if (v.kind === 'string') headersMap[k] = v.value;
      }
    }

    try {
      const res = await fetch(url, { method, body, headers: headersMap });
      const text = await res.text();
      return mkDict(new Map<string, Value>([
        ['status', mkNumber(res.status)],
        ['ok', mkBool(res.ok)],
        ['text', mkString(text)],
        ['headers', mkDict(new Map<string, Value>(
          [...res.headers.entries()].map(([k, v]) => [k, mkString(v)])
        ))],
      ]));
    } catch (e: unknown) {
      throw new RuntimeError(`fetch_url(): request failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }),

  // ===== String extras =====

  mkNative('pad_start', (args) => {
    assertArity('pad_start', args, 2, 3);
    assertKind('pad_start', args[0], 'string');
    assertKind('pad_start', args[1], 'number');
    const pad = args[2]?.kind === 'string' ? args[2].value : ' ';
    return mkString(args[0].value.padStart(args[1].value, pad));
  }),

  mkNative('pad_end', (args) => {
    assertArity('pad_end', args, 2, 3);
    assertKind('pad_end', args[0], 'string');
    assertKind('pad_end', args[1], 'number');
    const pad = args[2]?.kind === 'string' ? args[2].value : ' ';
    return mkString(args[0].value.padEnd(args[1].value, pad));
  }),

  mkNative('char_code', (args) => {
    assertArity('char_code', args, 1);
    assertKind('char_code', args[0], 'string');
    if (args[0].value.length === 0) throw new RuntimeError('char_code(): empty string');
    return mkNumber(args[0].value.charCodeAt(0));
  }),

  mkNative('from_char_code', (args) => {
    assertArity('from_char_code', args, 1);
    assertKind('from_char_code', args[0], 'number');
    return mkString(String.fromCharCode(args[0].value));
  }),

  mkNative('repeat', (args) => {
    assertArity('repeat', args, 2);
    assertKind('repeat', args[0], 'string');
    assertKind('repeat', args[1], 'number');
    if (args[1].value < 0) throw new RuntimeError('repeat(): count must be >= 0');
    return mkString(args[0].value.repeat(args[1].value));
  }),

  mkNative('index_of', (args) => {
    assertArity('index_of', args, 2);
    if (args[0].kind === 'string') {
      assertKind('index_of', args[1], 'string');
      return mkNumber(args[0].value.indexOf(args[1].value));
    }
    if (args[0].kind === 'list') {
      const idx = args[0].items.findIndex(item => {
        if (item.kind !== args[1].kind) return false;
        if (item.kind === 'number') return item.value === (args[1] as { kind: 'number'; value: number }).value;
        if (item.kind === 'string') return item.value === (args[1] as { kind: 'string'; value: string }).value;
        return false;
      });
      return mkNumber(idx);
    }
    throw new TypeError('index_of(): expected string or list');
  }),

  // ===== Math extras =====

  mkNative('pow', (args) => {
    assertArity('pow', args, 2);
    assertKind('pow', args[0], 'number');
    assertKind('pow', args[1], 'number');
    return mkNumber(Math.pow(args[0].value, args[1].value));
  }),

  mkNative('log', (args) => {
    assertArity('log', args, 1, 2);
    assertKind('log', args[0], 'number');
    if (args[1]) {
      assertKind('log', args[1], 'number');
      return mkNumber(Math.log(args[0].value) / Math.log(args[1].value));
    }
    return mkNumber(Math.log(args[0].value));
  }),

  mkNative('sin', (args) => { assertArity('sin', args, 1); assertKind('sin', args[0], 'number'); return mkNumber(Math.sin(args[0].value)); }),
  mkNative('cos', (args) => { assertArity('cos', args, 1); assertKind('cos', args[0], 'number'); return mkNumber(Math.cos(args[0].value)); }),
  mkNative('tan', (args) => { assertArity('tan', args, 1); assertKind('tan', args[0], 'number'); return mkNumber(Math.tan(args[0].value)); }),

  mkNative('clamp', (args) => {
    assertArity('clamp', args, 3);
    assertKind('clamp', args[0], 'number');
    assertKind('clamp', args[1], 'number');
    assertKind('clamp', args[2], 'number');
    return mkNumber(Math.min(Math.max(args[0].value, args[1].value), args[2].value));
  }),

  mkNative('sign', (args) => {
    assertArity('sign', args, 1);
    assertKind('sign', args[0], 'number');
    return mkNumber(Math.sign(args[0].value));
  }),

  // ===== List extras =====

  mkNative('flat', (args) => {
    assertArity('flat', args, 1);
    assertKind('flat', args[0], 'list');
    const result: Value[] = [];
    for (const item of args[0].items) {
      if (item.kind === 'list') result.push(...item.items);
      else result.push(item);
    }
    return mkList(result);
  }),

  mkNative('zip', (args) => {
    if (args.length < 2) throw new RuntimeError('zip() expects at least 2 arguments');
    for (const a of args) assertKind('zip', a, 'list');
    const minLen = Math.min(...args.map(a => (a as { kind: 'list'; items: Value[] }).items.length));
    const result: Value[] = [];
    for (let i = 0; i < minLen; i++) {
      result.push(mkList(args.map(a => (a as { kind: 'list'; items: Value[] }).items[i])));
    }
    return mkList(result);
  }),

  mkNative('unique', (args) => {
    assertArity('unique', args, 1);
    assertKind('unique', args[0], 'list');
    const seen: Value[] = [];
    const result: Value[] = [];
    for (const item of args[0].items) {
      if (!seen.some(s => {
        if (s.kind !== item.kind) return false;
        if (s.kind === 'number') return s.value === (item as { kind: 'number'; value: number }).value;
        if (s.kind === 'string') return s.value === (item as { kind: 'string'; value: string }).value;
        if (s.kind === 'bool') return s.value === (item as { kind: 'bool'; value: boolean }).value;
        if (s.kind === 'null') return true;
        return false;
      })) {
        seen.push(item);
        result.push(item);
      }
    }
    return mkList(result);
  }),

  mkNative('group_by', (args) => {
    assertArity('group_by', args, 2);
    assertKind('group_by', args[0], 'list');
    assertKind('group_by', args[1], 'string');
    const key = args[1].value;
    const groups = new Map<string, Value[]>();
    for (const item of args[0].items) {
      if (item.kind !== 'dict') throw new TypeError('group_by(): list items must be dicts');
      const k = item.entries.get(key);
      const ks = k ? display(k) : 'null';
      if (!groups.has(ks)) groups.set(ks, []);
      groups.get(ks)!.push(item);
    }
    return mkDict(new Map([...groups.entries()].map(([k, v]) => [k, mkList(v)])));
  }),

  mkNative('count', (args) => {
    assertArity('count', args, 1);
    if (args[0].kind === 'list') return mkNumber(args[0].items.length);
    if (args[0].kind === 'dict') return mkNumber(args[0].entries.size);
    if (args[0].kind === 'string') return mkNumber(args[0].value.length);
    throw new TypeError('count(): expected list, dict, or string');
  }),

  mkNative('first', (args) => {
    assertArity('first', args, 1);
    assertKind('first', args[0], 'list');
    return args[0].items[0] ?? NULL;
  }),

  mkNative('last', (args) => {
    assertArity('last', args, 1);
    assertKind('last', args[0], 'list');
    return args[0].items[args[0].items.length - 1] ?? NULL;
  }),

  mkNative('take', (args) => {
    assertArity('take', args, 2);
    assertKind('take', args[0], 'list');
    assertKind('take', args[1], 'number');
    return mkList(args[0].items.slice(0, args[1].value));
  }),

  mkNative('drop', (args) => {
    assertArity('drop', args, 2);
    assertKind('drop', args[0], 'list');
    assertKind('drop', args[1], 'number');
    return mkList(args[0].items.slice(args[1].value));
  }),

  mkNative('any', (args) => {
    assertArity('any', args, 1);
    assertKind('any', args[0], 'list');
    return mkBool(args[0].items.some(v => v.kind !== 'null' && !(v.kind === 'bool' && !v.value)));
  }),

  mkNative('all', (args) => {
    assertArity('all', args, 1);
    assertKind('all', args[0], 'list');
    return mkBool(args[0].items.every(v => v.kind !== 'null' && !(v.kind === 'bool' && !v.value)));
  }),

  mkNative('none', (args) => {
    assertArity('none', args, 1);
    assertKind('none', args[0], 'list');
    return mkBool(!args[0].items.some(v => v.kind !== 'null' && !(v.kind === 'bool' && !v.value)));
  }),

  // ===== Dict extras =====

  mkNative('merge', (args) => {
    if (args.length < 2) throw new RuntimeError('merge() expects at least 2 arguments');
    const result = new Map<string, Value>();
    for (const a of args) {
      assertKind('merge', a, 'dict');
      for (const [k, v] of a.entries) result.set(k, v);
    }
    return mkDict(result);
  }),

  mkNative('omit', (args) => {
    assertArity('omit', args, 2);
    assertKind('omit', args[0], 'dict');
    assertKind('omit', args[1], 'list');
    const keys = new Set(args[1].items.map(k => {
      if (k.kind !== 'string') throw new TypeError('omit(): key list must contain strings');
      return k.value;
    }));
    return mkDict(new Map([...args[0].entries].filter(([k]) => !keys.has(k))));
  }),

  mkNative('pick', (args) => {
    assertArity('pick', args, 2);
    assertKind('pick', args[0], 'dict');
    assertKind('pick', args[1], 'list');
    const keys = new Set(args[1].items.map(k => {
      if (k.kind !== 'string') throw new TypeError('pick(): key list must contain strings');
      return k.value;
    }));
    return mkDict(new Map([...args[0].entries].filter(([k]) => keys.has(k))));
  }),

  // ===== JSON
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
