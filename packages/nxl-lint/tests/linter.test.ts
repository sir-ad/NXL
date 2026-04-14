import { describe, it, expect } from 'bun:test';
import { parse } from '@nxl/core';
import { Linter } from '../src/linter.js';
import { lint } from '../src/index.js';

function lintSrc(src: string) {
  const prog = parse(src);
  return new Linter(src).lint(prog);
}

function warnings(src: string) {
  return lintSrc(src).filter(d => d.severity === 'warning');
}

function infos(src: string) {
  return lintSrc(src).filter(d => d.severity === 'info');
}

describe('Linter', () => {
  it('clean code has no diagnostics', () => {
    expect(lintSrc('x = 1\nprint(x)')).toHaveLength(0);
  });

  it('detects undefined variable (no-undef)', () => {
    const diags = warnings('print(undeclared_var)');
    expect(diags.some(d => d.rule === 'no-undef')).toBe(true);
  });

  it('no false positives for builtins', () => {
    // print, len, range etc. should not be flagged
    const diags = warnings('print(len([1,2,3]))');
    expect(diags.filter(d => d.rule === 'no-undef')).toHaveLength(0);
  });

  it('detects unused variable (no-unused-vars)', () => {
    const diags = infos('x = 42');
    expect(diags.some(d => d.rule === 'no-unused-vars')).toBe(true);
  });

  it('used variable is not flagged', () => {
    const diags = infos('x = 42\nprint(x)');
    expect(diags.filter(d => d.rule === 'no-unused-vars')).toHaveLength(0);
  });

  it('detects unreachable code after return (no-unreachable)', () => {
    const src = `
f(x): {
  return x
  print("dead")
}
`;
    const diags = warnings(src);
    expect(diags.some(d => d.rule === 'no-unreachable')).toBe(true);
  });

  it('no false positive for last-statement return', () => {
    const src = `
f(x): {
  return x
}
`;
    const diags = warnings(src);
    expect(diags.filter(d => d.rule === 'no-unreachable')).toHaveLength(0);
  });

  it('detects empty function (no-empty-fn)', () => {
    const src = 'f(x): {}';
    const diags = warnings(src);
    expect(diags.some(d => d.rule === 'no-empty-fn')).toBe(true);
  });

  it('function with body is not flagged for no-empty-fn', () => {
    const src = 'f(x): x + 1';
    const diags = warnings(src);
    expect(diags.filter(d => d.rule === 'no-empty-fn')).toHaveLength(0);
  });

  it('no-shadow is info, not warning', () => {
    const src = `
outer = 1
f(outer): outer + 1
`;
    const diags = lintSrc(src);
    expect(diags.some(d => d.rule === 'no-shadow' && d.severity === 'info')).toBe(true);
  });

  it('for loop variable is in scope within body', () => {
    const diags = warnings('for i ∈ range(3) {\n  print(i)\n}');
    expect(diags.filter(d => d.rule === 'no-undef')).toHaveLength(0);
  });

  it('convenience lint() function works', () => {
    const diags = lint('print("hello")');
    expect(diags).toHaveLength(0);
  });

  it('handles break/continue unreachable detection', () => {
    const src = `
for i ∈ range(10) {
  break
  print(i)
}
`;
    const diags = warnings(src);
    expect(diags.some(d => d.rule === 'no-unreachable')).toBe(true);
  });
});
