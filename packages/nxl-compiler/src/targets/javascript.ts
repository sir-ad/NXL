import type * as AST from '@nxl/core';
import { Emitter } from '../codegen/emitter.js';

export function compileToJavaScript(program: AST.Program): string {
  const emitter = new Emitter();
  const gen = new JSGenerator(emitter);
  gen.emitProgram(program);
  return emitter.toString();
}

class JSGenerator {
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
        this.e.writeln(`${this.emitExpr(stmt.expression)};`);
        return;
      case 'ToonBlock':
        return this.emitToonBlock(stmt);
      case 'TypeDeclaration':
        return this.emitTypeDeclaration(stmt);
    }
  }

  private emitPipeline(stmt: AST.PipelineStatement): void {
    const source = this.emitExpr(stmt.source);
    const conditions = stmt.selector.filters.map(f => this.emitFilterCondition(f));
    const filterStr = conditions.join(' && ');

    if (filterStr) {
      this.e.writeln(`${source} = ${source}.filter(item => ${filterStr});`);
    }
  }

  private emitFilterCondition(filter: AST.FilterExpression): string {
    if (filter.kind === 'MembershipExpression') {
      if (filter.negated) return `!item.${filter.category}`;
      return `item.status === '${filter.category}'`;
    }
    if (filter.kind === 'BinaryExpression') {
      const left = filter.left.kind === 'Identifier' ? `item.${filter.left.name}` : this.emitExpr(filter.left);
      return `${left} ${filter.op === '==' ? '===' : filter.op} ${this.emitExpr(filter.right)}`;
    }
    return this.emitExpr(filter);
  }

  private emitConditional(stmt: AST.ConditionalStatement): void {
    this.e.writeln(`if (${this.emitExpr(stmt.condition)}) {`);
    this.e.indent();
    for (const action of stmt.actions) {
      this.e.writeln(`${action.name}(${this.emitExpr(action.value)});`);
    }
    this.e.dedent();
    this.e.writeln('}');
  }

  private emitComposition(stmt: AST.CompositionStatement): void {
    const fns = stmt.functions;
    let result = `${fns[0]}()`;
    for (let i = 1; i < fns.length; i++) {
      result = `${fns[i]}(${result})`;
    }
    this.e.writeln(`${result};`);
  }

  private emitAssignment(stmt: AST.AssignmentStatement): void {
    this.e.writeln(`const ${stmt.name} = ${this.emitExpr(stmt.value)};`);
  }

  private emitToonBlock(block: AST.ToonBlock): void {
    this.e.writeln(`const ${block.name} = [`);
    this.e.indent();
    for (const row of block.rows) {
      this.e.write('{ ');
      const pairs = block.fields.map((field, i) => {
        const val = i < row.values.length ? row.values[i] : null;
        return `${field}: ${this.emitToonValue(val)}`;
      });
      this.e.write(pairs.join(', '));
      this.e.writeln(' },');
    }
    this.e.dedent();
    this.e.writeln('];');
  }

  private emitToonValue(value: AST.ToonValue): string {
    if (value === null) return 'null';
    if (typeof value === 'boolean') return String(value);
    if (typeof value === 'number') return String(value);
    return `'${value}'`;
  }

  private emitTypeDeclaration(decl: AST.TypeDeclaration): void {
    this.e.writeln(`class ${decl.name} {`);
    this.e.indent();

    // Constructor from fields
    if (decl.fields.length > 0) {
      const params = decl.fields.map(f => `${f}`).join(', ');
      this.e.writeln(`constructor(${params}) {`);
      this.e.indent();
      for (const field of decl.fields) {
        this.e.writeln(`this.${field} = ${field};`);
      }
      this.e.dedent();
      this.e.writeln('}');
      this.e.writeln();
    }

    for (const method of decl.methods) {
      const params = method.params.map(p => p.name).join(', ');
      this.e.writeln(`${method.name}(${params}) {`);
      this.e.indent();
      this.e.writeln(`throw new Error('Not implemented');`);
      this.e.dedent();
      this.e.writeln('}');
      this.e.writeln();
    }

    this.e.dedent();
    this.e.writeln('}');
  }

  emitExpr(expr: AST.Expression): string {
    switch (expr.kind) {
      case 'NumberLiteral':
        return expr.raw;
      case 'StringLiteral':
        return `'${expr.value}'`;
      case 'BooleanLiteral':
        return String(expr.value);
      case 'Identifier':
        return expr.name;
      case 'BinaryExpression': {
        const op = expr.op === '==' ? '===' : expr.op === '!=' ? '!==' : expr.op;
        return `${this.emitExpr(expr.left)} ${op} ${this.emitExpr(expr.right)}`;
      }
      case 'UnaryExpression':
        if (expr.op === '¬') return `!${this.emitExpr(expr.operand)}`;
        return `${expr.op}${this.emitExpr(expr.operand)}`;
      case 'MembershipExpression':
        return expr.negated
          ? `!item.${expr.category}`
          : `item.status === '${expr.category}'`;
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
    const mapping: Record<string, string> = {
      'mem?': 'memory.search',
      'mem!': 'memory.insert',
      'hire!': 'agent.spawn',
      'fire!': 'agent.terminate',
      'exec@': 'runtime.execute',
      'watch@': 'monitor.observe',
    };

    const key = `${expr.name}${expr.suffix}`;
    const fn = mapping[key] ?? expr.name;

    const args = expr.args.map(arg => {
      const val = this.emitExpr(arg.value);
      return arg.name ? `${arg.name}: ${val}` : val;
    }).join(', ');

    // Named args → object parameter
    const hasNamedArgs = expr.args.some(a => a.name !== null);
    if (hasNamedArgs) {
      return `${fn}({ ${args} })`;
    }
    return `${fn}(${args})`;
  }
}
