/**
 * NXL static linter.
 *
 * Rules:
 *  - no-undef:          reference to a name not defined in scope
 *  - no-unused-vars:    variable defined but never read within its scope
 *  - no-unreachable:    code after return/break/continue
 *  - no-empty-fn:       function declared with an empty block body
 *  - no-shadow:         variable declaration shadows an outer-scope binding
 *  - prefer-const:      variable assigned only once (use plain binding)
 */

import type {
  Program, Statement, Expression,
  AssignmentStatement, FunctionDeclaration, FunctionExpression,
  IfStatement, ForStatement, WhileStatement, ReturnStatement,
  BlockStatement, UseStatement, PubStatement,
  CallExpression, MemberExpression, Identifier,
  BinaryExpression, UnaryExpression, ArrayLiteral,
  MatchExpression, IfExpression,
} from '@nxl/core';
import type { SourceLocation } from '@nxl/core';

export type LintSeverity = 'error' | 'warning' | 'info';

export interface LintDiagnostic {
  rule: string;
  severity: LintSeverity;
  message: string;
  loc: SourceLocation;
}

// Built-in names that are always in scope
const BUILTINS = new Set([
  'print', 'println', 'len', 'range', 'str', 'num', 'bool', 'int', 'float',
  'type', 'repr', 'push', 'pop', 'append', 'concat', 'slice', 'reverse',
  'sort', 'keys', 'values', 'items', 'get', 'set', 'has',
  'split', 'join', 'trim', 'upper', 'lower', 'starts_with', 'ends_with',
  'contains', 'replace', 'pad_start', 'pad_end', 'char_code', 'from_char_code',
  'repeat', 'index_of',
  'abs', 'floor', 'ceil', 'round', 'sqrt', 'pow', 'log',
  'sin', 'cos', 'tan', 'clamp', 'sign',
  'max', 'min', 'sum',
  'flat', 'zip', 'unique', 'group_by', 'count',
  'first', 'last', 'take', 'drop', 'any', 'all', 'none',
  'merge', 'omit', 'pick',
  'is_null', 'coalesce', 'assert',
  'json_encode', 'json_decode',
  'read_file', 'write_file', 'file_exists', 'list_dir', 'make_dir',
  'path_join', 'path_basename', 'path_dirname', 'path_abs', 'path_ext',
  'regex_test', 'regex_find', 'regex_replace', 'regex_groups',
  'now', 'timestamp', 'sleep',
  'random', 'random_int', 'random_choice',
  'env_get', 'env_set', 'env_keys',
  'fetch_url',
  'filter', 'map',
  // constants
  'null', 'true', 'false', 'PI', 'E', 'Infinity', 'NaN',
]);

interface ScopeVar {
  defined: boolean;
  loc: SourceLocation;
  reads: number;
  writes: number;
}

class Scope {
  vars: Map<string, ScopeVar> = new Map();
  parent: Scope | null;

  constructor(parent: Scope | null = null) {
    this.parent = parent;
  }

  define(name: string, loc: SourceLocation): void {
    this.vars.set(name, { defined: true, loc, reads: 0, writes: 1 });
  }

  write(name: string): boolean {
    if (this.vars.has(name)) {
      this.vars.get(name)!.writes++;
      return true;
    }
    return this.parent?.write(name) ?? false;
  }

  read(name: string): boolean {
    if (this.vars.has(name)) {
      this.vars.get(name)!.reads++;
      return true;
    }
    return this.parent?.read(name) ?? false;
  }

  has(name: string): boolean {
    if (this.vars.has(name)) return true;
    return this.parent?.has(name) ?? false;
  }

  child(): Scope {
    return new Scope(this);
  }
}

export class Linter {
  private diags: LintDiagnostic[] = [];
  private source: string;

  constructor(source = '') {
    this.source = source;
  }

  lint(program: Program): LintDiagnostic[] {
    this.diags = [];
    const scope = new Scope();
    // Pre-seed with builtins so we don't flag them
    for (const name of BUILTINS) scope.define(name, { line: 0, column: 0, offset: 0 });

    this.lintStatements(program.body, scope);
    this.checkUnused(scope);
    return this.diags;
  }

  // ===== Statements =====

  private lintStatements(stmts: Statement[], scope: Scope): void {
    for (let i = 0; i < stmts.length; i++) {
      const stmt = stmts[i];
      this.lintStatement(stmt, scope);

      // no-unreachable: code after return/break/continue
      if (
        (stmt.kind === 'ReturnStatement' || stmt.kind === 'BreakStatement' || stmt.kind === 'ContinueStatement') &&
        i < stmts.length - 1
      ) {
        this.warn(
          'no-unreachable',
          `Unreachable code after '${stmt.kind === 'ReturnStatement' ? 'return' : stmt.kind === 'BreakStatement' ? 'break' : 'continue'}'`,
          stmts[i + 1].loc
        );
        break;
      }
    }
  }

  private lintStatement(stmt: Statement, scope: Scope): void {
    switch (stmt.kind) {
      case 'AssignmentStatement': this.lintAssignment(stmt, scope); break;
      case 'ExpressionStatement': this.lintExpr(stmt.expression, scope); break;
      case 'FunctionDeclaration': this.lintFunctionDecl(stmt, scope); break;
      case 'IfStatement':         this.lintIfStatement(stmt, scope); break;
      case 'ForStatement':        this.lintForStatement(stmt, scope); break;
      case 'WhileStatement':      this.lintWhileStatement(stmt, scope); break;
      case 'ReturnStatement':     if (stmt.value) this.lintExpr(stmt.value, scope); break;
      case 'BlockStatement':      this.lintBlock(stmt, scope); break;
      case 'PubStatement':        this.lintStatement(stmt.inner, scope); break;
      case 'UseStatement':        this.lintUse(stmt, scope); break;
      case 'PipelineStatement':
        this.lintExpr(stmt.source, scope);
        stmt.selector.filters.forEach(f => {
          if (f.kind !== 'MembershipExpression') this.lintExpr(f, scope);
        });
        break;
      case 'ConditionalStatement':
        this.lintExpr(stmt.condition, scope);
        stmt.actions.forEach(a => this.lintExpr(a.value, scope));
        break;
      // No-op for these
      case 'ToonBlock':
      case 'TypeDeclaration':
      case 'CompositionStatement':
      case 'BreakStatement':
      case 'ContinueStatement':
        break;
    }
  }

  private lintAssignment(stmt: AssignmentStatement, scope: Scope): void {
    this.lintExpr(stmt.value, scope);
    if (!scope.has(stmt.name)) {
      scope.define(stmt.name, stmt.loc);
    } else {
      scope.write(stmt.name);
    }
  }

  private lintFunctionDecl(decl: FunctionDeclaration, scope: Scope): void {
    // no-shadow: check param names
    for (const p of decl.params) {
      if (scope.has(p.name) && !BUILTINS.has(p.name)) {
        this.info('no-shadow', `Parameter '${p.name}' shadows an outer binding`, p.loc);
      }
    }

    scope.define(decl.name, decl.loc);

    const fnScope = scope.child();
    for (const p of decl.params) fnScope.define(p.name, p.loc);

    if (Array.isArray(decl.body)) {
      // no-empty-fn
      if (decl.body.length === 0) {
        this.warn('no-empty-fn', `Function '${decl.name}' has an empty body`, decl.loc);
      }
      this.lintStatements(decl.body, fnScope);
    } else {
      this.lintExpr(decl.body as Expression, fnScope);
    }

    this.checkUnused(fnScope);
  }

  private lintIfStatement(stmt: IfStatement, scope: Scope): void {
    this.lintExpr(stmt.condition, scope);
    const thenScope = scope.child();
    this.lintStatements(stmt.then, thenScope);
    this.checkUnused(thenScope);
    if (stmt.else) {
      const elseScope = scope.child();
      this.lintStatements(stmt.else, elseScope);
      this.checkUnused(elseScope);
    }
  }

  private lintForStatement(stmt: ForStatement, scope: Scope): void {
    this.lintExpr(stmt.iterable, scope);
    const bodyScope = scope.child();
    bodyScope.define(stmt.variable, stmt.loc);
    this.lintStatements(stmt.body, bodyScope);
    this.checkUnused(bodyScope);
  }

  private lintWhileStatement(stmt: WhileStatement, scope: Scope): void {
    this.lintExpr(stmt.condition, scope);
    const bodyScope = scope.child();
    this.lintStatements(stmt.body, bodyScope);
    this.checkUnused(bodyScope);
  }

  private lintBlock(stmt: BlockStatement, scope: Scope): void {
    const blockScope = scope.child();
    this.lintStatements(stmt.statements, blockScope);
    this.checkUnused(blockScope);
  }

  private lintUse(_stmt: UseStatement, _scope: Scope): void {
    // Module-level names imported by 'use' are treated as any — no undef for them
  }

  // ===== Expressions =====

  private lintExpr(expr: Expression, scope: Scope): void {
    switch (expr.kind) {
      case 'Identifier': this.lintIdentifier(expr, scope); break;
      case 'BinaryExpression': this.lintBinary(expr, scope); break;
      case 'UnaryExpression': this.lintExpr(expr.operand, scope); break;
      case 'CallExpression': this.lintCall(expr, scope); break;
      case 'MemberExpression': this.lintExpr(expr.object, scope); break;
      case 'ArrayLiteral': expr.elements.forEach(e => this.lintExpr(e, scope)); break;
      case 'FunctionExpression': this.lintFunctionExpr(expr, scope); break;
      case 'IfExpression':
        this.lintExpr(expr.condition, scope);
        this.lintExpr(expr.then, scope);
        if (expr.else) this.lintExpr(expr.else, scope);
        break;
      case 'MatchExpression': this.lintMatch(expr, scope); break;
      case 'ShorthandExpression':
        expr.args.forEach(a => this.lintExpr(a.value, scope));
        break;
      // Literals: nothing to lint
      case 'NumberLiteral':
      case 'StringLiteral':
      case 'BooleanLiteral':
      case 'NullLiteral':
      case 'MembershipExpression':
        break;
    }
  }

  private lintIdentifier(expr: Identifier, scope: Scope): void {
    if (!scope.read(expr.name)) {
      // no-undef: reference to undefined name
      this.warn('no-undef', `'${expr.name}' is not defined`, expr.loc);
    }
  }

  private lintBinary(expr: BinaryExpression, scope: Scope): void {
    this.lintExpr(expr.left, scope);
    this.lintExpr(expr.right, scope);
  }

  private lintCall(expr: CallExpression, scope: Scope): void {
    this.lintExpr(expr.callee, scope);
    expr.args.forEach(a => this.lintExpr(a, scope));
  }

  private lintFunctionExpr(expr: FunctionExpression, scope: Scope): void {
    const fnScope = scope.child();
    for (const p of expr.params) fnScope.define(p.name, p.loc);
    if (Array.isArray(expr.body)) {
      this.lintStatements(expr.body, fnScope);
    } else {
      this.lintExpr(expr.body as Expression, fnScope);
    }
    this.checkUnused(fnScope);
  }

  private lintMatch(expr: MatchExpression, scope: Scope): void {
    this.lintExpr(expr.subject, scope);
    for (const arm of expr.arms) {
      const armScope = scope.child();
      // Identifier patterns bind the subject value
      if (arm.pattern.kind === 'Identifier' && arm.pattern.name !== '_') {
        armScope.define(arm.pattern.name, arm.pattern.loc);
      }
      if (arm.guard) this.lintExpr(arm.guard, armScope);
      this.lintExpr(arm.body, armScope);
      this.checkUnused(armScope);
    }
  }

  // ===== Unused variable check =====

  private checkUnused(scope: Scope): void {
    for (const [name, info] of scope.vars) {
      // Skip builtins and synthetic entries
      if (BUILTINS.has(name)) continue;
      if (info.loc.line === 0) continue; // synthetic
      if (info.reads === 0) {
        this.info('no-unused-vars', `'${name}' is assigned but never used`, info.loc);
      }
    }
  }

  // ===== Helpers =====

  private warn(rule: string, message: string, loc: SourceLocation): void {
    this.diags.push({ rule, severity: 'warning', message, loc });
  }

  private info(rule: string, message: string, loc: SourceLocation): void {
    this.diags.push({ rule, severity: 'info', message, loc });
  }
}

export function formatLintDiag(d: LintDiagnostic, source: string, file?: string): string {
  const lines = source.split('\n');
  const { line, column } = d.loc;
  const prefix = file ? `${file}:${line}:${column}` : `${line}:${column}`;
  const lineText = lines[line - 1] ?? '';
  const pointer = ' '.repeat(Math.max(0, column - 1)) + '^';
  const sev = d.severity === 'warning' ? 'warn' : d.severity;
  return `${prefix} [${sev}](${d.rule}) ${d.message}\n  ${lineText}\n  ${pointer}`;
}
