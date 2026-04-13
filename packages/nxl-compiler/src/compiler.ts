import { Lexer, Parser } from '@nxl/core';
import type { Program } from '@nxl/core';
import { compileToPython } from './targets/python.js';
import { compileToJavaScript } from './targets/javascript.js';

export type Target = 'python' | 'javascript';

export interface CompileResult {
  output: string;
  target: Target;
}

export function compile(source: string, target: Target): CompileResult {
  const ast = parseSource(source);
  const output = target === 'python'
    ? compileToPython(ast)
    : compileToJavaScript(ast);

  return { output, target };
}

export function parseSource(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, source);
  return parser.parse();
}
