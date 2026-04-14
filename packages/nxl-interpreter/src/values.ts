import type { Param, Statement } from '@nxl/core';
import type { Environment } from './environment.js';

// ===== Runtime Value Union =====

export type Value =
  | NumberValue
  | StringValue
  | BoolValue
  | ListValue
  | DictValue
  | FunctionValue
  | NativeValue
  | NullValue;

export interface NumberValue {
  kind: 'number';
  value: number;
}

export interface StringValue {
  kind: 'string';
  value: string;
}

export interface BoolValue {
  kind: 'bool';
  value: boolean;
}

export interface ListValue {
  kind: 'list';
  items: Value[];
}

export interface DictValue {
  kind: 'dict';
  entries: Map<string, Value>;
}

export interface FunctionValue {
  kind: 'function';
  name: string | null;
  params: Param[];
  body: Statement[];
  closure: Environment;
}

export interface NativeValue {
  kind: 'native';
  name: string;
  call: (args: Value[]) => Value | Promise<Value>;
}

export interface NullValue {
  kind: 'null';
}

// ===== Constructors =====

export const NULL: NullValue = { kind: 'null' };

export function mkNumber(n: number): NumberValue {
  return { kind: 'number', value: n };
}

export function mkString(s: string): StringValue {
  return { kind: 'string', value: s };
}

export function mkBool(b: boolean): BoolValue {
  return { kind: 'bool', value: b };
}

export function mkList(items: Value[]): ListValue {
  return { kind: 'list', items };
}

export function mkDict(entries: Map<string, Value>): DictValue {
  return { kind: 'dict', entries };
}

export function mkDictFromObj(obj: Record<string, Value>): DictValue {
  return { kind: 'dict', entries: new Map(Object.entries(obj)) };
}

export function mkNative(name: string, call: (args: Value[]) => Value | Promise<Value>): NativeValue {
  return { kind: 'native', name, call };
}

// ===== Helpers =====

export function truthy(v: Value): boolean {
  switch (v.kind) {
    case 'null': return false;
    case 'bool': return v.value;
    case 'number': return v.value !== 0;
    case 'string': return v.value.length > 0;
    case 'list': return v.items.length > 0;
    case 'dict': return v.entries.size > 0;
    case 'function':
    case 'native': return true;
  }
}

export function equals(a: Value, b: Value): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'null': return true;
    case 'bool': return a.value === (b as BoolValue).value;
    case 'number': return a.value === (b as NumberValue).value;
    case 'string': return a.value === (b as StringValue).value;
    case 'list': {
      const bl = b as ListValue;
      if (a.items.length !== bl.items.length) return false;
      return a.items.every((v, i) => equals(v, bl.items[i]));
    }
    case 'dict': {
      const bd = b as DictValue;
      if (a.entries.size !== bd.entries.size) return false;
      for (const [k, v] of a.entries) {
        if (!bd.entries.has(k)) return false;
        if (!equals(v, bd.entries.get(k)!)) return false;
      }
      return true;
    }
    case 'function':
    case 'native': return a === b;
  }
}

export function display(v: Value): string {
  switch (v.kind) {
    case 'null': return 'null';
    case 'bool': return v.value ? 'true' : 'false';
    case 'number': return String(v.value);
    case 'string': return v.value;
    case 'list': return '[' + v.items.map(display).join(', ') + ']';
    case 'dict': {
      const pairs = [...v.entries.entries()].map(([k, val]) => `${k}: ${display(val)}`);
      return '{' + pairs.join(', ') + '}';
    }
    case 'function': return `<fn:${v.name ?? 'anon'}>`;
    case 'native': return `<native:${v.name}>`;
  }
}

export function repr(v: Value): string {
  if (v.kind === 'string') return JSON.stringify(v.value);
  return display(v);
}
