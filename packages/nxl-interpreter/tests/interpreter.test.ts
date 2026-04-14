import { describe, it, expect } from 'bun:test';
import { interpret } from '../src/index.js';
import { display } from '../src/values.js';

async function run(source: string): Promise<string> {
  const v = await interpret(source);
  return display(v);
}

async function val(source: string) {
  return interpret(source);
}

// ===== Literals =====

describe('literals', () => {
  it('number', async () => expect(await run('42')).toBe('42'));
  it('float', async () => expect(await run('3.14')).toBe('3.14'));
  it('string', async () => expect(await run('"hello"')).toBe('hello'));
  it('bool true', async () => expect(await run('true')).toBe('true'));
  it('bool false', async () => expect(await run('false')).toBe('false'));
  it('null', async () => expect(await run('null')).toBe('null'));
  it('array', async () => expect(await run('[1, 2, 3]')).toBe('[1, 2, 3]'));
  it('empty array', async () => expect(await run('[]')).toBe('[]'));
});

// ===== Arithmetic =====

describe('arithmetic', () => {
  it('addition', async () => expect(await run('1 + 2')).toBe('3'));
  it('subtraction', async () => expect(await run('10 - 3')).toBe('7'));
  it('multiplication', async () => expect(await run('4 * 5')).toBe('20'));
  it('division', async () => expect(await run('10 / 4')).toBe('2.5'));
  it('modulo', async () => expect(await run('10 % 3')).toBe('1'));
  it('exponent', async () => expect(await run('2 ** 8')).toBe('256'));
  it('string concat', async () => expect(await run('"hello" + " " + "world"')).toBe('hello world'));
  it('list concat', async () => expect(await run('[1,2] + [3,4]')).toBe('[1, 2, 3, 4]'));
  it('division by zero', async () => {
    await expect(interpret('1 / 0')).rejects.toThrow('Division by zero');
  });
});

// ===== Comparison =====

describe('comparison', () => {
  it('equal numbers', async () => expect(await run('5 == 5')).toBe('true'));
  it('not equal', async () => expect(await run('5 != 3')).toBe('true'));
  it('less than', async () => expect(await run('3 < 5')).toBe('true'));
  it('greater than', async () => expect(await run('5 > 3')).toBe('true'));
  it('less or equal', async () => expect(await run('5 <= 5')).toBe('true'));
  it('greater or equal', async () => expect(await run('6 >= 5')).toBe('true'));
  it('equal strings', async () => expect(await run('"a" == "a"')).toBe('true'));
});

// ===== Logical =====

describe('logical', () => {
  it('and short-circuit (false)', async () => expect(await run('false && true')).toBe('false'));
  it('and short-circuit (true)', async () => expect(await run('true && true')).toBe('true'));
  it('or short-circuit (true)', async () => expect(await run('true || false')).toBe('true'));
  it('or returns first truthy', async () => expect(await run('false || "hello"')).toBe('hello'));
  it('not', async () => expect(await run('!false')).toBe('true'));
  it('not truthy', async () => expect(await run('!0')).toBe('true'));
});

// ===== Assignment =====

describe('assignment', () => {
  it('simple assign', async () => expect(await run('x = 5\nx')).toBe('5'));
  it('string assign', async () => expect(await run('name = "NXL"\nname')).toBe('NXL'));
  it('reassign', async () => expect(await run('x = 1\nx = x + 1\nx')).toBe('2'));
});

// ===== Builtins =====

describe('builtins', () => {
  it('len list', async () => expect(await run('len([1,2,3])')).toBe('3'));
  it('len string', async () => expect(await run('len("hello")')).toBe('5'));
  it('range(n)', async () => expect(await run('range(5)')).toBe('[0, 1, 2, 3, 4]'));
  it('range(start,end)', async () => expect(await run('range(2,5)')).toBe('[2, 3, 4]'));
  it('str', async () => expect(await run('str(42)')).toBe('42'));
  it('num', async () => expect(await run('num("3.14")')).toBe('3.14'));
  it('type', async () => expect(await run('type(42)')).toBe('number'));
  it('type string', async () => expect(await run('type("hi")')).toBe('string'));
  it('abs', async () => expect(await run('abs(-5)')).toBe('5'));
  it('floor', async () => expect(await run('floor(3.9)')).toBe('3'));
  it('ceil', async () => expect(await run('ceil(3.1)')).toBe('4'));
  it('round', async () => expect(await run('round(3.5)')).toBe('4'));
  it('max list', async () => expect(await run('max([3,1,4,1,5])')).toBe('5'));
  it('min list', async () => expect(await run('min([3,1,4,1,5])')).toBe('1'));
  it('sum', async () => expect(await run('sum([1,2,3,4,5])')).toBe('15'));
  it('push', async () => expect(await run('a=[1,2]\npush(a,3)\na')).toBe('[1, 2, 3]'));
  it('pop', async () => expect(await run('a=[1,2,3]\npop(a)')).toBe('3'));
  it('keys', async () => {
    const v = await val(`keys(json_decode('{"a":1,"b":2}'))`);
    expect(v.kind).toBe('list');
  });
  it('split', async () => expect(await run('split("a,b,c", ",")')).toBe('[a, b, c]'));
  it('join', async () => expect(await run('join(["a","b","c"], "-")')).toBe('a-b-c'));
  it('upper', async () => expect(await run('upper("hello")')).toBe('HELLO'));
  it('lower', async () => expect(await run('lower("HELLO")')).toBe('hello'));
  it('trim', async () => expect(await run('trim("  hi  ")')).toBe('hi'));
});

// ===== Member access =====

describe('member access', () => {
  it('dict field', async () => {
    const v = await val('d = json_decode(\'{"x": 42}\')\nd.x');
    expect(v).toMatchObject({ kind: 'number', value: 42 });
  });
  it('missing field returns null', async () => {
    const v = await val('d = json_decode(\'{"x": 1}\')\nd.y');
    expect(v.kind).toBe('null');
  });
  it('list length', async () => expect(await run('[1,2,3].length')).toBe('3'));
  it('string length', async () => expect(await run('"hello".length')).toBe('5'));
});

// ===== Pipeline =====

describe('pipeline', () => {
  it('filters list', async () => {
    const v = await run('items = [1,2,3,4,5]\nitems → select x>2');
    expect(v).toBe('[3, 4, 5]');
  });
  it('empty result', async () => {
    const v = await run('[1,2,3] → select x>10');
    expect(v).toBe('[]');
  });
});

// ===== TOON Block =====

describe('toon block', () => {
  it('produces list of dicts', async () => {
    const src = `Users[3]{name,age}:\n"Alice",30\n"Bob",25\n"Carol",35`;
    const v = await val(src);
    expect(v.kind).toBe('list');
    if (v.kind === 'list') {
      expect(v.items.length).toBe(3);
      const alice = v.items[0];
      expect(alice.kind).toBe('dict');
      if (alice.kind === 'dict') {
        expect(alice.entries.get('name')).toMatchObject({ kind: 'string', value: 'Alice' });
        expect(alice.entries.get('age')).toMatchObject({ kind: 'number', value: 30 });
      }
    }
  });
});

// ===== Type declaration =====

describe('type declaration', () => {
  it('creates constructor', async () => {
    // NXL TypeDeclaration syntax: Name{fields}{methods}
    const src = `Point{x,y}{}\np = Point(3, 4)\np.x`;
    const v = await val(src);
    expect(v).toMatchObject({ kind: 'number', value: 3 });
  });
});

// ===== Errors =====

describe('errors', () => {
  it('undefined variable', async () => {
    await expect(interpret('unknownVar')).rejects.toThrow("Undefined variable 'unknownVar'");
  });
  it('type error in arithmetic', async () => {
    await expect(interpret('"hi" - 1')).rejects.toThrow();
  });
  it('call non-function', async () => {
    await expect(interpret('x = 5\nx()')).rejects.toThrow();
  });
  it('division by zero', async () => {
    await expect(interpret('10 / 0')).rejects.toThrow('Division by zero');
  });
  it('pop empty list', async () => {
    await expect(interpret('pop([])')).rejects.toThrow('empty');
  });
});

// ===== Conditional statement =====

describe('conditional', () => {
  it('runs actions when true', async () => {
    const src = `
x = 0
5 > 3 ⇒ x: x + 10
x
`;
    expect(await run(src)).toBe('10');
  });
  it('skips when false', async () => {
    const src = `
x = 0
5 < 3 ⇒ x: x + 10
x
`;
    expect(await run(src)).toBe('0');
  });
});

// ===== JSON builtins =====

describe('json', () => {
  it('encode and decode round-trip', async () => {
    const src = `
data = json_decode('{"name":"NXL","version":1}')
data.name
`;
    expect(await run(src)).toBe('NXL');
  });

  it('encode', async () => {
    const v = await val('json_encode([1,2,3])');
    expect(v).toMatchObject({ kind: 'string', value: '[1,2,3]' });
  });
});
