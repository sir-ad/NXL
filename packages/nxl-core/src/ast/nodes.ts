import type { SourceLocation } from '../lexer/tokens.js';

// ===== Base =====

interface NodeBase {
  loc: SourceLocation;
}

// ===== Program =====

export interface Program extends NodeBase {
  kind: 'Program';
  body: Statement[];
}

// ===== Statements =====

export type Statement =
  | PipelineStatement
  | ConditionalStatement
  | CompositionStatement
  | AssignmentStatement
  | ExpressionStatement
  | ToonBlock
  | TypeDeclaration
  // Phase 2
  | FunctionDeclaration
  | IfStatement
  | ForStatement
  | WhileStatement
  | ReturnStatement
  | BreakStatement
  | ContinueStatement
  | BlockStatement;

export interface PipelineStatement extends NodeBase {
  kind: 'PipelineStatement';
  source: Expression;
  selector: Selector;
}

export interface Selector extends NodeBase {
  kind: 'Selector';
  filters: FilterExpression[];
}

export interface ConditionalStatement extends NodeBase {
  kind: 'ConditionalStatement';
  condition: Expression;
  actions: Action[];
}

export interface Action extends NodeBase {
  kind: 'Action';
  name: string;
  value: Expression;
}

export interface CompositionStatement extends NodeBase {
  kind: 'CompositionStatement';
  functions: string[];
}

export interface AssignmentStatement extends NodeBase {
  kind: 'AssignmentStatement';
  name: string;
  value: Expression;
}

export interface ExpressionStatement extends NodeBase {
  kind: 'ExpressionStatement';
  expression: Expression;
}

// ===== Expressions =====

export type Expression =
  | BinaryExpression
  | UnaryExpression
  | MembershipExpression
  | ShorthandExpression
  | CallExpression
  | MemberExpression
  | Identifier
  | NumberLiteral
  | StringLiteral
  | BooleanLiteral
  | NullLiteral
  | ArrayLiteral
  // Phase 2
  | FunctionExpression
  | IfExpression
  | MatchExpression;

export interface BinaryExpression extends NodeBase {
  kind: 'BinaryExpression';
  op: string;
  left: Expression;
  right: Expression;
}

export interface UnaryExpression extends NodeBase {
  kind: 'UnaryExpression';
  op: string;
  operand: Expression;
}

export interface MembershipExpression extends NodeBase {
  kind: 'MembershipExpression';
  category: string;
  negated: boolean;
}

export type FilterExpression = MembershipExpression | Expression;

export interface ShorthandExpression extends NodeBase {
  kind: 'ShorthandExpression';
  name: string;
  suffix: '?' | '!' | '@';
  args: ShorthandArg[];
}

export interface ShorthandArg extends NodeBase {
  kind: 'ShorthandArg';
  name: string | null;
  value: Expression;
}

export interface CallExpression extends NodeBase {
  kind: 'CallExpression';
  callee: Expression;
  args: Expression[];
}

export interface MemberExpression extends NodeBase {
  kind: 'MemberExpression';
  object: Expression;
  property: string;
}

export interface Identifier extends NodeBase {
  kind: 'Identifier';
  name: string;
}

export interface NumberLiteral extends NodeBase {
  kind: 'NumberLiteral';
  value: number;
  raw: string;
}

export interface StringLiteral extends NodeBase {
  kind: 'StringLiteral';
  value: string;
}

export interface BooleanLiteral extends NodeBase {
  kind: 'BooleanLiteral';
  value: boolean;
}

export interface NullLiteral extends NodeBase {
  kind: 'NullLiteral';
}

export interface ArrayLiteral extends NodeBase {
  kind: 'ArrayLiteral';
  elements: Expression[];
}

// ===== TOON Data Blocks =====

export interface ToonBlock extends NodeBase {
  kind: 'ToonBlock';
  name: string;
  count: number | null;
  fields: string[];
  rows: ToonRow[];
}

export interface ToonRow extends NodeBase {
  kind: 'ToonRow';
  values: ToonValue[];
}

export type ToonValue = string | number | boolean | null;

// ===== Type Declarations (AST Folding) =====

export interface TypeDeclaration extends NodeBase {
  kind: 'TypeDeclaration';
  name: string;
  fields: string[];
  methods: MethodSignature[];
}

export interface MethodSignature extends NodeBase {
  kind: 'MethodSignature';
  name: string;
  params: Param[];
  returnType: TypeExpr | null;
  folded: boolean; // true when body is ...
}

export interface Param extends NodeBase {
  kind: 'Param';
  name: string;
  typeAnnotation: TypeExpr | null;
}

export interface TypeExpr extends NodeBase {
  kind: 'TypeExpr';
  name: string;
  typeArgs: TypeExpr[];
}

// ===== Phase 2: Functions & Control Flow =====

export interface FunctionDeclaration extends NodeBase {
  kind: 'FunctionDeclaration';
  name: string;
  params: Param[];
  body: Expression | Statement[];
  loc: SourceLocation;
}

export interface FunctionExpression extends NodeBase {
  kind: 'FunctionExpression';
  name: string | null;
  params: Param[];
  body: Expression | Statement[];
  loc: SourceLocation;
}

export interface IfStatement extends NodeBase {
  kind: 'IfStatement';
  condition: Expression;
  then: Statement[];
  else: Statement[] | null;
}

export interface IfExpression extends NodeBase {
  kind: 'IfExpression';
  condition: Expression;
  then: Expression;
  else: Expression | null;
}

export interface ForStatement extends NodeBase {
  kind: 'ForStatement';
  variable: string;
  iterable: Expression;
  body: Statement[];
}

export interface WhileStatement extends NodeBase {
  kind: 'WhileStatement';
  condition: Expression;
  body: Statement[];
}

export interface MatchExpression extends NodeBase {
  kind: 'MatchExpression';
  subject: Expression;
  arms: MatchArm[];
}

export interface MatchArm extends NodeBase {
  kind: 'MatchArm';
  pattern: MatchPattern;
  guard: Expression | null;
  body: Expression;
}

export type MatchPattern =
  | { kind: 'WildcardPattern'; loc: SourceLocation }
  | NumberLiteral
  | StringLiteral
  | BooleanLiteral
  | NullLiteral
  | Identifier;

export interface ReturnStatement extends NodeBase {
  kind: 'ReturnStatement';
  value: Expression | null;
}

export interface BreakStatement extends NodeBase {
  kind: 'BreakStatement';
}

export interface ContinueStatement extends NodeBase {
  kind: 'ContinueStatement';
}

export interface BlockStatement extends NodeBase {
  kind: 'BlockStatement';
  statements: Statement[];
}

// ===== Node type union =====

export type Node =
  | Program
  | Statement
  | Expression
  | Selector
  | Action
  | ToonBlock
  | ToonRow
  | TypeDeclaration
  | MethodSignature
  | Param
  | TypeExpr
  | ShorthandArg
  | MatchArm;
