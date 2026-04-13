import type * as AST from './nodes.js';

export interface Visitor {
  visitProgram?(node: AST.Program): void;
  visitPipelineStatement?(node: AST.PipelineStatement): void;
  visitConditionalStatement?(node: AST.ConditionalStatement): void;
  visitCompositionStatement?(node: AST.CompositionStatement): void;
  visitAssignmentStatement?(node: AST.AssignmentStatement): void;
  visitExpressionStatement?(node: AST.ExpressionStatement): void;
  visitBinaryExpression?(node: AST.BinaryExpression): void;
  visitUnaryExpression?(node: AST.UnaryExpression): void;
  visitMembershipExpression?(node: AST.MembershipExpression): void;
  visitShorthandExpression?(node: AST.ShorthandExpression): void;
  visitCallExpression?(node: AST.CallExpression): void;
  visitMemberExpression?(node: AST.MemberExpression): void;
  visitIdentifier?(node: AST.Identifier): void;
  visitNumberLiteral?(node: AST.NumberLiteral): void;
  visitStringLiteral?(node: AST.StringLiteral): void;
  visitBooleanLiteral?(node: AST.BooleanLiteral): void;
  visitArrayLiteral?(node: AST.ArrayLiteral): void;
  visitToonBlock?(node: AST.ToonBlock): void;
  visitTypeDeclaration?(node: AST.TypeDeclaration): void;
}

export function walk(node: AST.Node, visitor: Visitor): void {
  switch (node.kind) {
    case 'Program':
      visitor.visitProgram?.(node);
      for (const stmt of node.body) walk(stmt, visitor);
      break;

    case 'PipelineStatement':
      visitor.visitPipelineStatement?.(node);
      walk(node.source, visitor);
      for (const filter of node.selector.filters) walk(filter, visitor);
      break;

    case 'ConditionalStatement':
      visitor.visitConditionalStatement?.(node);
      walk(node.condition, visitor);
      for (const action of node.actions) walk(action.value, visitor);
      break;

    case 'CompositionStatement':
      visitor.visitCompositionStatement?.(node);
      break;

    case 'AssignmentStatement':
      visitor.visitAssignmentStatement?.(node);
      walk(node.value, visitor);
      break;

    case 'ExpressionStatement':
      visitor.visitExpressionStatement?.(node);
      walk(node.expression, visitor);
      break;

    case 'BinaryExpression':
      visitor.visitBinaryExpression?.(node);
      walk(node.left, visitor);
      walk(node.right, visitor);
      break;

    case 'UnaryExpression':
      visitor.visitUnaryExpression?.(node);
      walk(node.operand, visitor);
      break;

    case 'MembershipExpression':
      visitor.visitMembershipExpression?.(node);
      break;

    case 'ShorthandExpression':
      visitor.visitShorthandExpression?.(node);
      for (const arg of node.args) walk(arg.value, visitor);
      break;

    case 'CallExpression':
      visitor.visitCallExpression?.(node);
      walk(node.callee, visitor);
      for (const arg of node.args) walk(arg, visitor);
      break;

    case 'MemberExpression':
      visitor.visitMemberExpression?.(node);
      walk(node.object, visitor);
      break;

    case 'Identifier':
      visitor.visitIdentifier?.(node);
      break;

    case 'NumberLiteral':
      visitor.visitNumberLiteral?.(node);
      break;

    case 'StringLiteral':
      visitor.visitStringLiteral?.(node);
      break;

    case 'BooleanLiteral':
      visitor.visitBooleanLiteral?.(node);
      break;

    case 'ArrayLiteral':
      visitor.visitArrayLiteral?.(node);
      for (const el of node.elements) walk(el, visitor);
      break;

    case 'ToonBlock':
      visitor.visitToonBlock?.(node);
      break;

    case 'TypeDeclaration':
      visitor.visitTypeDeclaration?.(node);
      break;
  }
}
