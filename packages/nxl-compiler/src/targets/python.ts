import type * as AST from '@nxl/core';
import { Emitter } from '../codegen/emitter.js';

export function compileToPython(program: AST.Program): string {
  const emitter = new Emitter();
  const gen = new PythonGenerator(emitter);
  gen.emitProgram(program);
  return emitter.toString();
}

class PythonGenerator {
  constructor(private e: Emitter) {}

  emitProgram(program: AST.Program): void {
    for (const stmt of program.body) {
      this.emitStatement(stmt);
      this.e.writeln();
    }
  }

  emitStatement(stmt: AST.Statement): void {
    switch (stmt.kind) {
      case 'PipelineStatement':
        return this.emitPipeline(stmt);
      case 'ConditionalStatement':
        return this.emitConditional(stmt);
      case 'CompositionStatement':
        return this.emitComposition(stmt);
      case 'AssignmentStatement':
        return this.emitAssignment(stmt);
      case 'ExpressionStatement':
        this.e.writeln(this.emitExpr(stmt.expression));
        return;
      case 'ToonBlock':
        return this.emitToonBlock(stmt);
      case 'TypeDeclaration':
        return this.emitTypeDeclaration(stmt);
    }
  }

  // tasks → select ∈(ready) ∩ ¬(blocked) ∩ priority>5
  // → [t for t in tasks if t.status == 'ready' and not t.blocked and t.priority > 5]
  private emitPipeline(stmt: AST.PipelineStatement): void {
    const source = this.emitExpr(stmt.source);
    const conditions = stmt.selector.filters.map(f => this.emitFilterCondition(f));
    const filterStr = conditions.join(' and ');

    if (filterStr) {
      this.e.writeln(`${source} = [item for item in ${source} if ${filterStr}]`);
    } else {
      this.e.writeln(`${source} = list(${source})`);
    }
  }

  private emitFilterCondition(filter: AST.FilterExpression): string {
    if (filter.kind === 'MembershipExpression') {
      if (filter.negated) {
        return `not item.${filter.category}`;
      }
      return `item.status == '${filter.category}'`;
    }

    // Binary expression: rewrite to item.property > value
    if (filter.kind === 'BinaryExpression') {
      const left = this.rewriteFieldRef(filter.left);
      const right = this.emitExpr(filter.right);
      return `${left} ${filter.op} ${right}`;
    }

    return this.emitExpr(filter);
  }

  private rewriteFieldRef(expr: AST.Expression): string {
    if (expr.kind === 'Identifier') {
      return `item.${expr.name}`;
    }
    return this.emitExpr(expr);
  }

  // priority>5 ⇒ exec:immediate | log:high_priority
  // → if priority > 5:
  //       exec_immediate()
  //       log_high_priority()
  private emitConditional(stmt: AST.ConditionalStatement): void {
    this.e.writeln(`if ${this.emitExpr(stmt.condition)}:`);
    this.e.indent();
    for (const action of stmt.actions) {
      this.e.writeln(`${action.name}(${this.emitExpr(action.value)})`);
    }
    this.e.dedent();
  }

  // retrieve ∘ validate ∘ transform ∘ store
  // → store(transform(validate(retrieve())))
  private emitComposition(stmt: AST.CompositionStatement): void {
    const fns = stmt.functions;
    let result = `${fns[0]}()`;
    for (let i = 1; i < fns.length; i++) {
      result = `${fns[i]}(${result})`;
    }
    this.e.writeln(result);
  }

  private emitAssignment(stmt: AST.AssignmentStatement): void {
    this.e.writeln(`${stmt.name} = ${this.emitExpr(stmt.value)}`);
  }

  // TOON → dataclass + list
  private emitToonBlock(block: AST.ToonBlock): void {
    const className = capitalize(block.name);
    this.e.writeln('from dataclasses import dataclass');
    this.e.writeln();
    this.e.writeln(`@dataclass`);
    this.e.writeln(`class ${className}:`);
    this.e.indent();
    for (const field of block.fields) {
      this.e.writeln(`${field}: str | int | float | bool | None = None`);
    }
    this.e.dedent();
    this.e.writeln();

    this.e.writeln(`${block.name} = [`);
    this.e.indent();
    for (const row of block.rows) {
      const args = block.fields.map((field, i) => {
        const val = i < row.values.length ? row.values[i] : null;
        return `${field}=${this.emitToonValue(val)}`;
      }).join(', ');
      this.e.writeln(`${className}(${args}),`);
    }
    this.e.dedent();
    this.e.writeln(']');
  }

  private emitToonValue(value: AST.ToonValue): string {
    if (value === null) return 'None';
    if (typeof value === 'boolean') return value ? 'True' : 'False';
    if (typeof value === 'number') return String(value);
    return `'${value}'`;
  }

  // Type declarations → class with stub methods
  private emitTypeDeclaration(decl: AST.TypeDeclaration): void {
    this.e.writeln(`class ${decl.name}:`);
    this.e.indent();

    // __init__ from fields
    if (decl.fields.length > 0) {
      const params = decl.fields.map(f => `${f}=None`).join(', ');
      this.e.writeln(`def __init__(self, ${params}):`);
      this.e.indent();
      for (const field of decl.fields) {
        this.e.writeln(`self.${field} = ${field}`);
      }
      this.e.dedent();
      this.e.writeln();
    }

    for (const method of decl.methods) {
      const params = method.params.map(p => p.name).join(', ');
      const allParams = params ? `self, ${params}` : 'self';
      this.e.writeln(`def ${method.name}(${allParams}):`);
      this.e.indent();
      this.e.writeln(method.folded ? 'pass' : 'pass');
      this.e.dedent();
      this.e.writeln();
    }

    this.e.dedent();
  }

  emitExpr(expr: AST.Expression): string {
    switch (expr.kind) {
      case 'NumberLiteral':
        return expr.raw;
      case 'StringLiteral':
        return `'${expr.value}'`;
      case 'BooleanLiteral':
        return expr.value ? 'True' : 'False';
      case 'Identifier':
        return expr.name;
      case 'BinaryExpression':
        return `${this.emitExpr(expr.left)} ${expr.op} ${this.emitExpr(expr.right)}`;
      case 'UnaryExpression':
        if (expr.op === '¬') return `not ${this.emitExpr(expr.operand)}`;
        return `${expr.op}${this.emitExpr(expr.operand)}`;
      case 'MembershipExpression':
        return expr.negated
          ? `not item.${expr.category}`
          : `item.status == '${expr.category}'`;
      case 'ShorthandExpression':
        return this.emitShorthand(expr);
      case 'CallExpression':
        return `${this.emitExpr(expr.callee)}(${expr.args.map(a => this.emitExpr(a)).join(', ')})`;
      case 'MemberExpression':
        return `${this.emitExpr(expr.object)}.${expr.property}`;
      case 'ArrayLiteral':
        return `[${expr.elements.map(e => this.emitExpr(e)).join(', ')}]`;
    }
  }

  private emitShorthand(expr: AST.ShorthandExpression): string {
    // Map shorthand to Python function calls
    const mapping: Record<string, string> = {
      'mem?': 'memory.search',
      'mem!': 'memory.insert',
      'hire!': 'agent.spawn',
      'fire!': 'agent.terminate',
      'exec@': 'runtime.execute',
      'watch@': 'monitor.observe',
    };

    const key = `${expr.name}${expr.suffix}`;
    const fn = mapping[key] ?? `${expr.name}`;

    const args = expr.args.map(arg => {
      const val = this.emitExpr(arg.value);
      return arg.name ? `${arg.name}=${val}` : val;
    }).join(', ');

    return `${fn}(${args})`;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
