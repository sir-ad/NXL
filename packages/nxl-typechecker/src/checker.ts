/**
 * NXL gradual type checker.
 *
 * Rules:
 *  - Literals produce concrete types.
 *  - Variables are inferred from their RHS on first assignment.
 *  - Binary arithmetic requires both operands to be num (or any).
 *  - Comparison operators accept num | str | bool on both sides.
 *  - Logical operators (&&, ||) accept any truthy-compatible types.
 *  - Function calls check argument count and types against param annotations.
 *  - Everything not explicitly typed is 'any' — no false positives.
 */

import type {
  Program, Statement, Expression,
  AssignmentStatement, BinaryExpression, UnaryExpression,
  CallExpression, MemberExpression, Identifier,
  ArrayLiteral, NumberLiteral, StringLiteral, BooleanLiteral,
  FunctionDeclaration, FunctionExpression,
  IfStatement, ForStatement, WhileStatement, ReturnStatement,
  BlockStatement, UseStatement, PubStatement,
  TypeExpr,
} from '@nxl/core';

import {
  NxlType, T_NUM, T_STR, T_BOOL, T_NULL, T_ANY, T_LIST_ANY, T_DICT_ANY,
  typeOf, isAssignable, typeFromAnnotation,
} from './types.js';
import { TypeEnv } from './type-env.js';
import type { Diagnostic } from './diagnostic.js';

// ===== Built-in type signatures =====
const BUILTIN_TYPES: Record<string, NxlType> = {
  print:   { kind: 'fn', params: [T_ANY], ret: T_NULL },
  println: { kind: 'fn', params: [T_ANY], ret: T_NULL },
  len:     { kind: 'fn', params: [T_ANY], ret: T_NUM },
  range:   { kind: 'fn', params: [T_NUM], ret: T_LIST_ANY },
  str:     { kind: 'fn', params: [T_ANY], ret: T_STR },
  num:     { kind: 'fn', params: [T_ANY], ret: T_NUM },
  bool:    { kind: 'fn', params: [T_ANY], ret: T_BOOL },
  type:    { kind: 'fn', params: [T_ANY], ret: T_STR },
  push:    { kind: 'fn', params: [T_LIST_ANY, T_ANY], ret: T_LIST_ANY },
  pop:     { kind: 'fn', params: [T_LIST_ANY], ret: T_ANY },
  keys:    { kind: 'fn', params: [T_DICT_ANY], ret: T_LIST_ANY },
  values:  { kind: 'fn', params: [T_DICT_ANY], ret: T_LIST_ANY },
  sum:     { kind: 'fn', params: [T_LIST_ANY], ret: T_NUM },
  min:     { kind: 'fn', params: [T_LIST_ANY], ret: T_NUM },
  max:     { kind: 'fn', params: [T_LIST_ANY], ret: T_NUM },
  split:   { kind: 'fn', params: [T_STR], ret: T_LIST_ANY },
  join:    { kind: 'fn', params: [T_LIST_ANY, T_STR], ret: T_STR },
  upper:   { kind: 'fn', params: [T_STR], ret: T_STR },
  lower:   { kind: 'fn', params: [T_STR], ret: T_STR },
  trim:    { kind: 'fn', params: [T_STR], ret: T_STR },
  abs:     { kind: 'fn', params: [T_NUM], ret: T_NUM },
  floor:   { kind: 'fn', params: [T_NUM], ret: T_NUM },
  ceil:    { kind: 'fn', params: [T_NUM], ret: T_NUM },
  round:   { kind: 'fn', params: [T_NUM], ret: T_NUM },
  sqrt:    { kind: 'fn', params: [T_NUM], ret: T_NUM },
  read_file:  { kind: 'fn', params: [T_STR], ret: T_STR },
  write_file: { kind: 'fn', params: [T_STR, T_STR], ret: T_NULL },
  file_exists: { kind: 'fn', params: [T_STR], ret: T_BOOL },
  list_dir:   { kind: 'fn', params: [T_STR], ret: T_LIST_ANY },
  now:        { kind: 'fn', params: [], ret: T_NUM },
  random:     { kind: 'fn', params: [], ret: T_NUM },
  env_get:    { kind: 'fn', params: [T_STR], ret: T_STR },
};

function resolveTypeExpr(te: TypeExpr): NxlType {
  const args = te.typeArgs.map(resolveTypeExpr);
  return typeFromAnnotation(te.name, args);
}

export class TypeChecker {
  private diagnostics: Diagnostic[] = [];
  private source: string;

  constructor(source = '') {
    this.source = source;
  }

  check(program: Program): Diagnostic[] {
    this.diagnostics = [];
    const env = new TypeEnv();

    // Seed env with builtins
    for (const [name, t] of Object.entries(BUILTIN_TYPES)) {
      env.define(name, t);
    }

    this.checkStatements(program.body, env);
    return this.diagnostics;
  }

  // ===== Statements =====

  private checkStatements(stmts: Statement[], env: TypeEnv): void {
    for (const stmt of stmts) {
      this.checkStatement(stmt, env);
    }
  }

  private checkStatement(stmt: Statement, env: TypeEnv): void {
    switch (stmt.kind) {
      case 'AssignmentStatement':  this.checkAssignment(stmt, env); break;
      case 'ExpressionStatement':  this.inferExpr(stmt.expression, env); break;
      case 'FunctionDeclaration':  this.checkFunctionDecl(stmt, env); break;
      case 'IfStatement':          this.checkIfStatement(stmt, env); break;
      case 'ForStatement':         this.checkForStatement(stmt, env); break;
      case 'WhileStatement':       this.checkWhileStatement(stmt, env); break;
      case 'ReturnStatement':      this.checkReturnStatement(stmt, env); break;
      case 'BlockStatement':       this.checkBlock(stmt, env); break;
      case 'PubStatement':         this.checkStatement(stmt.inner, env); break;
      case 'UseStatement':         this.checkUseStatement(stmt); break;
      // These don't carry type info worth checking in isolation
      case 'PipelineStatement':
      case 'ConditionalStatement':
      case 'CompositionStatement':
      case 'ToonBlock':
      case 'TypeDeclaration':
      case 'BreakStatement':
      case 'ContinueStatement':
        break;
    }
  }

  private checkAssignment(stmt: AssignmentStatement, env: TypeEnv): void {
    const rhsType = this.inferExpr(stmt.value, env);
    if (!env.has(stmt.name)) {
      env.define(stmt.name, rhsType);
    } else {
      const existing = env.get(stmt.name);
      if (!isAssignable(rhsType, existing)) {
        this.error(
          `Type mismatch: cannot assign ${typeOf(rhsType)} to ${typeOf(existing)} ('${stmt.name}')`,
          stmt.loc
        );
      }
    }
  }

  private checkFunctionDecl(decl: FunctionDeclaration, env: TypeEnv): void {
    // Build param types from annotations (default any)
    const paramTypes = decl.params.map(p =>
      p.typeAnnotation ? resolveTypeExpr(p.typeAnnotation) : T_ANY
    );
    // Seed function env with param bindings
    const fnEnv = env.child();
    decl.params.forEach((p, i) => fnEnv.define(p.name, paramTypes[i]));

    // Infer return type from body
    let retType: NxlType;
    if (Array.isArray(decl.body)) {
      this.checkStatements(decl.body, fnEnv);
      retType = T_ANY; // return type inference from block is limited
    } else {
      retType = this.inferExpr(decl.body as Expression, fnEnv);
    }

    const fnType: NxlType = { kind: 'fn', params: paramTypes, ret: retType };
    env.define(decl.name, fnType);
  }

  private checkIfStatement(stmt: IfStatement, env: TypeEnv): void {
    this.inferExpr(stmt.condition, env);
    this.checkStatements(stmt.then, env.child());
    if (stmt.else) this.checkStatements(stmt.else, env.child());
  }

  private checkForStatement(stmt: ForStatement, env: TypeEnv): void {
    const iterType = this.inferExpr(stmt.iterable, env);
    const bodyEnv = env.child();
    const itemType = iterType.kind === 'list' ? iterType.item : T_ANY;
    bodyEnv.define(stmt.variable, itemType);
    this.checkStatements(stmt.body, bodyEnv);
  }

  private checkWhileStatement(stmt: WhileStatement, env: TypeEnv): void {
    this.inferExpr(stmt.condition, env);
    this.checkStatements(stmt.body, env.child());
  }

  private checkReturnStatement(stmt: ReturnStatement, env: TypeEnv): void {
    if (stmt.value) this.inferExpr(stmt.value, env);
  }

  private checkBlock(stmt: BlockStatement, env: TypeEnv): void {
    this.checkStatements(stmt.statements, env.child());
  }

  private checkUseStatement(_stmt: UseStatement): void {
    // Module resolution at type-check time is complex — skip for now
    // A full implementation would type-check the imported module and bind its pub types
  }

  // ===== Expression type inference =====

  inferExpr(expr: Expression, env: TypeEnv): NxlType {
    switch (expr.kind) {
      case 'NumberLiteral':  return T_NUM;
      case 'StringLiteral':  return T_STR;
      case 'BooleanLiteral': return T_BOOL;
      case 'NullLiteral':    return T_NULL;

      case 'ArrayLiteral':   return this.inferArray(expr, env);
      case 'Identifier':     return this.inferIdentifier(expr, env);
      case 'BinaryExpression': return this.inferBinary(expr, env);
      case 'UnaryExpression':  return this.inferUnary(expr, env);
      case 'CallExpression':   return this.inferCall(expr, env);
      case 'MemberExpression': return this.inferMember(expr, env);
      case 'FunctionExpression': return this.inferFunctionExpr(expr, env);

      case 'IfExpression': {
        this.inferExpr(expr.condition, env);
        const t = this.inferExpr(expr.then, env);
        const e = expr.else ? this.inferExpr(expr.else, env) : T_NULL;
        if (isAssignable(t, e)) return e;
        if (isAssignable(e, t)) return t;
        return { kind: 'union', types: [t, e] };
      }

      case 'MatchExpression': {
        this.inferExpr(expr.subject, env);
        const armTypes = expr.arms.map(arm => this.inferExpr(arm.body, env));
        if (armTypes.length === 0) return T_ANY;
        return armTypes.reduce((acc, t) => {
          if (isAssignable(acc, t)) return t;
          if (isAssignable(t, acc)) return acc;
          return { kind: 'union', types: [acc, t] };
        });
      }

      // Shorthand expressions: mem?, tool!, llm@ → any
      case 'ShorthandExpression':
      case 'MembershipExpression':
        return T_ANY;

      default:
        return T_ANY;
    }
  }

  private inferArray(expr: ArrayLiteral, env: TypeEnv): NxlType {
    if (expr.elements.length === 0) return T_LIST_ANY;
    const elemTypes = expr.elements.map(e => this.inferExpr(e, env));
    // Homogeneous list → specific item type; heterogeneous → any
    const first = elemTypes[0];
    const homogeneous = elemTypes.every(t => isAssignable(t, first) && isAssignable(first, t));
    return { kind: 'list', item: homogeneous ? first : T_ANY };
  }

  private inferIdentifier(expr: Identifier, env: TypeEnv): NxlType {
    return env.get(expr.name);
  }

  private inferBinary(expr: BinaryExpression, env: TypeEnv): NxlType {
    const L = this.inferExpr(expr.left, env);
    const R = this.inferExpr(expr.right, env);

    switch (expr.op) {
      case '+': {
        // num + num → num; str + str → str; mixed → warn
        if (isAssignable(L, T_NUM) && isAssignable(R, T_NUM)) return T_NUM;
        if (isAssignable(L, T_STR) && isAssignable(R, T_STR)) return T_STR;
        if (L.kind !== 'any' && R.kind !== 'any') {
          this.warn(`'+' operands should both be num or both be str, got ${typeOf(L)} and ${typeOf(R)}`, expr.loc);
        }
        return T_ANY;
      }
      case '-':
      case '*':
      case '/':
      case '%':
      case '**': {
        this.requireNum(L, expr.left.loc, expr.op);
        this.requireNum(R, expr.right.loc, expr.op);
        return T_NUM;
      }
      case '<':
      case '>':
      case '<=':
      case '>=': {
        this.requireNum(L, expr.left.loc, expr.op);
        this.requireNum(R, expr.right.loc, expr.op);
        return T_BOOL;
      }
      case '==':
      case '!=':
        return T_BOOL;
      case '&&':
      case '||':
        return { kind: 'union', types: [L, R] };
      default:
        return T_ANY;
    }
  }

  private inferUnary(expr: UnaryExpression, env: TypeEnv): NxlType {
    const operand = this.inferExpr(expr.operand, env);
    if (expr.op === '-') {
      this.requireNum(operand, expr.operand.loc, 'unary -');
      return T_NUM;
    }
    if (expr.op === '¬' || expr.op === '!') return T_BOOL;
    return T_ANY;
  }

  private inferCall(expr: CallExpression, env: TypeEnv): NxlType {
    const calleeType = this.inferExpr(expr.callee, env);
    const argTypes = expr.args.map(a => this.inferExpr(a, env));

    if (calleeType.kind === 'fn') {
      // Arity check (variadic functions have 1 'any' param - skip strict check)
      const strict = calleeType.params.length > 0 && !(calleeType.params.length === 1 && calleeType.params[0].kind === 'any');
      if (strict && expr.args.length !== calleeType.params.length) {
        // Don't error for builtins with variable arity - they use T_ANY
        if (!calleeType.params.every(p => p.kind === 'any')) {
          this.warn(
            `Expected ${calleeType.params.length} argument(s), got ${expr.args.length}`,
            expr.loc
          );
        }
      }
      // Type-check args against params
      calleeType.params.forEach((paramType, i) => {
        const argType = argTypes[i];
        if (argType && !isAssignable(argType, paramType)) {
          this.error(
            `Argument ${i + 1} type mismatch: expected ${typeOf(paramType)}, got ${typeOf(argType)}`,
            expr.args[i].loc
          );
        }
      });
      return calleeType.ret;
    }

    return T_ANY; // unknown callee → any
  }

  private inferMember(expr: MemberExpression, env: TypeEnv): NxlType {
    const objType = this.inferExpr(expr.object, env);
    if (objType.kind === 'dict') return objType.value;
    if (objType.kind === 'list') {
      if (expr.property === 'length' || expr.property === 'len') return T_NUM;
      return T_ANY;
    }
    if (objType.kind === 'str') {
      if (expr.property === 'length' || expr.property === 'len') return T_NUM;
      return T_ANY;
    }
    return T_ANY;
  }

  private inferFunctionExpr(expr: FunctionExpression, env: TypeEnv): NxlType {
    const paramTypes = expr.params.map(p =>
      p.typeAnnotation ? resolveTypeExpr(p.typeAnnotation) : T_ANY
    );
    const fnEnv = env.child();
    expr.params.forEach((p, i) => fnEnv.define(p.name, paramTypes[i]));

    let retType: NxlType;
    if (Array.isArray(expr.body)) {
      this.checkStatements(expr.body, fnEnv);
      retType = T_ANY;
    } else {
      retType = this.inferExpr(expr.body as Expression, fnEnv);
    }

    return { kind: 'fn', params: paramTypes, ret: retType };
  }

  // ===== Helpers =====

  private requireNum(t: NxlType, loc: { line: number; column: number; offset: number }, op: string): void {
    if (t.kind !== 'any' && !isAssignable(t, T_NUM)) {
      this.error(`Operator '${op}' requires num, got ${typeOf(t)}`, loc);
    }
  }

  private error(message: string, loc: { line: number; column: number; offset: number }): void {
    this.diagnostics.push({ severity: 'error', message, loc });
  }

  private warn(message: string, loc: { line: number; column: number; offset: number }): void {
    this.diagnostics.push({ severity: 'warning', message, loc });
  }
}
