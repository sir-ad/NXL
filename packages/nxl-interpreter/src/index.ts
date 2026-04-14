import { parse } from '@nxl/core';
import { Interpreter } from './interpreter.js';
import { Environment } from './environment.js';
import type { Value } from './values.js';

export { Interpreter } from './interpreter.js';
export { Environment } from './environment.js';
export { RuntimeError, TypeError } from './errors.js';
export { ReturnSignal, BreakSignal, ContinueSignal } from './signals.js';
export { ShorthandRegistry, createStubRegistry } from './shorthand.js';
export type { ShorthandHandler } from './shorthand.js';
export {
  NULL, mkNumber, mkString, mkBool, mkList, mkDict, mkDictFromObj, mkNative,
  truthy, equals, display, repr,
  type Value,
  type NumberValue,
  type StringValue,
  type BoolValue,
  type ListValue,
  type DictValue,
  type FunctionValue,
  type NativeValue,
  type NullValue,
} from './values.js';

// Convenience: source string → result Value
export async function interpret(source: string, env?: Environment): Promise<Value> {
  const program = parse(source);
  const interp = new Interpreter();
  if (env) {
    return interp.runInEnv(program, env, source);
  }
  return interp.run(program, source);
}
