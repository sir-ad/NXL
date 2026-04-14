import { describe, it, expect, beforeEach } from 'bun:test';
import { Memory } from '../src/memory.js';
import { ToolRegistry } from '../src/tools.js';
import { createRuntime } from '../src/index.js';
import { mkString, mkNumber, display } from '@nxl/interpreter';

// ===== Memory =====

describe('Memory', () => {
  let mem: Memory;

  beforeEach(() => { mem = new Memory(); });

  it('inserts and returns an id', () => {
    const id = mem.insert('hello world');
    expect(id).toMatch(/^mem_\d+$/);
  });

  it('searches and finds inserted entry', () => {
    mem.insert('the weather in San Francisco is sunny');
    const results = mem.search('weather San Francisco');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].text).toContain('San Francisco');
  });

  it('identical text has higher similarity than unrelated text', () => {
    mem.insert('completely unrelated content about zebras in Africa savannah');
    mem.insert('machine learning transformer models for NLP tasks');
    const q = 'machine learning transformer models for NLP tasks';
    const results = mem.search(q, { topK: 2 });
    // The matching entry should score higher than the unrelated one
    expect(results[0].text).toContain('machine learning');
  });

  it('ranks semantically similar results higher', () => {
    mem.insert('the capital of France is Paris');
    mem.insert('Python is a programming language');
    mem.insert('Paris is a beautiful city in France');
    const results = mem.search('France capital city', { topK: 3 });
    // Paris-related entries should rank higher
    const texts = results.map(r => r.text);
    expect(texts[0]).toContain('France');
  });

  it('respects topK limit', () => {
    for (let i = 0; i < 10; i++) mem.insert(`entry ${i} about computers`);
    const results = mem.search('computers', { topK: 3 });
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it('tracks size', () => {
    expect(mem.size()).toBe(0);
    mem.insert('a'); mem.insert('b');
    expect(mem.size()).toBe(2);
    mem.clear();
    expect(mem.size()).toBe(0);
  });
});

// ===== ToolRegistry =====

describe('ToolRegistry', () => {
  it('registers and invokes a tool', async () => {
    const reg = new ToolRegistry();
    reg.register('add', 'Add two numbers', (args) => {
      const a = args['a']?.kind === 'number' ? args['a'].value : 0;
      const b = args['b']?.kind === 'number' ? args['b'].value : 0;
      return mkNumber(a + b);
    });

    const result = await reg.invoke('add', { a: mkNumber(3), b: mkNumber(4) }, []);
    expect(result).toMatchObject({ kind: 'number', value: 7 });
  });

  it('throws on unknown tool', async () => {
    const reg = new ToolRegistry();
    await expect(reg.invoke('unknown', {}, [])).rejects.toThrow("Unknown tool: 'unknown'");
  });
});

// ===== createRuntime =====

describe('createRuntime', () => {
  it('creates an interpreter with shorthand handlers', () => {
    const { interp, shorthand } = createRuntime();
    expect(shorthand.has('mem', '?')).toBe(true);
    expect(shorthand.has('mem', '!')).toBe(true);
    expect(shorthand.has('tool', '!')).toBe(true);
    expect(shorthand.has('llm', '@')).toBe(true);
  });

  it('mem! and mem? round-trip', async () => {
    const { interp } = createRuntime();
    const src = `
mem!["NXL is a token-efficient language for agents"]
mem!["The weather today is sunny and warm"]
results = mem?["token efficient language"]
len(results)
`;
    const { parse } = await import('@nxl/core');
    const prog = parse(src);
    const v = await interp.run(prog, src);
    // Should find at least one result
    expect(v.kind).toBe('number');
    if (v.kind === 'number') {
      expect(v.value).toBeGreaterThan(0);
    }
  });

  it('tool! invokes registered tool', async () => {
    const { interp } = createRuntime();
    const src = `tool!["get_weather", city="London"]`;
    const { parse } = await import('@nxl/core');
    const prog = parse(src);
    const v = await interp.run(prog, src);
    expect(v.kind).toBe('dict');
    if (v.kind === 'dict') {
      expect(v.entries.get('city')?.kind).toBe('string');
    }
  });

  it('llm@ returns stub when no API key', async () => {
    const { interp } = createRuntime({ anthropicKey: undefined });
    const src = `llm@[prompt="Say hello"]`;
    const { parse } = await import('@nxl/core');
    const prog = parse(src);
    const v = await interp.run(prog, src);
    expect(v.kind).toBe('string');
    if (v.kind === 'string') {
      expect(v.value).toContain('stub');
    }
  });
});
