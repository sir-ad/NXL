import { readFileSync } from 'node:fs';
import { parse } from '@nxl/core';
import { Linter, formatLintDiag } from '@nxl/lint';

interface LintOpts {
  rule?: string[];
  noWarn?: boolean;
}

export async function lintCommand(file: string, opts: LintOpts): Promise<void> {
  let source: string;
  try {
    source = readFileSync(file, 'utf8');
  } catch {
    console.error(`Error: cannot read file '${file}'`);
    process.exit(1);
  }

  let program;
  try {
    program = parse(source);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(msg);
    process.exit(1);
  }

  const linter = new Linter(source);
  let diags = linter.lint(program);

  // Filter by rule if --rule flag provided
  if (opts.rule && opts.rule.length > 0) {
    const rules = new Set(opts.rule);
    diags = diags.filter(d => rules.has(d.rule));
  }

  // Filter warnings if --no-warn
  if (opts.noWarn) {
    diags = diags.filter(d => d.severity === 'error');
  }

  if (diags.length === 0) {
    console.log(`${file}: no issues found`);
    return;
  }

  let hasError = false;
  for (const d of diags) {
    console.log(formatLintDiag(d, source, file));
    if (d.severity === 'error') hasError = true;
  }
  console.log(`\n${diags.length} issue(s) found in ${file}`);

  if (hasError) process.exit(1);
}
