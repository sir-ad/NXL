import { readFileSync, writeFileSync } from 'node:fs';
import { compile, type Target } from '@nxl/compiler';

interface CompileOpts {
  target: string;
  output?: string;
}

export function compileCommand(file: string, opts: CompileOpts): void {
  try {
    const source = readFileSync(file, 'utf-8');
    const target = normalizeTarget(opts.target);
    const result = compile(source, target);

    if (opts.output) {
      writeFileSync(opts.output, result.output);
      console.log(`Compiled ${file} → ${opts.output} (${target})`);
    } else {
      process.stdout.write(result.output);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${msg}`);
    process.exit(1);
  }
}

function normalizeTarget(target: string): Target {
  const t = target.toLowerCase();
  if (t === 'py' || t === 'python') return 'python';
  if (t === 'js' || t === 'javascript') return 'javascript';
  console.error(`Unknown target: ${target}. Use 'python' or 'javascript'.`);
  process.exit(1);
}
