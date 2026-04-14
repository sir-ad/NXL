import { describe, it, expect } from 'bun:test';
import { parse } from '@nxl/core';
import { TypeChecker } from '../src/checker.js';
import { T_NUM, T_STR, T_BOOL } from '../src/types.js';
import { typeOf, typesEqual, isAssignable, unionOf } from '../src/types.js';

function check(source: string) {
  const prog = parse(source);
  return new TypeChecker(source).check(prog);
}

function errors(source: string) {
  return check(source).filter(d => d.severity === 'error');
}

// ===== Type helpers =====

describe('type helpers', () => {
  it('typeOf renders primitives', () => {
    expect(typeOf(T_NUM)).toBe('num');
    expect(typeOf(T_STR)).toBe('str');
    expect(typeOf(T_BOOL)).toBe('bool');
    expect(typeOf({ kind: 'list', item: T_NUM })).toBe('list<num>');
    expect(typeOf({ kind: 'fn', params: [T_NUM], ret: T_STR })).toBe('fn(num) -> str');
  });

  it('isAssignable: same types are assignable', () => {
    expect(isAssignable(T_NUM, T_NUM)).toBe(true);
    expect(isAssignable(T_STR, T_NUM)).toBe(false);
  });

  it('any is assignable to/from anything', () => {
    expect(isAssignable({ kind: 'any' }, T_NUM)).toBe(true);
    expect(isAssignable(T_NUM, { kind: 'any' })).toBe(true);
  });

  it('union assignability', () => {
    const u = { kind: 'union' as const, types: [T_NUM, T_STR] };
    expect(isAssignable(T_NUM, u)).toBe(true);
    expect(isAssignable(T_BOOL, u)).toBe(false);
  });

  it('typesEqual works structurally', () => {
    expect(typesEqual(T_NUM, T_NUM)).toBe(true);
    expect(typesEqual({ kind: 'list', item: T_STR }, { kind: 'list', item: T_STR })).toBe(true);
    expect(typesEqual({ kind: 'list', item: T_STR }, { kind: 'list', item: T_NUM })).toBe(false);
  });

  it('unionOf produces union or widens', () => {
    const u = unionOf(T_NUM, T_STR);
    expect(u.kind).toBe('union');
    // same type → just returns the type
    const same = unionOf(T_NUM, T_NUM);
    expect(typesEqual(same, T_NUM)).toBe(true);
  });
});

// ===== Type checker =====

describe('TypeChecker', () => {
  it('no errors for clean code', () => {
    expect(errors('x = 1\ny = x + 2\nprint(y)')).toHaveLength(0);
  });

  it('detects arithmetic on string', () => {
    const diags = errors('x = "hello"\ny = x - 1');
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0].message).toMatch(/num/);
  });

  it('detects type mismatch on reassignment', () => {
    // x starts as num, then string is assigned
    const diags = errors('x = 1\nx = "oops"');
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0].message).toMatch(/mismatch/);
  });

  it('infers list item type as num', () => {
    // Should produce no error: nums + nums
    expect(errors('[1, 2, 3]\n')).toHaveLength(0);
  });

  it('no false positives for any', () => {
    // Dynamically typed code should produce 0 errors
    expect(errors('x = read_file("file.txt")\nprint(x)')).toHaveLength(0);
  });

  it('function decl registers fn type', () => {
    // Calling double with a string should be a type error
    const diags = errors(`
double(n: num): n * 2
double("bad")
`);
    expect(diags.length).toBeGreaterThan(0);
  });

  it('handles ternary type inference', () => {
    expect(errors('x = true ? 1 : 2')).toHaveLength(0);
  });

  it('handles match expression', () => {
    expect(errors(`
classify(x): match x
  | 0 → "zero"
  | _ → "other"
`)).toHaveLength(0);
  });

  it('no errors on stdlib calls', () => {
    expect(errors(`
items = [1, 2, 3]
n = len(items)
s = str(n)
print(s)
`)).toHaveLength(0);
  });
});
