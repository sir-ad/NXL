import { createInterface } from 'node:readline';
import { parse } from '@nxl/core';
import { Interpreter, Environment, RuntimeError, display } from '@nxl/interpreter';

export function replCommand(_opts: Record<string, unknown>): void {
  const interp = new Interpreter();
  const env = interp.globals;

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'nxl> ',
  });

  console.log('NXL v0.2.0 — interpreter mode');
  console.log('Commands: :reset  :quit  :env');
  console.log('');

  rl.prompt();

  rl.on('line', async (line: string) => {
    const trimmed = line.trim();

    if (trimmed === ':quit' || trimmed === ':q') {
      rl.close();
      return;
    }

    if (trimmed === ':reset') {
      // Clear user-defined variables (re-use same interp so builtins stay)
      const fresh = new Interpreter();
      // Replace globals in-place by copying builtins back
      (interp as any).globals = fresh.globals;
      console.log('Environment reset.');
      rl.prompt();
      return;
    }

    if (trimmed === ':env') {
      const store = (env as any).store as Map<string, unknown>;
      const userKeys = [...store.keys()].filter(k => {
        const v = store.get(k) as any;
        return v?.kind !== 'native';
      });
      if (userKeys.length === 0) {
        console.log('(no user variables)');
      } else {
        for (const k of userKeys) {
          const v = store.get(k) as any;
          console.log(`  ${k} = ${display(v)}`);
        }
      }
      rl.prompt();
      return;
    }

    if (trimmed === '') {
      rl.prompt();
      return;
    }

    try {
      const program = parse(trimmed);
      const result = await interp.runInEnv(program, env, trimmed);
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
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log('\nBye!');
    process.exit(0);
  });
}
