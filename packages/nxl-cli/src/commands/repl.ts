import { createInterface } from 'node:readline';
import { compile, type Target } from '@nxl/compiler';

interface ReplOpts {
  target: string;
}

export function replCommand(opts: ReplOpts): void {
  const target: Target = opts.target === 'js' || opts.target === 'javascript'
    ? 'javascript' : 'python';

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'nxl> ',
  });

  console.log(`NXL REPL v0.1.0 (target: ${target})`);
  console.log('Type NXL code and press Enter to see compiled output.');
  console.log('Commands: :target py|js, :quit\n');

  let currentTarget = target;

  rl.prompt();

  rl.on('line', (line: string) => {
    const trimmed = line.trim();

    if (trimmed === ':quit' || trimmed === ':q') {
      rl.close();
      return;
    }

    if (trimmed.startsWith(':target ')) {
      const t = trimmed.slice(8).trim();
      if (t === 'py' || t === 'python') {
        currentTarget = 'python';
        console.log('Target: python');
      } else if (t === 'js' || t === 'javascript') {
        currentTarget = 'javascript';
        console.log('Target: javascript');
      } else {
        console.log('Unknown target. Use :target py or :target js');
      }
      rl.prompt();
      return;
    }

    if (trimmed === '') {
      rl.prompt();
      return;
    }

    try {
      const result = compile(trimmed, currentTarget);
      console.log(result.output);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${msg}`);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log('\nBye!');
    process.exit(0);
  });
}
