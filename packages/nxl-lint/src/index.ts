export { Linter, formatLintDiag, type LintDiagnostic, type LintSeverity } from './linter.js';

import { parse } from '@nxl/core';
import { Linter, type LintDiagnostic } from './linter.js';

/** Convenience: lint NXL source string → array of diagnostics */
export function lint(source: string): LintDiagnostic[] {
  const program = parse(source);
  return new Linter(source).lint(program);
}
