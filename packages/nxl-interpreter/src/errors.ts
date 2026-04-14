import type { SourceLocation } from '@nxl/core';

export class RuntimeError extends Error {
  readonly loc: SourceLocation | undefined;
  readonly source: string | undefined;

  constructor(message: string, loc?: SourceLocation, source?: string) {
    super(message);
    this.name = 'RuntimeError';
    this.loc = loc;
    this.source = source;
  }

  format(): string {
    if (!this.loc || !this.source) return `RuntimeError: ${this.message}`;
    const lines = this.source.split('\n');
    const line = lines[this.loc.line - 1] ?? '';
    const col = this.loc.column;
    const pointer = ' '.repeat(col) + '^';
    return [
      `RuntimeError: ${this.message}`,
      `  at line ${this.loc.line}, column ${this.loc.column + 1}`,
      '',
      `  ${line}`,
      `  ${pointer}`,
    ].join('\n');
  }
}

export class TypeError extends RuntimeError {
  constructor(message: string, loc?: SourceLocation, source?: string) {
    super(message, loc, source);
    this.name = 'TypeError';
  }
}
