import { readFileSync } from 'node:fs';
import { parse } from '@nxl/core';
import { TypeChecker, formatDiagnostic } from '@nxl/typechecker';

interface CheckOpts {
  strict?: boolean;
}

export async function checkCommand(file: string, opts: CheckOpts): Promise<void> {
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

  const checker = new TypeChecker(source);
  let diags = checker.check(program);

  // In strict mode include warnings; otherwise only errors
  if (!opts.strict) {
    diags = diags.filter(d => d.severity === 'error');
  }

  if (diags.length === 0) {
    console.log(`${file}: ok`);
    return;
  }

  let hasError = false;
  for (const d of diags) {
    console.log(formatDiagnostic(d, source, file));
    if (d.severity === 'error') hasError = true;
  }
  console.log(`\n${diags.length} issue(s) found in ${file}`);

  if (hasError) process.exit(1);
}
