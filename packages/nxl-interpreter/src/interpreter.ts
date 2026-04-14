import type {
  Program,
  Statement,
  Expression,
  PipelineStatement,
  ConditionalStatement,
  CompositionStatement,
  AssignmentStatement,
  ExpressionStatement,
  BinaryExpression,
  UnaryExpression,
  MembershipExpression,
  ShorthandExpression,
  CallExpression,
  MemberExpression,
  Identifier,
  NumberLiteral,
  StringLiteral,
  BooleanLiteral,
  ArrayLiteral,
  ToonBlock,
  TypeDeclaration,
  FilterExpression,
  // Phase 2
  FunctionDeclaration,
  IfStatement,
  ForStatement,
  WhileStatement,
  ReturnStatement,
  BlockStatement,
  FunctionExpression,
  IfExpression,
  MatchExpression,
  // Phase 4
  UseStatement,
  PubStatement,
} from '@nxl/core';
import { parse } from '@nxl/core';

import {
  mkNumber, mkString, mkBool, mkList, mkDict, mkDictFromObj, mkNative,
  NULL, truthy, equals, display,
  type Value, type FunctionValue,
} from './values.js';
import { Environment } from './environment.js';
import { RuntimeError, TypeError } from './errors.js';
import { ReturnSignal, BreakSignal, ContinueSignal } from './signals.js';
import { registerBuiltins } from './builtins.js';
import { ShorthandRegistry, createStubRegistry } from './shorthand.js';

export class Interpreter {
  readonly globals: Environment;
  readonly shorthand: ShorthandRegistry;
  private source: string = '';

  constructor(shorthand?: ShorthandRegistry) {
    this.globals = new Environment();
    this.shorthand = shorthand ?? createStubRegistry();
    registerBuiltins(this.globals);
  }

  async run(program: Program, source = ''): Promise<Value> {
    this.source = source;
    return this.execProgram(program, this.globals);
  }

  async runInEnv(program: Program, env: Environment, source = ''): Promise<Value> {
    this.source = source;
    return this.execProgram(program, env);
  }

  // ===== Program =====

  private async execProgram(program: Program, env: Environment): Promise<Value> {
    let last: Value = NULL;
    for (const stmt of program.body) {
      last = await this.execStatement(stmt, env);
    }
    return last;
  }

  // ===== Statements =====

  async execStatement(stmt: Statement, env: Environment): Promise<Value> {
    switch (stmt.kind) {
      case 'AssignmentStatement': return this.execAssignment(stmt, env);
      case 'ExpressionStatement': return this.execExpressionStatement(stmt, env);
      case 'PipelineStatement': return this.execPipeline(stmt, env);
      case 'ConditionalStatement': return this.execConditional(stmt, env);
      case 'CompositionStatement': return this.execComposition(stmt, env);
      case 'ToonBlock': return this.execToonBlock(stmt, env);
      case 'TypeDeclaration': return this.execTypeDeclaration(stmt, env);
      // Phase 2
      case 'FunctionDeclaration': return this.execFunctionDeclaration(stmt, env);
      case 'IfStatement': return this.execIfStatement(stmt, env);
      case 'ForStatement': return this.execForStatement(stmt, env);
      case 'WhileStatement': return this.execWhileStatement(stmt, env);
      case 'ReturnStatement': return this.execReturnStatement(stmt, env);
      case 'BreakStatement': throw new BreakSignal();
      case 'ContinueStatement': throw new ContinueSignal();
      case 'BlockStatement': return this.execBlock(stmt.statements, env);
      // Phase 4
      case 'UseStatement': return this.execUseStatement(stmt, env);
      case 'PubStatement': return this.execPubStatement(stmt, env);
    }
  }

  private async execAssignment(stmt: AssignmentStatement, env: Environment): Promise<Value> {
    const value = await this.evalExpr(stmt.value, env);
    if (env.has(stmt.name)) {
      // Variable exists somewhere in the scope chain — update it there (closure semantics)
      env.assign(stmt.name, value);
    } else {
      // First assignment — define it in the current (local) scope
      env.define(stmt.name, value);
    }
    return value;
  }

  private async execExpressionStatement(stmt: ExpressionStatement, env: Environment): Promise<Value> {
    return this.evalExpr(stmt.expression, env);
  }

  private async execPipeline(stmt: PipelineStatement, env: Environment): Promise<Value> {
    const source = await this.evalExpr(stmt.source, env);
    if (source.kind !== 'list') {
      throw new TypeError(
        `Pipeline source must be a list, got ${source.kind}`,
        stmt.loc,
        this.source
      );
    }

    let result = source.items;
    for (const filter of stmt.selector.filters) {
      result = await this.applyFilter(result, filter, env);
    }
    const out = mkList(result);
    // If the pipeline result is assigned, it's an expression in assignment context.
    // Otherwise the last result lives on the stack.
    return out;
  }

  private async applyFilter(items: Value[], filter: FilterExpression, env: Environment): Promise<Value[]> {
    const f = filter as any;

    if (f.kind === 'MembershipExpression') {
      // ∈(category) — filter items belonging to the named category
      const catName: string = f.category;
      const negated: boolean = f.negated;
      const catVal = env.has(catName) ? env.get(catName) : null;
      return items.filter(item => {
        if (catVal && catVal.kind === 'list') {
          const inCat = catVal.items.some(c => equals(c, item));
          return negated ? !inCat : inCat;
        }
        return !negated; // unknown category — pass through
      });
    }

    // General expression filter: evaluate the expression with 'x' bound to each item
    return (await Promise.all(
      items.map(async (item) => {
        const childEnv = env.child();
        childEnv.define('x', item);
        const result = await this.evalExpr(filter as Expression, childEnv);
        return truthy(result) ? item : null;
      })
    )).filter((v): v is Value => v !== null);
  }

  private async execConditional(stmt: ConditionalStatement, env: Environment): Promise<Value> {
    const cond = await this.evalExpr(stmt.condition, env);
    if (!truthy(cond)) return NULL;

    let result: Value = NULL;
    for (const action of stmt.actions) {
      const val = await this.evalExpr(action.value, env);
      // Actions modify environment bindings by name
      env.assign(action.name, val);
      result = val;
    }
    return result;
  }

  private async execComposition(stmt: CompositionStatement, env: Environment): Promise<Value> {
    // Creates a composed function value: f ∘ g ∘ h = x → h(g(f(x)))
    const fns = stmt.functions.map(name => {
      if (!env.has(name)) throw new RuntimeError(`Composition: unknown function '${name}'`, stmt.loc, this.source);
      return env.get(name);
    });

    const composed = mkNative(`composed(${stmt.functions.join('∘')})`, async (args) => {
      let result: Value = args[0] ?? NULL;
      for (const fn of fns) {
        result = await this.callValue(fn, [result], stmt.loc);
      }
      return result;
    });

    // Bind to first function name as the composed result
    const composedName = stmt.functions.join('∘');
    env.define(composedName, composed);
    return composed;
  }

  private async execToonBlock(block: ToonBlock, env: Environment): Promise<Value> {
    const rows = block.rows.map(row => {
      const m = new Map<string, Value>();
      block.fields.forEach((field, i) => {
        const raw = row.values[i];
        if (raw === null || raw === undefined) {
          m.set(field, NULL);
        } else if (typeof raw === 'boolean') {
          m.set(field, mkBool(raw));
        } else if (typeof raw === 'number') {
          m.set(field, mkNumber(raw));
        } else {
          m.set(field, mkString(String(raw)));
        }
      });
      return mkDict(m);
    });

    const list = mkList(rows);
    env.define(block.name, list);
    return list;
  }

  private async execTypeDeclaration(decl: TypeDeclaration, env: Environment): Promise<Value> {
    // Register a constructor function: TypeName(field1, field2, ...) → dict
    const fields = decl.fields;
    const ctor = mkNative(decl.name, (args) => {
      const m = new Map<string, Value>();
      fields.forEach((field, i) => {
        m.set(field, args[i] ?? NULL);
      });
      m.set('__type__', mkString(decl.name));
      return mkDict(m);
    });
    env.define(decl.name, ctor);

    // Register method stubs (mark as unimplemented until Phase 2)
    for (const method of decl.methods) {
      if (!method.folded) {
        // Method body exists — stub for now, will be implemented in Phase 2
      }
    }
    return ctor;
  }

  // ===== Phase 2 Statements =====

  private async execFunctionDeclaration(stmt: FunctionDeclaration, env: Environment): Promise<Value> {
    const fn: FunctionValue = {
      kind: 'function',
      name: stmt.name,
      params: stmt.params,
      body: Array.isArray(stmt.body) ? stmt.body : [{ kind: 'ExpressionStatement', expression: stmt.body, loc: stmt.loc } as Statement],
      closure: env,
    };
    env.define(stmt.name, fn);
    return fn;
  }

  private async execIfStatement(stmt: IfStatement, env: Environment): Promise<Value> {
    const cond = await this.evalExpr(stmt.condition, env);
    if (truthy(cond)) {
      return this.execBlock(stmt.then, env.child());
    } else if (stmt.else) {
      return this.execBlock(stmt.else, env.child());
    }
    return NULL;
  }

  private async execForStatement(stmt: ForStatement, env: Environment): Promise<Value> {
    const iterable = await this.evalExpr(stmt.iterable, env);
    if (iterable.kind !== 'list') {
      throw new TypeError(`for: iterable must be a list, got ${iterable.kind}`, stmt.loc, this.source);
    }
    let last: Value = NULL;
    outer: for (const item of iterable.items) {
      const loopEnv = env.child();
      loopEnv.define(stmt.variable, item);
      try {
        last = await this.execBlock(stmt.body, loopEnv);
      } catch (e) {
        if (e instanceof BreakSignal) break outer;
        if (e instanceof ContinueSignal) continue;
        throw e;
      }
    }
    return last;
  }

  private async execWhileStatement(stmt: WhileStatement, env: Environment): Promise<Value> {
    let last: Value = NULL;
    while (true) {
      const cond = await this.evalExpr(stmt.condition, env);
      if (!truthy(cond)) break;
      try {
        last = await this.execBlock(stmt.body, env.child());
      } catch (e) {
        if (e instanceof BreakSignal) break;
        if (e instanceof ContinueSignal) continue;
        throw e;
      }
    }
    return last;
  }

  private async execReturnStatement(stmt: ReturnStatement, env: Environment): Promise<Value> {
    const value = stmt.value ? await this.evalExpr(stmt.value, env) : NULL;
    throw new ReturnSignal(value);
  }

  async execBlock(stmts: Statement[], env: Environment): Promise<Value> {
    let last: Value = NULL;
    for (const stmt of stmts) {
      last = await this.execStatement(stmt, env);
    }
    return last;
  }

  // ===== Expressions =====

  async evalExpr(expr: Expression, env: Environment): Promise<Value> {
    switch (expr.kind) {
      case 'NumberLiteral': return mkNumber(expr.value);
      case 'StringLiteral': return mkString(expr.value);
      case 'BooleanLiteral': return mkBool(expr.value);
      case 'NullLiteral': return NULL;
      case 'Identifier': return this.evalIdentifier(expr, env);
      case 'ArrayLiteral': return this.evalArray(expr, env);
      case 'BinaryExpression': return this.evalBinary(expr, env);
      case 'UnaryExpression': return this.evalUnary(expr, env);
      case 'MembershipExpression': return this.evalMembership(expr, env);
      case 'ShorthandExpression': return this.evalShorthand(expr, env);
      case 'CallExpression': return this.evalCall(expr, env);
      case 'MemberExpression': return this.evalMember(expr, env);
      // Phase 2
      case 'FunctionExpression':
      case 'IfExpression':
      case 'MatchExpression': return this.evalPhase2Expr(expr, env);
    }
  }

  private async evalPhase2Expr(expr: FunctionExpression | IfExpression | MatchExpression, env: Environment): Promise<Value> {
    switch (expr.kind) {
      case 'FunctionExpression': {
        const fn: FunctionValue = {
          kind: 'function',
          name: expr.name ?? null,
          params: expr.params,
          body: Array.isArray(expr.body) ? expr.body : [{ kind: 'ExpressionStatement', expression: expr.body, loc: expr.loc } as Statement],
          closure: env,
        };
        return fn;
      }
      case 'IfExpression': {
        const cond = await this.evalExpr(expr.condition, env);
        if (truthy(cond)) return this.evalExpr(expr.then, env);
        if (expr.else) return this.evalExpr(expr.else, env);
        return NULL;
      }
      case 'MatchExpression': {
        const subject = await this.evalExpr(expr.subject, env);
        for (const arm of expr.arms) {
          const matched = await this.matchPattern(arm.pattern, subject, env);
          if (matched !== null) {
            if (arm.guard) {
              const guard = await this.evalExpr(arm.guard, matched);
              if (!truthy(guard)) continue;
            }
            return this.evalExpr(arm.body, matched);
          }
        }
        return NULL;
      }
    }
  }

  private async matchPattern(pattern: import('@nxl/core').MatchPattern, subject: Value, env: Environment): Promise<Environment | null> {
    if (pattern.kind === 'WildcardPattern') {
      return env.child();
    }
    if (pattern.kind === 'NullLiteral') {
      return subject.kind === 'null' ? env.child() : null;
    }
    if (pattern.kind === 'NumberLiteral') {
      return subject.kind === 'number' && subject.value === pattern.value ? env.child() : null;
    }
    if (pattern.kind === 'StringLiteral') {
      return subject.kind === 'string' && subject.value === pattern.value ? env.child() : null;
    }
    if (pattern.kind === 'BooleanLiteral') {
      return subject.kind === 'bool' && subject.value === pattern.value ? env.child() : null;
    }
    if (pattern.kind === 'Identifier') {
      if (pattern.name === '_') return env.child(); // wildcard fallback
      // Capture binding: bind subject to pattern name
      const child = env.child();
      child.define(pattern.name, subject);
      return child;
    }
    return null;
  }

  private evalIdentifier(expr: Identifier, env: Environment): Value {
    try {
      return env.get(expr.name);
    } catch {
      throw new RuntimeError(`Undefined variable '${expr.name}'`, expr.loc, this.source);
    }
  }

  private async evalArray(expr: ArrayLiteral, env: Environment): Promise<Value> {
    const items: Value[] = [];
    for (const e of expr.elements) items.push(await this.evalExpr(e, env));
    return mkList(items);
  }

  private async evalBinary(expr: BinaryExpression, env: Environment): Promise<Value> {
    // Short-circuit logical operators
    if (expr.op === '&&' || expr.op === 'and') {
      const left = await this.evalExpr(expr.left, env);
      if (!truthy(left)) return left;
      return this.evalExpr(expr.right, env);
    }
    if (expr.op === '||' || expr.op === 'or') {
      const left = await this.evalExpr(expr.left, env);
      if (truthy(left)) return left;
      return this.evalExpr(expr.right, env);
    }

    const left = await this.evalExpr(expr.left, env);
    const right = await this.evalExpr(expr.right, env);

    switch (expr.op) {
      case '+': {
        if (left.kind === 'number' && right.kind === 'number') return mkNumber(left.value + right.value);
        if (left.kind === 'string' && right.kind === 'string') return mkString(left.value + right.value);
        if (left.kind === 'string') return mkString(left.value + display(right));
        if (left.kind === 'list' && right.kind === 'list') return mkList([...left.items, ...right.items]);
        throw new TypeError(`'+': cannot add ${left.kind} and ${right.kind}`, expr.loc, this.source);
      }
      case '-': {
        if (left.kind === 'number' && right.kind === 'number') return mkNumber(left.value - right.value);
        throw new TypeError(`'-': expected numbers`, expr.loc, this.source);
      }
      case '*': {
        if (left.kind === 'number' && right.kind === 'number') return mkNumber(left.value * right.value);
        if (left.kind === 'string' && right.kind === 'number') return mkString(left.value.repeat(right.value));
        throw new TypeError(`'*': expected numbers`, expr.loc, this.source);
      }
      case '/': {
        if (left.kind === 'number' && right.kind === 'number') {
          if (right.value === 0) throw new RuntimeError('Division by zero', expr.loc, this.source);
          return mkNumber(left.value / right.value);
        }
        throw new TypeError(`'/': expected numbers`, expr.loc, this.source);
      }
      case '%': {
        if (left.kind === 'number' && right.kind === 'number') {
          if (right.value === 0) throw new RuntimeError('Modulo by zero', expr.loc, this.source);
          return mkNumber(left.value % right.value);
        }
        throw new TypeError(`'%': expected numbers`, expr.loc, this.source);
      }
      case '**':
      case '^': {
        if (left.kind === 'number' && right.kind === 'number') return mkNumber(Math.pow(left.value, right.value));
        throw new TypeError(`'${expr.op}': expected numbers`, expr.loc, this.source);
      }
      case '==': return mkBool(equals(left, right));
      case '!=': return mkBool(!equals(left, right));
      case '<': {
        if (left.kind === 'number' && right.kind === 'number') return mkBool(left.value < right.value);
        if (left.kind === 'string' && right.kind === 'string') return mkBool(left.value < right.value);
        throw new TypeError(`'<': expected numbers or strings`, expr.loc, this.source);
      }
      case '<=': {
        if (left.kind === 'number' && right.kind === 'number') return mkBool(left.value <= right.value);
        if (left.kind === 'string' && right.kind === 'string') return mkBool(left.value <= right.value);
        throw new TypeError(`'<=': expected numbers or strings`, expr.loc, this.source);
      }
      case '>': {
        if (left.kind === 'number' && right.kind === 'number') return mkBool(left.value > right.value);
        if (left.kind === 'string' && right.kind === 'string') return mkBool(left.value > right.value);
        throw new TypeError(`'>': expected numbers or strings`, expr.loc, this.source);
      }
      case '>=': {
        if (left.kind === 'number' && right.kind === 'number') return mkBool(left.value >= right.value);
        if (left.kind === 'string' && right.kind === 'string') return mkBool(left.value >= right.value);
        throw new TypeError(`'>=': expected numbers or strings`, expr.loc, this.source);
      }
      default:
        throw new RuntimeError(`Unknown operator: ${expr.op}`, expr.loc, this.source);
    }
  }

  private async evalUnary(expr: UnaryExpression, env: Environment): Promise<Value> {
    const operand = await this.evalExpr(expr.operand, env);
    switch (expr.op) {
      case '-':
        if (operand.kind !== 'number') throw new TypeError(`unary '-': expected number`, expr.loc, this.source);
        return mkNumber(-operand.value);
      case '!':
      case '¬':
      case 'not':
        return mkBool(!truthy(operand));
      default:
        throw new RuntimeError(`Unknown unary operator: ${expr.op}`, expr.loc, this.source);
    }
  }

  private evalMembership(expr: MembershipExpression, env: Environment): Value {
    // Returns a predicate function: x ∈(category) used in filter context
    // When used outside a pipeline, returns a boolean based on category lookup
    const catName = expr.category;
    const negated = expr.negated;
    // Just return a native predicate that can be applied
    return mkNative(`∈(${catName})`, (args) => {
      const item = args[0] ?? NULL;
      if (!env.has(catName)) return mkBool(negated);
      const cat = env.get(catName);
      if (cat.kind === 'list') {
        const inCat = cat.items.some(c => equals(c, item));
        return mkBool(negated ? !inCat : inCat);
      }
      return mkBool(!negated);
    });
  }

  private async evalShorthand(expr: ShorthandExpression, env: Environment): Promise<Value> {
    const handler = this.shorthand.get(expr.name, expr.suffix);
    if (!handler) {
      throw new RuntimeError(
        `No handler registered for ${expr.name}${expr.suffix}[...]`,
        expr.loc,
        this.source
      );
    }

    const named: Record<string, Value> = {};
    const positional: Value[] = [];
    for (const arg of expr.args) {
      const v = await this.evalExpr(arg.value, env);
      if (arg.name !== null) {
        named[arg.name] = v;
      } else {
        positional.push(v);
      }
    }
    return handler(named, positional);
  }

  private async evalCall(expr: CallExpression, env: Environment): Promise<Value> {
    const callee = await this.evalExpr(expr.callee, env);
    const args: Value[] = [];
    for (const a of expr.args) args.push(await this.evalExpr(a, env));
    return this.callValue(callee, args, expr.loc);
  }

  async callValue(callee: Value, args: Value[], loc?: any): Promise<Value> {
    if (callee.kind === 'native') {
      return callee.call(args);
    }
    if (callee.kind === 'function') {
      const fnEnv = callee.closure.child();
      callee.params.forEach((param, i) => {
        fnEnv.define(param.name, args[i] ?? NULL);
      });

      // Body can be an array of statements (block) or a single expression
      if (Array.isArray(callee.body)) {
        try {
          return await this.execBlock(callee.body, fnEnv);
        } catch (e) {
          if (e instanceof ReturnSignal) return e.value;
          throw e;
        }
      } else {
        // single expression body
        return this.evalExpr(callee.body as any, fnEnv);
      }
    }
    throw new TypeError(
      `Cannot call value of kind '${callee.kind}'`,
      loc,
      this.source
    );
  }

  // ===== Phase 4: Module System =====

  /**
   * Module exports are stored in a special __pub__ dict on the environment.
   * We keep a module cache keyed by resolved absolute path to avoid re-executing.
   */
  private moduleCache: Map<string, Map<string, Value>> = new Map();

  private async execUseStatement(stmt: UseStatement, env: Environment): Promise<Value> {
    const { resolve, dirname } = await import('node:path');
    const { readFileSync } = await import('node:fs');

    // Resolve path relative to the current file (stored in source field as a path when available)
    const basePath = this.currentFilePath ?? process.cwd();
    const absPath = resolve(dirname(basePath), stmt.path.endsWith('.nxl') ? stmt.path : stmt.path + '.nxl');

    let exports: Map<string, Value>;

    if (this.moduleCache.has(absPath)) {
      exports = this.moduleCache.get(absPath)!;
    } else {
      // Read and execute the module in a fresh environment
      let source: string;
      try {
        source = readFileSync(absPath, 'utf8');
      } catch {
        throw new RuntimeError(`use: cannot read module '${stmt.path}' (resolved: ${absPath})`, stmt.loc, this.source);
      }

      const program = parse(source);
      const moduleEnv = new Environment();
      registerBuiltins(moduleEnv);
      // Share the same shorthand registry so modules can also use mem/tool/llm
      const moduleInterp = new Interpreter(this.shorthand);
      await moduleInterp.runInEnv(program, moduleEnv, source);

      // Collect pub bindings
      exports = moduleInterp.pubExports;
      this.moduleCache.set(absPath, exports);
    }

    // Import all exported names into current env
    for (const [name, val] of exports) {
      env.define(name, val);
    }

    return NULL;
  }

  /** Tracks pub-exported bindings for this interpreter instance */
  readonly pubExports: Map<string, Value> = new Map();

  private async execPubStatement(stmt: PubStatement, env: Environment): Promise<Value> {
    const result = await this.execStatement(stmt.inner, env);

    // Determine the exported name
    let name: string;
    if (stmt.inner.kind === 'AssignmentStatement') {
      name = stmt.inner.name;
    } else {
      name = stmt.inner.name;
    }

    // After executing, read the value back from the environment
    const val = env.get(name);
    this.pubExports.set(name, val);

    return result;
  }

  /** The file path of the currently executing script (for relative use imports) */
  currentFilePath: string | null = null;

  private async evalMember(expr: MemberExpression, env: Environment): Promise<Value> {
    const obj = await this.evalExpr(expr.object, env);
    const prop = expr.property;

    if (obj.kind === 'dict') {
      return obj.entries.get(prop) ?? NULL;
    }
    if (obj.kind === 'list') {
      // Numeric-like access: obj.0, obj.1 (not standard but handy)
      const idx = parseInt(prop, 10);
      if (!isNaN(idx)) return obj.items[idx < 0 ? obj.items.length + idx : idx] ?? NULL;
      // Built-in list properties
      if (prop === 'length' || prop === 'len') return mkNumber(obj.items.length);
      throw new RuntimeError(`List has no property '${prop}'`, expr.loc, this.source);
    }
    if (obj.kind === 'string') {
      if (prop === 'length' || prop === 'len') return mkNumber(obj.value.length);
      throw new RuntimeError(`String has no property '${prop}'`, expr.loc, this.source);
    }
    throw new RuntimeError(
      `Cannot access property '${prop}' on ${obj.kind}`,
      expr.loc,
      this.source
    );
  }
}
