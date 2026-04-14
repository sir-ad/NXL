/**
 * NXL source formatter.
 * Walks the AST and emits canonical NXL source with consistent indentation.
 *
 * Formatting rules:
 *  - 2-space indentation for blocks
 *  - Single blank line between top-level declarations
 *  - No trailing whitespace
 *  - Compact single-expression function bodies
 */

import type {
  Program, Statement, Expression,
  BinaryExpression, UnaryExpression, CallExpression, MemberExpression,
  ArrayLiteral, ShorthandExpression, ShorthandArg,
  PipelineStatement, ConditionalStatement, CompositionStatement,
  AssignmentStatement, ExpressionStatement,
  ToonBlock, TypeDeclaration, MethodSignature, Param,
  FunctionDeclaration, FunctionExpression,
  IfStatement, IfExpression, ForStatement, WhileStatement,
  ReturnStatement, BlockStatement, MatchExpression, MatchArm,
  UseStatement, PubStatement,
} from '@nxl/core';

export interface FormatOptions {
  indent?: number;   // spaces per level (default 2)
  maxWidth?: number; // soft wrap threshold (default 80, not enforced yet)
}

export class Formatter {
  private indentWidth: number;
  private level = 0;

  constructor(opts: FormatOptions = {}) {
    this.indentWidth = opts.indent ?? 2;
  }

  format(program: Program): string {
    const parts: string[] = [];
    for (let i = 0; i < program.body.length; i++) {
      const stmt = program.body[i];
      parts.push(this.fmtStatement(stmt));
    }
    return parts.join('\n') + '\n';
  }

  // ===== Statements =====

  private fmtStatement(stmt: Statement): string {
    switch (stmt.kind) {
      case 'AssignmentStatement':  return this.fmtAssignment(stmt);
      case 'ExpressionStatement':  return this.indent() + this.fmtExpr(stmt.expression);
      case 'PipelineStatement':    return this.fmtPipeline(stmt);
      case 'ConditionalStatement': return this.fmtConditional(stmt);
      case 'CompositionStatement': return this.indent() + stmt.functions.join(' ∘ ');
      case 'FunctionDeclaration':  return this.fmtFunctionDecl(stmt);
      case 'IfStatement':          return this.fmtIfStatement(stmt);
      case 'ForStatement':         return this.fmtForStatement(stmt);
      case 'WhileStatement':       return this.fmtWhileStatement(stmt);
      case 'ReturnStatement':      return this.fmtReturn(stmt);
      case 'BreakStatement':       return this.indent() + 'break';
      case 'ContinueStatement':    return this.indent() + 'continue';
      case 'BlockStatement':       return this.fmtBlock(stmt);
      case 'ToonBlock':            return this.fmtToon(stmt);
      case 'TypeDeclaration':      return this.fmtTypeDecl(stmt);
      case 'UseStatement':         return this.fmtUse(stmt);
      case 'PubStatement':         return this.fmtPub(stmt);
      default:                     return this.indent() + '// (unsupported statement)';
    }
  }

  private fmtAssignment(stmt: AssignmentStatement): string {
    return `${this.indent()}${stmt.name} = ${this.fmtExpr(stmt.value)}`;
  }

  private fmtPipeline(stmt: PipelineStatement): string {
    const filters = stmt.selector.filters.map(f => {
      if (f.kind === 'MembershipExpression') {
        return f.negated ? `¬(${f.category})` : `∈(${f.category})`;
      }
      return this.fmtExpr(f);
    });
    return `${this.indent()}${this.fmtExpr(stmt.source)} → select ${filters.join(' ∩ ')}`;
  }

  private fmtConditional(stmt: ConditionalStatement): string {
    const actions = stmt.actions.map(a => `${a.name}: ${this.fmtExpr(a.value)}`).join(' | ');
    return `${this.indent()}${this.fmtExpr(stmt.condition)} ⇒ ${actions}`;
  }

  private fmtFunctionDecl(decl: FunctionDeclaration): string {
    const params = this.fmtParams(decl.params);
    if (Array.isArray(decl.body)) {
      const body = this.fmtBlockStatements(decl.body);
      return `${this.indent()}${decl.name}(${params}): {\n${body}\n${this.indent()}}`;
    }
    return `${this.indent()}${decl.name}(${params}): ${this.fmtExpr(decl.body as Expression)}`;
  }

  private fmtIfStatement(stmt: IfStatement): string {
    const cond = this.fmtExpr(stmt.condition);
    const then = this.fmtBlockStatements(stmt.then);
    let s = `${this.indent()}if ${cond} {\n${then}\n${this.indent()}}`;
    if (stmt.else) {
      // Detect else-if chain
      if (stmt.else.length === 1 && stmt.else[0].kind === 'IfStatement') {
        s += ' else ' + this.fmtIfStatement(stmt.else[0] as IfStatement).trimStart();
      } else {
        const elseBody = this.fmtBlockStatements(stmt.else);
        s += ` else {\n${elseBody}\n${this.indent()}}`;
      }
    }
    return s;
  }

  private fmtForStatement(stmt: ForStatement): string {
    const body = this.fmtBlockStatements(stmt.body);
    return `${this.indent()}for ${stmt.variable} ∈ ${this.fmtExpr(stmt.iterable)} {\n${body}\n${this.indent()}}`;
  }

  private fmtWhileStatement(stmt: WhileStatement): string {
    const body = this.fmtBlockStatements(stmt.body);
    return `${this.indent()}while ${this.fmtExpr(stmt.condition)} {\n${body}\n${this.indent()}}`;
  }

  private fmtReturn(stmt: ReturnStatement): string {
    if (!stmt.value) return `${this.indent()}return`;
    return `${this.indent()}return ${this.fmtExpr(stmt.value)}`;
  }

  private fmtBlock(stmt: BlockStatement): string {
    const body = this.fmtBlockStatements(stmt.statements);
    return `${this.indent()}{\n${body}\n${this.indent()}}`;
  }

  private fmtToon(block: ToonBlock): string {
    const count = block.count !== null ? `[${block.count}]` : '';
    const fields = `{${block.fields.join(',')}}`;
    const rows = block.rows.map(row =>
      `${this.indent()}  ` + row.values.map(v => {
        if (v === null) return 'null';
        if (typeof v === 'string') return JSON.stringify(v);
        return String(v);
      }).join(',')
    ).join('\n');
    return `${this.indent()}${block.name}${count}${fields}:\n${rows}`;
  }

  private fmtTypeDecl(decl: TypeDeclaration): string {
    const fields = decl.fields.join(', ');
    const methods = decl.methods.map(m => this.fmtMethodSig(m)).join('\n  ');
    const body = methods ? `\n  ${methods}\n` : '';
    return `${this.indent()}${decl.name}{${fields}}{${body}}`;
  }

  private fmtMethodSig(m: MethodSignature): string {
    const params = this.fmtParams(m.params);
    const ret = m.returnType ? `: ${m.returnType.name}` : '';
    const body = m.folded ? '...' : '{}';
    return `${m.name}(${params})${ret} → ${body}`;
  }

  private fmtUse(stmt: UseStatement): string {
    return `${this.indent()}use ${JSON.stringify(stmt.path)}`;
  }

  private fmtPub(stmt: PubStatement): string {
    const inner = this.fmtStatement(stmt.inner).trimStart();
    return `${this.indent()}pub ${inner}`;
  }

  // ===== Expressions =====

  private fmtExpr(expr: Expression): string {
    switch (expr.kind) {
      case 'NumberLiteral':  return expr.raw;
      case 'StringLiteral':  return JSON.stringify(expr.value);
      case 'BooleanLiteral': return expr.value ? 'true' : 'false';
      case 'NullLiteral':    return 'null';
      case 'Identifier':     return expr.name;
      case 'ArrayLiteral':   return this.fmtArray(expr);
      case 'BinaryExpression': return this.fmtBinary(expr);
      case 'UnaryExpression':  return this.fmtUnary(expr);
      case 'CallExpression':   return this.fmtCall(expr);
      case 'MemberExpression': return `${this.fmtExpr(expr.object)}.${expr.property}`;
      case 'ShorthandExpression': return this.fmtShorthand(expr);
      case 'FunctionExpression':  return this.fmtFunctionExpr(expr);
      case 'IfExpression': {
        const c = this.fmtExpr(expr.condition);
        const t = this.fmtExpr(expr.then);
        const e = expr.else ? ` : ${this.fmtExpr(expr.else)}` : '';
        return `${c} ? ${t}${e}`;
      }
      case 'MatchExpression':    return this.fmtMatch(expr);
      case 'MembershipExpression':
        return expr.negated ? `¬(${expr.category})` : `∈(${expr.category})`;
      default:
        return '(?)';
    }
  }

  private fmtArray(expr: ArrayLiteral): string {
    if (expr.elements.length === 0) return '[]';
    const items = expr.elements.map(e => this.fmtExpr(e)).join(', ');
    return `[${items}]`;
  }

  private fmtBinary(expr: BinaryExpression): string {
    const l = this.fmtExprParens(expr.left, expr);
    const r = this.fmtExprParens(expr.right, expr);
    return `${l} ${expr.op} ${r}`;
  }

  private fmtUnary(expr: UnaryExpression): string {
    return `${expr.op}${this.fmtExpr(expr.operand)}`;
  }

  private fmtCall(expr: CallExpression): string {
    const callee = this.fmtExpr(expr.callee);
    const args = expr.args.map(a => this.fmtExpr(a)).join(', ');
    return `${callee}(${args})`;
  }

  private fmtShorthand(expr: ShorthandExpression): string {
    const args = expr.args.map((a: ShorthandArg) =>
      a.name ? `${a.name}=${this.fmtExpr(a.value)}` : this.fmtExpr(a.value)
    ).join(', ');
    return `${expr.name}${expr.suffix}[${args}]`;
  }

  private fmtFunctionExpr(expr: FunctionExpression): string {
    const params = this.fmtParams(expr.params);
    if (Array.isArray(expr.body)) {
      const body = this.fmtBlockStatements(expr.body);
      return `(${params}): {\n${body}\n${this.indent()}}`;
    }
    return `(${params}): ${this.fmtExpr(expr.body as Expression)}`;
  }

  private fmtMatch(expr: MatchExpression): string {
    const subject = this.fmtExpr(expr.subject);
    const arms = expr.arms.map((arm: MatchArm) => {
      const pattern = this.fmtPattern(arm.pattern);
      const guard = arm.guard ? ` if ${this.fmtExpr(arm.guard)}` : '';
      const body = this.fmtExpr(arm.body);
      return `| ${pattern}${guard} → ${body}`;
    }).join('\n' + this.indent() + '  ');
    return `match ${subject}\n${this.indent()}  ${arms}`;
  }

  private fmtPattern(p: MatchArm['pattern']): string {
    switch (p.kind) {
      case 'WildcardPattern': return '_';
      case 'NumberLiteral':   return p.raw;
      case 'StringLiteral':   return JSON.stringify(p.value);
      case 'BooleanLiteral':  return p.value ? 'true' : 'false';
      case 'NullLiteral':     return 'null';
      case 'Identifier':      return p.name;
      default:                return '_';
    }
  }

  // ===== Helpers =====

  private fmtParams(params: Param[]): string {
    return params.map(p => {
      if (p.typeAnnotation) return `${p.name}: ${p.typeAnnotation.name}`;
      return p.name;
    }).join(', ');
  }

  private fmtBlockStatements(stmts: Statement[]): string {
    this.level++;
    const lines = stmts.map(s => this.fmtStatement(s));
    this.level--;
    return lines.join('\n');
  }

  private indent(): string {
    return ' '.repeat(this.level * this.indentWidth);
  }

  /**
   * Wrap expr in parens if its precedence is lower than the parent binary op.
   * This is a simplified check — just wrap BinaryExpression children when
   * the parent has higher precedence.
   */
  private fmtExprParens(expr: Expression, parent: BinaryExpression): string {
    if (expr.kind === 'BinaryExpression') {
      const parentPrec = opPrecedence(parent.op);
      const childPrec = opPrecedence(expr.op);
      if (childPrec < parentPrec) return `(${this.fmtExpr(expr)})`;
    }
    return this.fmtExpr(expr);
  }
}

function opPrecedence(op: string): number {
  switch (op) {
    case '||': return 1;
    case '&&': return 2;
    case '==': case '!=': return 3;
    case '<': case '>': case '<=': case '>=': return 4;
    case '+': case '-': return 5;
    case '*': case '/': case '%': return 6;
    case '**': return 7;
    default: return 0;
  }
}
