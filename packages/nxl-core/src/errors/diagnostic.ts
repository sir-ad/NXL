import { TOKEN_NAMES, type Token, type TokenType, type SourceLocation } from '../lexer/tokens.js';

export class NXLError extends Error {
  public loc: SourceLocation;
  public source: string;

  constructor(message: string, loc: SourceLocation, source = '') {
    super(message);
    this.name = 'NXLError';
    this.loc = loc;
    this.source = source;
  }

  format(): string {
    const lines = this.source.split('\n');
    const lineStr = lines[this.loc.line - 1] ?? '';
    const pointer = ' '.repeat(Math.max(0, this.loc.column - 1)) + '^';

    return [
      `NXL Error: ${this.message}`,
      `  at line ${this.loc.line}, column ${this.loc.column}`,
      '',
      `  ${this.loc.line} | ${lineStr}`,
      `    ${' '.repeat(String(this.loc.line).length)} | ${pointer}`,
    ].join('\n');
  }
}

export class ParseError extends NXLError {
  constructor(message: string, loc: SourceLocation, source = '') {
    super(message, loc, source);
    this.name = 'ParseError';
  }
}

export function unexpectedToken(token: Token, expected?: TokenType | string, source = ''): ParseError {
  const got = TOKEN_NAMES[token.type] ?? token.value;
  let msg = `Unexpected token '${got}'`;
  if (expected !== undefined) {
    const exp = typeof expected === 'string' ? expected : TOKEN_NAMES[expected];
    msg += `, expected ${exp}`;
  }
  return new ParseError(msg, token.loc, source);
}
