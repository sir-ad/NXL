import { Lexer } from './lexer/index.js';
import { Parser } from './parser/index.js';

export { Lexer };
export {
  TokenType,
  KEYWORDS,
  METAGLYPH_UNICODE,
  TOKEN_NAMES,
  type Token,
  type SourceLocation,
} from './lexer/index.js';

export { Parser };

export type {
  Program,
  Statement,
  PipelineStatement,
  Selector,
  ConditionalStatement,
  Action,
  CompositionStatement,
  AssignmentStatement,
  ExpressionStatement,
  Expression,
  BinaryExpression,
  UnaryExpression,
  MembershipExpression,
  FilterExpression,
  ShorthandExpression,
  ShorthandArg,
  CallExpression,
  MemberExpression,
  Identifier,
  NumberLiteral,
  StringLiteral,
  BooleanLiteral,
  NullLiteral,
  ArrayLiteral,
  ToonBlock,
  ToonRow,
  ToonValue,
  TypeDeclaration,
  MethodSignature,
  Param,
  TypeExpr,
  Node,
  // Phase 2
  FunctionDeclaration,
  FunctionExpression,
  IfStatement,
  IfExpression,
  ForStatement,
  WhileStatement,
  MatchExpression,
  MatchArm,
  MatchPattern,
  ReturnStatement,
  BreakStatement,
  ContinueStatement,
  BlockStatement,
  // Phase 4
  UseStatement,
  PubStatement,
} from './ast/index.js';

export { walk, type Visitor } from './ast/index.js';

export { NXLError, ParseError, unexpectedToken } from './errors/index.js';

import type { Program } from './ast/nodes.js';

// Convenience: source string → AST
export function parse(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, source);
  return parser.parse();
}
