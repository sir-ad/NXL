import { describe, it, expect } from 'bun:test';
import { serialize, deserialize } from '../src/index.js';
import type { ToonRecord } from '../src/types.js';

describe('TOON', () => {
  describe('serialize', () => {
    it('serializes basic records', () => {
      const records: ToonRecord[] = [
        { id: 'agt-001', status: 'active', tasks: 12 },
        { id: 'agt-002', status: 'idle', tasks: 0 },
      ];
      const result = serialize(records, { name: 'agents' });
      expect(result).toBe(
        'agents[2]{id,status,tasks}:\nagt-001,active,12\nagt-002,idle,0'
      );
    });

    it('serializes with boolean values', () => {
      const records: ToonRecord[] = [
        { name: 'debug', enabled: true },
        { name: 'verbose', enabled: false },
      ];
      const result = serialize(records, { name: 'flags' });
      expect(result).toContain('debug,true');
      expect(result).toContain('verbose,false');
    });

    it('serializes empty array', () => {
      expect(serialize([])).toBe('');
    });

    it('quotes strings containing commas', () => {
      const records: ToonRecord[] = [
        { name: 'hello, world', value: 42 },
      ];
      const result = serialize(records, { name: 'data' });
      expect(result).toContain('"hello, world"');
    });
  });

  describe('deserialize', () => {
    it('deserializes basic TOON', () => {
      const input = 'agents[3]{id,status,tasks}:\nagt-001,active,12\nagt-002,idle,0\nagt-003,busy,8';
      const { schema, records } = deserialize(input);
      expect(schema.name).toBe('agents');
      expect(schema.count).toBe(3);
      expect(schema.fields.map(f => f.name)).toEqual(['id', 'status', 'tasks']);
      expect(records).toHaveLength(3);
      expect(records[0]).toEqual({ id: 'agt-001', status: 'active', tasks: 12 });
    });

    it('deserializes without count', () => {
      const input = 'config{key,value}:\nhost,localhost\nport,8080';
      const { schema, records } = deserialize(input);
      expect(schema.count).toBeNull();
      expect(records).toHaveLength(2);
      expect(records[1]).toEqual({ key: 'port', value: 8080 });
    });

    it('deserializes booleans', () => {
      const input = 'flags{name,enabled}:\ndebug,true\nverbose,false';
      const { records } = deserialize(input);
      expect(records[0].enabled).toBe(true);
      expect(records[1].enabled).toBe(false);
    });

    it('deserializes nulls', () => {
      const input = 'data{a,b}:\nfoo,null\nbar,42';
      const { records } = deserialize(input);
      expect(records[0].b).toBeNull();
      expect(records[1].b).toBe(42);
    });

    it('handles quoted strings', () => {
      const input = 'data{name,desc}:\nfoo,"hello, world"\nbar,simple';
      const { records } = deserialize(input);
      expect(records[0].desc).toBe('hello, world');
    });
  });

  describe('roundtrip', () => {
    it('serialize then deserialize preserves data', () => {
      const original: ToonRecord[] = [
        { id: 1, name: 'alice', active: true },
        { id: 2, name: 'bob', active: false },
        { id: 3, name: 'charlie', active: true },
      ];
      const toon = serialize(original, { name: 'users' });
      const { records } = deserialize(toon);
      expect(records).toEqual(original);
    });

    it('roundtrips with various types', () => {
      const original: ToonRecord[] = [
        { count: 0, ratio: 0.5, label: 'test', flag: true },
      ];
      const toon = serialize(original, { name: 'mixed' });
      const { records } = deserialize(toon);
      expect(records).toEqual(original);
    });
  });

  describe('token efficiency', () => {
    it('is significantly shorter than JSON equivalent', () => {
      const records: ToonRecord[] = [
        { id: 'agt-001', status: 'active', tasks: 12, memory: 450 },
        { id: 'agt-002', status: 'idle', tasks: 0, memory: 120 },
        { id: 'agt-003', status: 'busy', tasks: 8, memory: 890 },
      ];
      const toon = serialize(records, { name: 'agents' });
      const json = JSON.stringify({ agents: records });

      // TOON should be significantly shorter
      expect(toon.length).toBeLessThan(json.length);
      // At least 30% shorter
      expect(toon.length / json.length).toBeLessThan(0.7);
    });
  });
});
