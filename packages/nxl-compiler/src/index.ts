export { compile, parseSource, type Target, type CompileResult } from './compiler.js';
export { compileToPython } from './targets/python.js';
export { compileToJavaScript } from './targets/javascript.js';
export { Emitter } from './codegen/emitter.js';
