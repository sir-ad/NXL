import type { SourceLocation } from '@nxl/core';

export type Severity = 'error' | 'warning' | 'info';

export interface Diagnostic {
  severity: Severity;
  message: string;
  loc: SourceLocation;
  code?: string;
}

export function formatDiagnostic(d: Diagnostic, source: string, file?: string): string {
  const lines = source.split('\n');
  const { line, column } = d.loc;
  const prefix = file ? `${file}:${line}:${column}` : `${line}:${column}`;
  const lineText = lines[line - 1] ?? '';
  const pointer = ' '.repeat(column - 1) + '^';
  const label = d.severity === 'error' ? 'error' : d.severity === 'warning' ? 'warning' : 'info';
  return `${prefix}: [${label}] ${d.message}\n  ${lineText}\n  ${pointer}`;
}
