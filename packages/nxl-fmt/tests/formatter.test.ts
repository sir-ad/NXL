import { describe, it, expect } from 'bun:test';
import { parse } from '@nxl/core';
import { Formatter } from '../src/formatter.js';
import { format } from '../src/index.js';

function fmt(src: string): string {
  return new Formatter().format(parse(src)).trim();
}

describe('Formatter', () => {
  it('formats a simple assignment', () => {
    expect(fmt('x=1')).toBe('x = 1');
  });

  it('formats arithmetic', () => {
    expect(fmt('x = 1 + 2 * 3')).toBe('x = 1 + 2 * 3');
  });

  it('formats string literal', () => {
    expect(fmt('x = "hello"')).toBe('x = "hello"');
  });

  it('formats function declaration (expression body)', () => {
    const result = fmt('double(n): n * 2');
    expect(result).toBe('double(n): n * 2');
  });

  it('formats function declaration (block body)', () => {
    const result = fmt('f(x): {\n  return x + 1\n}');
    expect(result).toContain('f(x): {');
    expect(result).toContain('return x + 1');
    expect(result).toContain('}');
  });

  it('formats if statement', () => {
    const result = fmt('if x > 0 {\n  print("pos")\n}');
    expect(result).toContain('if x > 0 {');
    expect(result).toContain('print("pos")');
  });

  it('formats for loop', () => {
    const result = fmt('for i ∈ range(3) {\n  print(i)\n}');
    expect(result).toContain('for i ∈ range(3) {');
    expect(result).toContain('print(i)');
  });

  it('formats while loop', () => {
    const result = fmt('while true {\n  break\n}');
    expect(result).toContain('while true {');
    expect(result).toContain('break');
  });

  it('formats match expression', () => {
    const result = fmt('x = match v | 0 → "zero" | _ → "other"');
    expect(result).toContain('match v');
    expect(result).toContain('| 0 →');
    expect(result).toContain('| _ →');
  });

  it('formats null literal', () => {
    expect(fmt('x = null')).toBe('x = null');
  });

  it('formats array literal', () => {
    expect(fmt('x = [1, 2, 3]')).toBe('x = [1, 2, 3]');
  });

  it('formats use statement', () => {
    // Just check parse + format round-trip doesn't throw
    const result = format('use "./math"');
    expect(result).toContain('use "./math"');
  });

  it('formats pub statement', () => {
    const result = format('pub x = 42');
    expect(result).toContain('pub x = 42');
  });

  it('respects custom indent width', () => {
    const src = 'if x > 0 {\n  print("yes")\n}';
    const result = new Formatter({ indent: 4 }).format(parse(src));
    expect(result).toContain('    print("yes")');
  });

  it('convenience format() function works', () => {
    expect(format('x = 1').trim()).toBe('x = 1');
  });
});
