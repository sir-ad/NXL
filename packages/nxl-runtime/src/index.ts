import { Interpreter } from '@nxl/interpreter';
import { ShorthandRegistry } from '@nxl/interpreter';
import {
  mkString, mkList, mkDict, mkNumber, mkBool, NULL, display,
} from '@nxl/interpreter';
import type { Value } from '@nxl/interpreter';
import { RuntimeError } from '@nxl/interpreter';
import { Memory } from './memory.js';
import { ToolRegistry, registerExampleTools } from './tools.js';
import { LLM } from './llm.js';
import { resolveConfig } from './config.js';
import type { RuntimeConfig } from './config.js';

export { Memory } from './memory.js';
export { ToolRegistry, registerExampleTools } from './tools.js';
export { LLM } from './llm.js';
export { resolveConfig } from './config.js';
export type { RuntimeConfig } from './config.js';

export interface AgentRuntime {
  interp: Interpreter;
  shorthand: ShorthandRegistry;
  memory: Memory;
  tools: ToolRegistry;
  llm: LLM;
}

export function createRuntime(partial: Partial<RuntimeConfig> = {}): AgentRuntime {
  const config = resolveConfig(partial);

  const memory = new Memory();
  const tools = new ToolRegistry();
  const llm = new LLM({ apiKey: config.anthropicKey, defaultModel: config.defaultModel });

  registerExampleTools(tools);

  const shorthand = new ShorthandRegistry();

  // mem?[query, topK=5, threshold=0.0, recent=10]
  shorthand.register('mem', '?', async (args, pos) => {
    const queryVal = pos[0] ?? args['query'];
    if (!queryVal) throw new RuntimeError('mem?: query is required');
    const query = display(queryVal);
    const topK = args['top_k']?.kind === 'number' ? args['top_k'].value : 5;
    const threshold = args['threshold']?.kind === 'number' ? args['threshold'].value : 0.0;
    const recent = args['recent']?.kind === 'number' ? args['recent'].value : undefined;
    const results = memory.search(query, { topK, threshold, recent });
    return mkList(results.map(e => mkDict(new Map([
      ['id', mkString(e.id)],
      ['text', mkString(e.text)],
      ['score', mkNumber(0)], // cosine score not exposed here for simplicity
    ]))));
  });

  // mem![text, value=..., key=...]
  shorthand.register('mem', '!', (args, pos) => {
    const textVal = pos[0] ?? args['text'];
    if (!textVal) throw new RuntimeError('mem!: text is required');
    const text = display(textVal);
    const meta: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(args)) {
      if (k !== 'text') meta[k] = display(v);
    }
    const id = memory.insert(text, null, meta);
    return mkString(id);
  });

  // tool![name, arg1, key=val, ...]
  shorthand.register('tool', '!', async (args, pos) => {
    const nameVal = pos[0] ?? args['name'];
    if (!nameVal) throw new RuntimeError('tool!: tool name is required');
    const name = display(nameVal);
    const toolArgs = { ...args };
    delete toolArgs['name'];
    const toolPos = pos.slice(1);
    return tools.invoke(name, toolArgs, toolPos);
  });

  // llm@[prompt=..., model=..., system=..., max_tokens=...]
  shorthand.register('llm', '@', async (args, pos) => {
    return llm.call(args, pos);
  });

  // hire![script=..., system=...]
  shorthand.register('hire', '!', async (args, pos) => {
    const { spawnSubagent } = await import('./subagent.js');
    return spawnSubagent(args, pos, config);
  });

  // exec@[mode=parallel] — execution config (v1: recorded but serial)
  shorthand.register('exec', '@', (_args, _pos) => {
    return NULL;
  });

  const interp = new Interpreter(shorthand);

  return { interp, shorthand, memory, tools, llm };
}

// Convenience: run NXL source with agent runtime
export async function runAgent(source: string, config: Partial<RuntimeConfig> = {}): Promise<Value> {
  const { parse } = await import('@nxl/core');
  const { interp } = createRuntime(config);
  const program = parse(source);
  return interp.run(program, source);
}
