import { describe, it, expect } from 'bun:test';
import { Lexer } from '../src/lexer/index.js';
import { Parser } from '../src/parser/index.js';
import type * as AST from '../src/ast/nodes.js';

function parseNXL(source: string): AST.Program {
  const tokens = new Lexer(source).tokenize();
  return new Parser(tokens, source).parse();
}

function firstStmt(source: string): AST.Statement {
  const program = parseNXL(source);
  return program.body[0];
}

describe('Parser', () => {
  describe('pipeline statements', () => {
    it('parses basic pipeline with membership', () => {
      const stmt = firstStmt('tasks → select ∈(ready)') as AST.PipelineStatement;
      expect(stmt.kind).toBe('PipelineStatement');
      expect((stmt.source as AST.Identifier).name).toBe('tasks');
      expect(stmt.selector.filters).toHaveLength(1);
      const filter = stmt.selector.filters[0] as AST.MembershipExpression;
      expect(filter.kind).toBe('MembershipExpression');
      expect(filter.category).toBe('ready');
      expect(filter.negated).toBe(false);
    });

    it('parses pipeline with multiple filters', () => {
      const stmt = firstStmt('tasks → select ∈(ready) ∩ ¬(blocked) ∩ priority>5') as AST.PipelineStatement;
      expect(stmt.selector.filters).toHaveLength(3);
      expect((stmt.selector.filters[0] as AST.MembershipExpression).category).toBe('ready');
      expect((stmt.selector.filters[1] as AST.MembershipExpression).negated).toBe(true);
      expect((stmt.selector.filters[2] as AST.BinaryExpression).op).toBe('>');
    });

    it('parses pipeline with ASCII fallbacks', () => {
      const stmt = firstStmt('tasks -> select ∈(ready) && ¬(blocked)') as AST.PipelineStatement;
      expect(stmt.kind).toBe('PipelineStatement');
      expect(stmt.selector.filters).toHaveLength(2);
    });
  });

  describe('conditional statements', () => {
    it('parses basic conditional', () => {
      const stmt = firstStmt('priority>5 ⇒ exec:immediate') as AST.ConditionalStatement;
      expect(stmt.kind).toBe('ConditionalStatement');
      expect((stmt.condition as AST.BinaryExpression).op).toBe('>');
      expect(stmt.actions).toHaveLength(1);
      expect(stmt.actions[0].name).toBe('exec');
    });

    it('parses conditional with multiple actions', () => {
      const stmt = firstStmt('priority>5 ⇒ exec:immediate | log:high') as AST.ConditionalStatement;
      expect(stmt.actions).toHaveLength(2);
      expect(stmt.actions[0].name).toBe('exec');
      expect(stmt.actions[1].name).toBe('log');
    });

    it('parses conditional with ASCII =>', () => {
      const stmt = firstStmt('x>0 => action:run') as AST.ConditionalStatement;
      expect(stmt.kind).toBe('ConditionalStatement');
    });
  });

  describe('composition statements', () => {
    it('parses basic composition', () => {
      const stmt = firstStmt('retrieve ∘ validate ∘ transform ∘ store') as AST.CompositionStatement;
      expect(stmt.kind).toBe('CompositionStatement');
      expect(stmt.functions).toEqual(['retrieve', 'validate', 'transform', 'store']);
    });

    it('parses composition with |> syntax', () => {
      const stmt = firstStmt('retrieve |> validate |> transform') as AST.CompositionStatement;
      expect(stmt.functions).toEqual(['retrieve', 'validate', 'transform']);
    });
  });

  describe('assignment statements', () => {
    it('parses simple assignment', () => {
      const stmt = firstStmt('x = 42') as AST.AssignmentStatement;
      expect(stmt.kind).toBe('AssignmentStatement');
      expect(stmt.name).toBe('x');
      expect((stmt.value as AST.NumberLiteral).value).toBe(42);
    });

    it('parses string assignment', () => {
      const stmt = firstStmt('name = "alice"') as AST.AssignmentStatement;
      expect(stmt.name).toBe('name');
      expect((stmt.value as AST.StringLiteral).value).toBe('alice');
    });
  });

  describe('shorthand expressions', () => {
    it('parses query shorthand', () => {
      const stmt = firstStmt('mem?[query, recent=10, threshold=0.7]') as AST.ExpressionStatement;
      const expr = stmt.expression as AST.ShorthandExpression;
      expect(expr.kind).toBe('ShorthandExpression');
      expect(expr.name).toBe('mem');
      expect(expr.suffix).toBe('?');
      expect(expr.args).toHaveLength(3);
      expect(expr.args[0].name).toBeNull();
      expect(expr.args[1].name).toBe('recent');
      expect(expr.args[2].name).toBe('threshold');
    });

    it('parses bang shorthand', () => {
      const stmt = firstStmt('hire![role, budget=500]') as AST.ExpressionStatement;
      const expr = stmt.expression as AST.ShorthandExpression;
      expect(expr.name).toBe('hire');
      expect(expr.suffix).toBe('!');
      expect(expr.args).toHaveLength(2);
    });

    it('parses at shorthand', () => {
      const stmt = firstStmt('exec@[mode=parallel, timeout=30s]') as AST.ExpressionStatement;
      const expr = stmt.expression as AST.ShorthandExpression;
      expect(expr.name).toBe('exec');
      expect(expr.suffix).toBe('@');
    });
  });

  describe('expressions', () => {
    it('parses binary arithmetic', () => {
      const stmt = firstStmt('x = 2 + 3 * 4') as AST.AssignmentStatement;
      const expr = stmt.value as AST.BinaryExpression;
      expect(expr.op).toBe('+');
      expect((expr.right as AST.BinaryExpression).op).toBe('*');
    });

    it('parses member expressions', () => {
      const stmt = firstStmt('agent.status') as AST.ExpressionStatement;
      const expr = stmt.expression as AST.MemberExpression;
      expect(expr.kind).toBe('MemberExpression');
      expect(expr.property).toBe('status');
    });

    it('parses function calls', () => {
      const stmt = firstStmt('process(x, y)') as AST.ExpressionStatement;
      const expr = stmt.expression as AST.CallExpression;
      expect(expr.kind).toBe('CallExpression');
      expect(expr.args).toHaveLength(2);
    });

    it('parses array literals', () => {
      const stmt = firstStmt('x = [1, 2, 3]') as AST.AssignmentStatement;
      const arr = stmt.value as AST.ArrayLiteral;
      expect(arr.kind).toBe('ArrayLiteral');
      expect(arr.elements).toHaveLength(3);
    });
  });

  describe('TOON blocks', () => {
    it('parses a TOON block with count', () => {
      const source = `agents[3]{id,status,tasks}:\nagt-001,active,12\nagt-002,idle,0\nagt-003,busy,8`;
      const stmt = firstStmt(source) as AST.ToonBlock;
      expect(stmt.kind).toBe('ToonBlock');
      expect(stmt.name).toBe('agents');
      expect(stmt.count).toBe(3);
      expect(stmt.fields).toEqual(['id', 'status', 'tasks']);
      expect(stmt.rows).toHaveLength(3);
      expect(stmt.rows[0].values).toEqual(['agt-001', 'active', 12]);
    });

    it('parses TOON block without count', () => {
      const source = `config{key,value}:\nhost,"localhost"\nport,8080`;
      const stmt = firstStmt(source) as AST.ToonBlock;
      expect(stmt.count).toBeNull();
      expect(stmt.fields).toEqual(['key', 'value']);
      expect(stmt.rows).toHaveLength(2);
    });

    it('parses TOON with boolean values', () => {
      const source = `flags{name,enabled}:\ndebug,true\nverbose,false`;
      const stmt = firstStmt(source) as AST.ToonBlock;
      expect(stmt.rows[0].values).toEqual(['debug', true]);
      expect(stmt.rows[1].values).toEqual(['verbose', false]);
    });
  });

  describe('type declarations (AST folding)', () => {
    it('parses a type with folded methods', () => {
      const source = `Agent{id,role}{\n  init(config:Config): ...\n  execute(task:Task): ...\n}`;
      const stmt = firstStmt(source) as AST.TypeDeclaration;
      expect(stmt.kind).toBe('TypeDeclaration');
      expect(stmt.name).toBe('Agent');
      expect(stmt.fields).toEqual(['id', 'role']);
      expect(stmt.methods).toHaveLength(2);
      expect(stmt.methods[0].name).toBe('init');
      expect(stmt.methods[0].folded).toBe(true);
      expect(stmt.methods[0].params[0].name).toBe('config');
      expect(stmt.methods[0].params[0].typeAnnotation?.name).toBe('Config');
    });

    it('parses method with return type', () => {
      const source = `Svc{}{fetch(url:str):Response: ...}`;
      const stmt = firstStmt(source) as AST.TypeDeclaration;
      expect(stmt.methods[0].returnType?.name).toBe('Response');
    });

    it('parses method with generic type', () => {
      const source = `Store{}{get(key:str):Option<Value>: ...}`;
      const stmt = firstStmt(source) as AST.TypeDeclaration;
      const ret = stmt.methods[0].returnType!;
      expect(ret.name).toBe('Option');
      expect(ret.typeArgs[0].name).toBe('Value');
    });
  });

  describe('multiple statements', () => {
    it('parses multiple newline-separated statements', () => {
      const source = `x = 10\ny = 20\nresult = x + y`;
      const program = parseNXL(source);
      expect(program.body).toHaveLength(3);
    });
  });

  describe('error handling', () => {
    it('throws on unexpected token', () => {
      expect(() => parseNXL(')')).toThrow();
    });
  });
});
