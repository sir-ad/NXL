import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from '@nxl/core';
import { Formatter } from '@nxl/fmt';

interface FmtOpts {
  write?: boolean;
  indent?: string;
  check?: boolean;
}

export async function fmtCommand(file: string, opts: FmtOpts): Promise<void> {
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

  const indentWidth = opts.indent ? parseInt(opts.indent, 10) : 2;
  const formatted = new Formatter({ indent: indentWidth }).format(program);

  if (opts.check) {
    // --check: exit 1 if file would change, 0 if already formatted
    if (formatted !== source) {
      console.error(`${file}: would reformat`);
      process.exit(1);
    }
    console.log(`${file}: ok`);
    return;
  }

  if (opts.write) {
    writeFileSync(file, formatted, 'utf8');
    console.log(`Formatted: ${file}`);
  } else {
    process.stdout.write(formatted);
  }
}
