import { TokenType, type Token, type SourceLocation } from '../lexer/tokens.js';
import type * as AST from '../ast/nodes.js';
import { ParseError, unexpectedToken } from '../errors/diagnostic.js';

export class Parser {
  private tokens: Token[];
  private pos = 0;
  private source: string;

  constructor(tokens: Token[], source = '') {
    this.tokens = tokens;
    this.source = source;
  }

  parse(): AST.Program {
    const body: AST.Statement[] = [];
    this.skipNewlines();

    while (!this.isAtEnd()) {
      const stmt = this.parseStatement();
      if (stmt) body.push(stmt);
      this.skipNewlines();
    }

    return { kind: 'Program', body, loc: { line: 1, column: 1, offset: 0 } };
  }

  // ===== Statement Parsing =====

  private parseStatement(): AST.Statement | null {
    const token = this.current();

    // TOON block: identifier[count]{fields}: or identifier{fields}:
    if (token.type === TokenType.Identifier && this.isToonHeader()) {
      return this.parseToonBlock();
    }

    // Type declaration: Identifier{fields}{ methods }
    if (token.type === TokenType.Identifier && this.isTypeDeclaration()) {
      return this.parseTypeDeclaration();
    }

    // Parse as expression, then determine statement type
    const expr = this.parseExpression();

    // Pipeline: expr → select ...
    if (this.check(TokenType.Arrow)) {
      return this.parsePipelineStatement(expr);
    }

    // Conditional: expr ⇒ actions
    if (this.check(TokenType.Implies)) {
      return this.parseConditionalStatement(expr);
    }

    // Composition: ident ∘ ident ∘ ...
    if (this.check(TokenType.Compose) && expr.kind === 'Identifier') {
      return this.parseCompositionStatement(expr);
    }

    // Assignment: ident = expr
    if (this.check(TokenType.Assign) && expr.kind === 'Identifier') {
      this.advance(); // consume =
      const value = this.parseExpression();
      return {
        kind: 'AssignmentStatement',
        name: expr.name,
        value,
        loc: expr.loc,
      };
    }

    return { kind: 'ExpressionStatement', expression: expr, loc: expr.loc };
  }

  private parsePipelineStatement(source: AST.Expression): AST.PipelineStatement {
    const loc = source.loc;
    this.expect(TokenType.Arrow);

    const selector = this.parseSelector();

    return { kind: 'PipelineStatement', source, selector, loc };
  }

  private parseSelector(): AST.Selector {
    const loc = this.current().loc;
    const filters: AST.FilterExpression[] = [];

    // Optional 'select' keyword
    if (this.check(TokenType.Select)) {
      this.advance();
    }

    filters.push(this.parseFilterExpression());

    while (this.check(TokenType.Intersect)) {
      this.advance();
      filters.push(this.parseFilterExpression());
    }

    return { kind: 'Selector', filters, loc };
  }

  private parseFilterExpression(): AST.FilterExpression {
    // ∈(category) - membership
    if (this.check(TokenType.In)) {
      return this.parseMembershipExpression(false);
    }

    // ¬(category) - negated membership
    if (this.check(TokenType.Not)) {
      const loc = this.current().loc;
      this.advance();
      if (this.check(TokenType.LParen)) {
        this.advance();
        const name = this.expectIdentifier();
        this.expect(TokenType.RParen);
        return { kind: 'MembershipExpression', category: name, negated: true, loc };
      }
      // Not followed by paren - treat as unary not
      const operand = this.parsePrimary();
      return { kind: 'UnaryExpression', op: '¬', operand, loc };
    }

    return this.parseExpression();
  }

  private parseMembershipExpression(negated: boolean): AST.MembershipExpression {
    const loc = this.current().loc;
    this.advance(); // consume ∈
    this.expect(TokenType.LParen);
    const category = this.expectIdentifier();
    this.expect(TokenType.RParen);
    return { kind: 'MembershipExpression', category, negated, loc };
  }

  private parseConditionalStatement(condition: AST.Expression): AST.ConditionalStatement {
    const loc = condition.loc;
    this.expect(TokenType.Implies);

    const actions: AST.Action[] = [];
    actions.push(this.parseAction());

    while (this.check(TokenType.Pipe)) {
      this.advance();
      actions.push(this.parseAction());
    }

    return { kind: 'ConditionalStatement', condition, actions, loc };
  }

  private parseAction(): AST.Action {
    const loc = this.current().loc;
    const name = this.expectIdentifier();
    this.expect(TokenType.Colon);
    const value = this.parseExpression();
    return { kind: 'Action', name, value, loc };
  }

  private parseCompositionStatement(first: AST.Identifier): AST.CompositionStatement {
    const loc = first.loc;
    const functions = [first.name];

    while (this.check(TokenType.Compose)) {
      this.advance();
      functions.push(this.expectIdentifier());
    }

    return { kind: 'CompositionStatement', functions, loc };
  }

  // ===== Expression Parsing (Pratt-style precedence) =====

  parseExpression(): AST.Expression {
    return this.parseComparison();
  }

  private parseComparison(): AST.Expression {
    let left = this.parseAddition();

    while (
      this.check(TokenType.Gt) ||
      this.check(TokenType.Lt) ||
      this.check(TokenType.Gte) ||
      this.check(TokenType.Lte) ||
      this.check(TokenType.Eq) ||
      this.check(TokenType.Neq)
    ) {
      const op = this.advance().value;
      const right = this.parseAddition();
      left = { kind: 'BinaryExpression', op, left, right, loc: left.loc };
    }

    return left;
  }

  private parseAddition(): AST.Expression {
    let left = this.parseMultiplication();

    while (this.check(TokenType.Plus) || this.check(TokenType.Minus)) {
      const op = this.advance().value;
      const right = this.parseMultiplication();
      left = { kind: 'BinaryExpression', op, left, right, loc: left.loc };
    }

    return left;
  }

  private parseMultiplication(): AST.Expression {
    let left = this.parseUnary();

    while (this.check(TokenType.Star) || this.check(TokenType.Slash)) {
      const op = this.advance().value;
      const right = this.parseUnary();
      left = { kind: 'BinaryExpression', op, left, right, loc: left.loc };
    }

    return left;
  }

  private parseUnary(): AST.Expression {
    if (this.check(TokenType.Not) || this.check(TokenType.Bang)) {
      const loc = this.current().loc;
      this.advance();
      const operand = this.parseUnary();
      return { kind: 'UnaryExpression', op: '¬', operand, loc };
    }
    if (this.check(TokenType.Minus)) {
      const loc = this.current().loc;
      this.advance();
      const operand = this.parseUnary();
      return { kind: 'UnaryExpression', op: '-', operand, loc };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): AST.Expression {
    let expr = this.parsePrimary();

    while (true) {
      // Member access: expr.property
      if (this.check(TokenType.Dot)) {
        this.advance();
        const property = this.expectIdentifier();
        expr = { kind: 'MemberExpression', object: expr, property, loc: expr.loc };
        continue;
      }

      // Function call: expr(args)
      if (this.check(TokenType.LParen)) {
        this.advance();
        const args: AST.Expression[] = [];
        if (!this.check(TokenType.RParen)) {
          args.push(this.parseExpression());
          while (this.check(TokenType.Comma)) {
            this.advance();
            args.push(this.parseExpression());
          }
        }
        this.expect(TokenType.RParen);
        expr = { kind: 'CallExpression', callee: expr, args, loc: expr.loc };
        continue;
      }

      break;
    }

    return expr;
  }

  parsePrimary(): AST.Expression {
    const token = this.current();

    // Number
    if (token.type === TokenType.Number) {
      this.advance();
      return { kind: 'NumberLiteral', value: parseFloat(token.value), raw: token.value, loc: token.loc };
    }

    // String
    if (token.type === TokenType.String) {
      this.advance();
      return { kind: 'StringLiteral', value: token.value, loc: token.loc };
    }

    // Boolean
    if (token.type === TokenType.True) {
      this.advance();
      return { kind: 'BooleanLiteral', value: true, loc: token.loc };
    }
    if (token.type === TokenType.False) {
      this.advance();
      return { kind: 'BooleanLiteral', value: false, loc: token.loc };
    }

    // ∈(category)
    if (token.type === TokenType.In) {
      return this.parseMembershipExpression(false);
    }

    // Parenthesized expression
    if (token.type === TokenType.LParen) {
      this.advance();
      const expr = this.parseExpression();
      this.expect(TokenType.RParen);
      return expr;
    }

    // Array literal
    if (token.type === TokenType.LBracket) {
      return this.parseArrayLiteral();
    }

    // Identifier (possibly followed by shorthand suffix)
    if (token.type === TokenType.Identifier) {
      this.advance();
      const name = token.value;

      // Shorthand: ident?[...], ident![...], ident@[...]
      if (
        (this.check(TokenType.Query) || this.check(TokenType.Bang) || this.check(TokenType.At)) &&
        this.peekAt(1)?.type === TokenType.LBracket
      ) {
        return this.parseShorthandExpression(name, token.loc);
      }

      return { kind: 'Identifier', name, loc: token.loc };
    }

    throw unexpectedToken(token, 'expression', this.source);
  }

  private parseShorthandExpression(name: string, loc: SourceLocation): AST.ShorthandExpression {
    const suffixToken = this.advance();
    const suffix = suffixToken.value as '?' | '!' | '@';
    this.expect(TokenType.LBracket);

    const args: AST.ShorthandArg[] = [];
    if (!this.check(TokenType.RBracket)) {
      args.push(this.parseShorthandArg());
      while (this.check(TokenType.Comma)) {
        this.advance();
        args.push(this.parseShorthandArg());
      }
    }

    this.expect(TokenType.RBracket);
    return { kind: 'ShorthandExpression', name, suffix, args, loc };
  }

  private parseShorthandArg(): AST.ShorthandArg {
    const loc = this.current().loc;

    // Check for named arg: identifier=expression
    if (
      this.current().type === TokenType.Identifier &&
      this.peekAt(1)?.type === TokenType.Assign
    ) {
      const name = this.advance().value;
      this.advance(); // consume =
      const value = this.parseExpression();
      return { kind: 'ShorthandArg', name, value, loc };
    }

    const value = this.parseExpression();
    return { kind: 'ShorthandArg', name: null, value, loc };
  }

  private parseArrayLiteral(): AST.ArrayLiteral {
    const loc = this.current().loc;
    this.expect(TokenType.LBracket);

    const elements: AST.Expression[] = [];
    if (!this.check(TokenType.RBracket)) {
      elements.push(this.parseExpression());
      while (this.check(TokenType.Comma)) {
        this.advance();
        if (this.check(TokenType.RBracket)) break; // trailing comma
        elements.push(this.parseExpression());
      }
    }

    this.expect(TokenType.RBracket);
    return { kind: 'ArrayLiteral', elements, loc };
  }

  // ===== TOON Block Parsing =====

  private isToonHeader(): boolean {
    // Look ahead: identifier[number]{fields}: or identifier{fields}:
    let i = this.pos + 1;

    // Optional [count]
    if (i < this.tokens.length && this.tokens[i].type === TokenType.LBracket) {
      i++; // skip [
      if (i < this.tokens.length && this.tokens[i].type === TokenType.Number) i++;
      if (i < this.tokens.length && this.tokens[i].type === TokenType.RBracket) i++;
      else return false;
    }

    // Required {fields}
    if (i >= this.tokens.length || this.tokens[i].type !== TokenType.LBrace) return false;

    // Scan for matching } then :
    let depth = 1;
    i++;
    while (i < this.tokens.length && depth > 0) {
      if (this.tokens[i].type === TokenType.LBrace) depth++;
      if (this.tokens[i].type === TokenType.RBrace) depth--;
      i++;
    }

    return i < this.tokens.length && this.tokens[i].type === TokenType.Colon;
  }

  private parseToonBlock(): AST.ToonBlock {
    const loc = this.current().loc;
    const name = this.expectIdentifier();

    // Optional [count]
    let count: number | null = null;
    if (this.check(TokenType.LBracket)) {
      this.advance();
      const numToken = this.expect(TokenType.Number);
      count = parseInt(numToken.value, 10);
      this.expect(TokenType.RBracket);
    }

    // Required {field1, field2, ...}
    this.expect(TokenType.LBrace);
    const fields: string[] = [];
    fields.push(this.expectIdentifier());
    while (this.check(TokenType.Comma)) {
      this.advance();
      fields.push(this.expectIdentifier());
    }
    this.expect(TokenType.RBrace);
    this.expect(TokenType.Colon);

    // Parse rows (newline-delimited, comma-separated values)
    this.skipNewlines();
    const rows: AST.ToonRow[] = [];

    while (!this.isAtEnd() && !this.isBlankLine() && !this.isStatementStart()) {
      const row = this.parseToonRow(fields.length);
      if (row) rows.push(row);
      this.skipNewlines();
    }

    return { kind: 'ToonBlock', name, count, fields, rows, loc };
  }

  private parseToonRow(fieldCount: number): AST.ToonRow | null {
    const loc = this.current().loc;
    const values: AST.ToonValue[] = [];

    // Read comma-separated values
    values.push(this.parseToonValue());
    while (this.check(TokenType.Comma)) {
      this.advance();
      values.push(this.parseToonValue());
    }

    if (values.length === 0) return null;
    return { kind: 'ToonRow', values, loc };
  }

  private parseToonValue(): AST.ToonValue {
    const token = this.current();

    if (token.type === TokenType.Number) {
      this.advance();
      const num = parseFloat(token.value);
      return Number.isInteger(num) ? num : num;
    }

    if (token.type === TokenType.String) {
      this.advance();
      return token.value;
    }

    if (token.type === TokenType.True) {
      this.advance();
      return true;
    }

    if (token.type === TokenType.False) {
      this.advance();
      return false;
    }

    // Bare identifier treated as string value in TOON context
    if (token.type === TokenType.Identifier) {
      this.advance();
      return token.value;
    }

    // Negative numbers
    if (token.type === TokenType.Minus) {
      this.advance();
      const numToken = this.current();
      if (numToken.type === TokenType.Number) {
        this.advance();
        return -parseFloat(numToken.value);
      }
    }

    throw unexpectedToken(token, 'TOON value', this.source);
  }

  // ===== Type Declaration (AST Folding) =====

  private isTypeDeclaration(): boolean {
    // Look ahead: Identifier{...}{...} (two brace blocks)
    let i = this.pos + 1;
    if (i >= this.tokens.length || this.tokens[i].type !== TokenType.LBrace) return false;

    // Find matching } of first brace block
    let depth = 1;
    i++;
    while (i < this.tokens.length && depth > 0) {
      if (this.tokens[i].type === TokenType.LBrace) depth++;
      if (this.tokens[i].type === TokenType.RBrace) depth--;
      i++;
    }

    // Must be followed by second {
    return i < this.tokens.length && this.tokens[i].type === TokenType.LBrace;
  }

  private parseTypeDeclaration(): AST.TypeDeclaration {
    const loc = this.current().loc;
    const name = this.expectIdentifier();

    // First {}: fields
    this.expect(TokenType.LBrace);
    const fields: string[] = [];
    if (!this.check(TokenType.RBrace)) {
      fields.push(this.expectIdentifier());
      while (this.check(TokenType.Comma)) {
        this.advance();
        if (this.check(TokenType.RBrace)) break;
        fields.push(this.expectIdentifier());
      }
    }
    this.expect(TokenType.RBrace);

    // Second {}: methods
    this.expect(TokenType.LBrace);
    this.skipNewlines();
    const methods: AST.MethodSignature[] = [];
    while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
      methods.push(this.parseMethodSignature());
      this.skipNewlines();
    }
    this.expect(TokenType.RBrace);

    return { kind: 'TypeDeclaration', name, fields, methods, loc };
  }

  private parseMethodSignature(): AST.MethodSignature {
    const loc = this.current().loc;
    const name = this.expectIdentifier();

    this.expect(TokenType.LParen);
    const params: AST.Param[] = [];
    if (!this.check(TokenType.RParen)) {
      params.push(this.parseParam());
      while (this.check(TokenType.Comma)) {
        this.advance();
        if (this.check(TokenType.RParen)) break;
        params.push(this.parseParam());
      }
    }
    this.expect(TokenType.RParen);

    // Optional return type or folded body
    // : ... = folded body (no return type)
    // : Type : ... = return type then folded body
    let returnType: AST.TypeExpr | null = null;
    let folded = false;

    if (this.check(TokenType.Colon)) {
      this.advance(); // consume first :
      if (this.check(TokenType.Ellipsis)) {
        this.advance();
        folded = true;
      } else {
        // Parse return type
        returnType = this.parseTypeExpr();
        // Then expect : ...
        if (this.check(TokenType.Colon)) {
          this.advance();
          if (this.check(TokenType.Ellipsis)) {
            this.advance();
            folded = true;
          }
        }
      }
    }

    return { kind: 'MethodSignature', name, params, returnType, folded, loc };
  }

  private parseParam(): AST.Param {
    const loc = this.current().loc;
    const name = this.expectIdentifier();
    let typeAnnotation: AST.TypeExpr | null = null;

    if (this.check(TokenType.Colon)) {
      this.advance();
      typeAnnotation = this.parseTypeExpr();
    }

    return { kind: 'Param', name, typeAnnotation, loc };
  }

  private parseTypeExpr(): AST.TypeExpr {
    const loc = this.current().loc;
    const name = this.expectIdentifier();
    const typeArgs: AST.TypeExpr[] = [];

    // Generic args: Type<T, U>
    if (this.check(TokenType.Lt)) {
      this.advance();
      typeArgs.push(this.parseTypeExpr());
      while (this.check(TokenType.Comma)) {
        this.advance();
        typeArgs.push(this.parseTypeExpr());
      }
      this.expect(TokenType.Gt);
    }

    return { kind: 'TypeExpr', name, typeArgs, loc };
  }

  // ===== Utility Methods =====

  private current(): Token {
    return this.tokens[this.pos] ?? { type: TokenType.EOF, value: '', loc: { line: 0, column: 0, offset: 0 } };
  }

  private peekAt(offset: number): Token | undefined {
    return this.tokens[this.pos + offset];
  }

  private check(type: TokenType): boolean {
    return this.current().type === type;
  }

  private advance(): Token {
    const token = this.current();
    this.pos++;
    return token;
  }

  private expect(type: TokenType): Token {
    const token = this.current();
    if (token.type !== type) {
      throw unexpectedToken(token, type, this.source);
    }
    this.pos++;
    return token;
  }

  private expectIdentifier(): string {
    const token = this.expect(TokenType.Identifier);
    return token.value;
  }

  private isAtEnd(): boolean {
    return this.current().type === TokenType.EOF;
  }

  private skipNewlines(): void {
    while (this.check(TokenType.Newline) || this.check(TokenType.Comment)) {
      this.advance();
    }
  }

  private isBlankLine(): boolean {
    // Check if current position starts a new section (not a TOON data row)
    const token = this.current();
    return token.type === TokenType.EOF || token.type === TokenType.Newline;
  }

  private isStatementStart(): boolean {
    // Heuristic: if current token is identifier followed by { or → or ⇒ or ∘, it's a new statement
    const token = this.current();
    if (token.type !== TokenType.Identifier) return false;
    const next = this.peekAt(1);
    if (!next) return false;
    return (
      next.type === TokenType.LBrace ||
      next.type === TokenType.Arrow ||
      next.type === TokenType.Implies ||
      next.type === TokenType.Compose
    );
  }

}
