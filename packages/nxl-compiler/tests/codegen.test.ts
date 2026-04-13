import { describe, it, expect } from 'bun:test';
import { compile } from '../src/compiler.js';

function py(source: string): string {
  return compile(source, 'python').output.trim();
}

function js(source: string): string {
  return compile(source, 'javascript').output.trim();
}

describe('Python Code Generator', () => {
  it('compiles pipeline to list comprehension', () => {
    const result = py('tasks → select ∈(ready) ∩ ¬(blocked)');
    expect(result).toContain('item for item in tasks');
    expect(result).toContain("item.status == 'ready'");
    expect(result).toContain('not item.blocked');
  });

  it('compiles conditional to if statement', () => {
    const result = py('priority>5 ⇒ exec:immediate | log:high');
    expect(result).toContain('if priority > 5:');
    expect(result).toContain('exec(immediate)');
    expect(result).toContain('log(high)');
  });

  it('compiles composition to nested calls', () => {
    const result = py('retrieve ∘ validate ∘ transform ∘ store');
    expect(result).toBe('store(transform(validate(retrieve())))');
  });

  it('compiles assignment', () => {
    const result = py('x = 42');
    expect(result).toBe('x = 42');
  });

  it('compiles shorthand mem? to memory.search', () => {
    const result = py('mem?[query, recent=10, threshold=0.7]');
    expect(result).toContain('memory.search(query, recent=10, threshold=0.7)');
  });

  it('compiles shorthand hire! to agent.spawn', () => {
    const result = py('hire![admin, budget=500]');
    expect(result).toContain('agent.spawn(admin, budget=500)');
  });

  it('compiles TOON block to dataclass + list', () => {
    const source = `agents[2]{id,status}:\nagt-001,active\nagt-002,idle`;
    const result = py(source);
    expect(result).toContain('from dataclasses import dataclass');
    expect(result).toContain('class Agents:');
    expect(result).toContain("id='agt-001'");
    expect(result).toContain("status='active'");
  });

  it('compiles type declaration to class', () => {
    const source = `Agent{id,role}{\n  init(config:Config): ...\n  execute(task:Task): ...\n}`;
    const result = py(source);
    expect(result).toContain('class Agent:');
    expect(result).toContain('def __init__(self, id=None, role=None):');
    expect(result).toContain('def init(self, config):');
    expect(result).toContain('def execute(self, task):');
    expect(result).toContain('pass');
  });

  it('compiles boolean literals to Python style', () => {
    const result = py('x = true');
    expect(result).toBe('x = True');
  });
});

describe('JavaScript Code Generator', () => {
  it('compiles pipeline to filter', () => {
    const result = js('tasks → select ∈(ready) ∩ ¬(blocked)');
    expect(result).toContain('.filter(item =>');
    expect(result).toContain("item.status === 'ready'");
    expect(result).toContain('!item.blocked');
  });

  it('compiles conditional to if block', () => {
    const result = js('priority>5 ⇒ exec:immediate');
    expect(result).toContain('if (priority > 5) {');
    expect(result).toContain('exec(immediate);');
  });

  it('compiles composition to nested calls', () => {
    const result = js('retrieve ∘ validate ∘ store');
    expect(result).toBe('store(validate(retrieve()));');
  });

  it('compiles assignment with const', () => {
    const result = js('x = 42');
    expect(result).toBe('const x = 42;');
  });

  it('compiles TOON to object array', () => {
    const source = `data[1]{name,value}:\nfoo,42`;
    const result = js(source);
    expect(result).toContain('const data = [');
    expect(result).toContain("name: 'foo'");
    expect(result).toContain('value: 42');
  });

  it('compiles type declaration to class', () => {
    const source = `Svc{name}{\n  run(cmd:str): ...\n}`;
    const result = js(source);
    expect(result).toContain('class Svc {');
    expect(result).toContain('constructor(name)');
    expect(result).toContain('this.name = name;');
    expect(result).toContain('run(cmd)');
  });

  it('uses === instead of ==', () => {
    const result = js('x = a == b');
    expect(result).toContain('===');
  });

  it('compiles shorthand with named args to object', () => {
    const result = js('mem?[query, recent=10]');
    expect(result).toContain('memory.search({ query, recent: 10 })');
  });
});
