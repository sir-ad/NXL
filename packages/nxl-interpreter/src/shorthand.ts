import type { Value } from './values.js';
import { mkString, mkList, NULL } from './values.js';

export type ShorthandHandler = (args: Record<string, Value>, positional: Value[]) => Value | Promise<Value>;

export class ShorthandRegistry {
  private handlers: Map<string, ShorthandHandler> = new Map();

  private key(name: string, suffix: string): string {
    return `${name}${suffix}`;
  }

  register(name: string, suffix: string, handler: ShorthandHandler): void {
    this.handlers.set(this.key(name, suffix), handler);
  }

  has(name: string, suffix: string): boolean {
    return this.handlers.has(this.key(name, suffix));
  }

  get(name: string, suffix: string): ShorthandHandler | undefined {
    return this.handlers.get(this.key(name, suffix));
  }
}

// Default stub registry — installed when no agent runtime is wired in.
export function createStubRegistry(): ShorthandRegistry {
  const reg = new ShorthandRegistry();

  reg.register('mem', '?', (args, positional) => {
    const query = positional[0];
    console.log(`[mem?] query: ${query?.kind === 'string' ? query.value : JSON.stringify(query)}`);
    return mkList([]);
  });

  reg.register('mem', '!', (args, positional) => {
    const value = positional[0];
    console.log(`[mem!] insert: ${value?.kind === 'string' ? value.value : JSON.stringify(value)}`);
    return NULL;
  });

  reg.register('tool', '!', (args, positional) => {
    const name = positional[0];
    console.log(`[tool!] invoke: ${name?.kind === 'string' ? name.value : JSON.stringify(name)}`);
    return mkString('(stub tool result)');
  });

  reg.register('llm', '@', (args, positional) => {
    const prompt = args['prompt'] ?? positional[0];
    const model = args['model'];
    const modelStr = model?.kind === 'string' ? model.value : 'claude-haiku-4-5-20251001';
    console.log(`[llm@] model=${modelStr}, prompt=${prompt?.kind === 'string' ? prompt.value.slice(0, 80) : '...'}`);
    return mkString('(stub llm response)');
  });

  reg.register('hire', '!', (args, positional) => {
    console.log('[hire!] subagent stub');
    return NULL;
  });

  reg.register('exec', '@', (args, positional) => {
    return NULL;
  });

  return reg;
}
