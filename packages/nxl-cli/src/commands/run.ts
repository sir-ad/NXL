import { readFileSync } from 'node:fs';
import { parse } from '@nxl/core';
import { Interpreter, RuntimeError, display } from '@nxl/interpreter';
import { createRuntime } from '@nxl/runtime';

interface RunOpts {
  time?: boolean;
  agent?: boolean;
}

export async function runCommand(file: string, opts: RunOpts): Promise<void> {
  let source: string;
  try {
    source = readFileSync(file, 'utf8');
  } catch {
    console.error(`Error: cannot read file '${file}'`);
    process.exit(1);
  }

  const start = performance.now();

  let program;
  try {
    program = parse(source);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(msg);
    process.exit(1);
  }

  // Choose interpreter: bare or agent runtime
  const interp = opts.agent
    ? createRuntime().interp
    : new Interpreter();

  try {
    const result = await interp.run(program, source);
    if (result.kind !== 'null') {
      console.log(display(result));
    }
  } catch (err: unknown) {
    if (err instanceof RuntimeError) {
      console.error(err.format());
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${msg}`);
    }
    process.exit(1);
  }

  if (opts.time) {
    const elapsed = (performance.now() - start).toFixed(2);
    console.error(`\n[${elapsed}ms]`);
  }
}
