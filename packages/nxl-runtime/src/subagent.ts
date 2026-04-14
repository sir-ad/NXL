import { parse } from '@nxl/core';
import { Interpreter, Environment, display, mkString, NULL } from '@nxl/interpreter';
import type { Value } from '@nxl/interpreter';
import { RuntimeError } from '@nxl/interpreter';
import type { RuntimeConfig } from './config.js';
import { createRuntime } from './index.js';

export async function spawnSubagent(
  args: Record<string, Value>,
  positional: Value[],
  parentConfig: RuntimeConfig
): Promise<Value> {
  const scriptVal = args['script'] ?? positional[0];
  const systemVal = args['system'];

  if (!scriptVal) throw new RuntimeError('hire!: script or first argument is required');

  const script = display(scriptVal);
  const system = systemVal?.kind === 'string' ? systemVal.value : null;

  // Log to stderr so it doesn't mix with script stdout
  if (system) {
    process.stderr.write(`[hire!] spawning subagent: ${system.slice(0, 60)}\n`);
  }

  // Create a child runtime with the same config
  const { interp: childInterp, shorthand } = createRuntime(parentConfig);
  const childEnv = childInterp.globals;

  // If a system prompt is provided, make it available as a variable
  if (system) {
    childEnv.define('__system__', mkString(system));
  }

  // Parse and run the script
  try {
    const program = parse(script);
    const result = await childInterp.runInEnv(program, childEnv, script);
    return result;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new RuntimeError(`hire!: subagent error — ${msg}`);
  }
}
