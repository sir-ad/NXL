import {
  TokenType,
  KEYWORDS,
  METAGLYPH_UNICODE,
  type Token,
  type SourceLocation,
} from './tokens.js';

export class Lexer {
  private source: string;
  private chars: string[];
  private pos = 0;
  private line = 1;
  private column = 1;

  constructor(source: string) {
    this.source = source;
    // Use spread to handle multi-byte Unicode correctly
    this.chars = [...source];
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.pos < this.chars.length) {
      const ch = this.chars[this.pos];

      // Skip spaces and tabs (not newlines)
      if (ch === ' ' || ch === '\t') {
        this.advance();
        continue;
      }

      // Newlines
      if (ch === '\n') {
        tokens.push(this.makeToken(TokenType.Newline, '\n'));
        this.advance();
        this.line++;
        this.column = 1;
        continue;
      }
      if (ch === '\r') {
        this.advance();
        if (this.pos < this.chars.length && this.chars[this.pos] === '\n') {
          this.advance();
        }
        tokens.push(this.makeToken(TokenType.Newline, '\n'));
        this.line++;
        this.column = 1;
        continue;
      }

      // Comments
      if (ch === '/' && this.peek() === '/') {
        this.readComment();
        continue;
      }

      // Unicode MetaGlyph symbols
      const mgType = METAGLYPH_UNICODE[ch];
      if (mgType !== undefined) {
        tokens.push(this.makeToken(mgType, ch));
        this.advance();
        continue;
      }

      // Numbers
      if (this.isDigit(ch)) {
        tokens.push(this.readNumber());
        continue;
      }

      // Strings
      if (ch === '"' || ch === "'") {
        tokens.push(this.readString(ch));
        continue;
      }

      // Identifiers and keywords
      if (this.isIdentStart(ch)) {
        tokens.push(this.readIdentifier());
        continue;
      }

      // Multi-character operators (must check before single-char)
      const tok = this.readOperator();
      if (tok) {
        tokens.push(tok);
        continue;
      }

      // Single-character tokens
      const singleType = this.singleCharToken(ch);
      if (singleType !== null) {
        tokens.push(this.makeToken(singleType, ch));
        this.advance();
        continue;
      }

      throw this.error(`Unexpected character: '${ch}'`);
    }

    tokens.push(this.makeToken(TokenType.EOF, ''));
    return tokens;
  }

  private advance(): string {
    const ch = this.chars[this.pos];
    this.pos++;
    this.column++;
    return ch;
  }

  private peek(offset = 1): string | undefined {
    return this.chars[this.pos + offset];
  }

  private loc(): SourceLocation {
    return { line: this.line, column: this.column, offset: this.pos };
  }

  private makeToken(type: TokenType, value: string): Token {
    return { type, value, loc: this.loc() };
  }

  private readComment(): void {
    // Skip // and everything until newline
    while (this.pos < this.chars.length && this.chars[this.pos] !== '\n') {
      this.advance();
    }
  }

  private readNumber(): Token {
    const loc = this.loc();
    let value = '';

    while (this.pos < this.chars.length && this.isDigit(this.chars[this.pos])) {
      value += this.advance();
    }

    // Decimal point
    if (
      this.pos < this.chars.length &&
      this.chars[this.pos] === '.' &&
      this.peek() !== undefined &&
      this.peek() !== '.' && // Don't consume '...' ellipsis
      this.isDigit(this.peek()!)
    ) {
      value += this.advance(); // the dot
      while (this.pos < this.chars.length && this.isDigit(this.chars[this.pos])) {
        value += this.advance();
      }
    }

    // Duration suffixes (e.g., 30s, 5m, 1h)
    if (
      this.pos < this.chars.length &&
      (this.chars[this.pos] === 's' ||
        this.chars[this.pos] === 'm' ||
        this.chars[this.pos] === 'h' ||
        this.chars[this.pos] === 'd')
    ) {
      const next = this.peek();
      // Only consume if next char is not alphanumeric (avoid eating identifiers like 'ms')
      if (next === undefined || !this.isIdentPart(next)) {
        value += this.advance();
      }
    }

    return { type: TokenType.Number, value, loc };
  }

  private readString(quote: string): Token {
    const loc = this.loc();
    this.advance(); // opening quote
    let value = '';

    while (this.pos < this.chars.length) {
      const ch = this.chars[this.pos];
      if (ch === quote) {
        this.advance(); // closing quote
        return { type: TokenType.String, value, loc };
      }
      if (ch === '\\') {
        this.advance();
        const escaped = this.chars[this.pos];
        if (escaped === undefined) break;
        switch (escaped) {
          case 'n': value += '\n'; break;
          case 't': value += '\t'; break;
          case 'r': value += '\r'; break;
          case '\\': value += '\\'; break;
          default: value += escaped; break;
        }
        this.advance();
      } else {
        value += this.advance();
      }
    }

    throw this.error('Unterminated string literal');
  }

  private readIdentifier(): Token {
    const loc = this.loc();
    let value = '';

    while (this.pos < this.chars.length && this.isIdentPart(this.chars[this.pos])) {
      value += this.advance();
    }

    // Check for keywords
    const kwType = KEYWORDS[value];
    if (kwType !== undefined) {
      return { type: kwType, value, loc };
    }

    return { type: TokenType.Identifier, value, loc };
  }

  private readOperator(): Token | null {
    const ch = this.chars[this.pos];
    const next = this.peek();

    // Three-character: ... (ellipsis)
    if (ch === '.' && next === '.' && this.peek(2) === '.') {
      const tok = this.makeToken(TokenType.Ellipsis, '...');
      this.advance(); this.advance(); this.advance();
      return tok;
    }

    // Two-character operators
    if (ch === '-' && next === '>') {
      const tok = this.makeToken(TokenType.Arrow, '->');
      this.advance(); this.advance();
      return tok;
    }
    if (ch === '=' && next === '>') {
      const tok = this.makeToken(TokenType.Implies, '=>');
      this.advance(); this.advance();
      return tok;
    }
    if (ch === '&' && next === '&') {
      const tok = this.makeToken(TokenType.Intersect, '&&');
      this.advance(); this.advance();
      return tok;
    }
    if (ch === '|' && next === '>') {
      const tok = this.makeToken(TokenType.Compose, '|>');
      this.advance(); this.advance();
      return tok;
    }
    if (ch === '>' && next === '=') {
      const tok = this.makeToken(TokenType.Gte, '>=');
      this.advance(); this.advance();
      return tok;
    }
    if (ch === '<' && next === '=') {
      const tok = this.makeToken(TokenType.Lte, '<=');
      this.advance(); this.advance();
      return tok;
    }
    if (ch === '=' && next === '=') {
      const tok = this.makeToken(TokenType.Eq, '==');
      this.advance(); this.advance();
      return tok;
    }
    if (ch === '!' && next === '=') {
      const tok = this.makeToken(TokenType.Neq, '!=');
      this.advance(); this.advance();
      return tok;
    }

    return null;
  }

  private singleCharToken(ch: string): TokenType | null {
    switch (ch) {
      case '+': return TokenType.Plus;
      case '-': return TokenType.Minus;
      case '*': return TokenType.Star;
      case '/': return TokenType.Slash;
      case '>': return TokenType.Gt;
      case '<': return TokenType.Lt;
      case '=': return TokenType.Assign;
      case '!': return TokenType.Bang;
      case '|': return TokenType.Pipe;
      case '?': return TokenType.Query;
      case '@': return TokenType.At;
      case '(': return TokenType.LParen;
      case ')': return TokenType.RParen;
      case '{': return TokenType.LBrace;
      case '}': return TokenType.RBrace;
      case '[': return TokenType.LBracket;
      case ']': return TokenType.RBracket;
      case ':': return TokenType.Colon;
      case ',': return TokenType.Comma;
      case '.': return TokenType.Dot;
      default: return null;
    }
  }

  private isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
  }

  private isIdentStart(ch: string): boolean {
    return (ch >= 'a' && ch <= 'z') ||
      (ch >= 'A' && ch <= 'Z') ||
      ch === '_';
  }

  private isIdentPart(ch: string): boolean {
    return this.isIdentStart(ch) || this.isDigit(ch) || ch === '-';
  }

  private error(message: string): Error {
    return new Error(`[NXL Lexer] ${message} at ${this.line}:${this.column}`);
  }
}
