/**
 * NXL gradual type system.
 * Every value has an NxlType. 'any' is the escape hatch for unannoted code.
 */

export type NxlType =
  | { kind: 'num' }
  | { kind: 'str' }
  | { kind: 'bool' }
  | { kind: 'null' }
  | { kind: 'any' }
  | { kind: 'never' }
  | { kind: 'list'; item: NxlType }
  | { kind: 'dict'; value: NxlType }
  | { kind: 'fn'; params: NxlType[]; ret: NxlType }
  | { kind: 'union'; types: NxlType[] };

// ===== Singletons =====

export const T_NUM: NxlType   = { kind: 'num' };
export const T_STR: NxlType   = { kind: 'str' };
export const T_BOOL: NxlType  = { kind: 'bool' };
export const T_NULL: NxlType  = { kind: 'null' };
export const T_ANY: NxlType   = { kind: 'any' };
export const T_NEVER: NxlType = { kind: 'never' };
export const T_LIST_ANY: NxlType = { kind: 'list', item: T_ANY };
export const T_DICT_ANY: NxlType = { kind: 'dict', value: T_ANY };

// ===== Helpers =====

export function typeOf(t: NxlType): string {
  switch (t.kind) {
    case 'num':   return 'num';
    case 'str':   return 'str';
    case 'bool':  return 'bool';
    case 'null':  return 'null';
    case 'any':   return 'any';
    case 'never': return 'never';
    case 'list':  return `list<${typeOf(t.item)}>`;
    case 'dict':  return `dict<${typeOf(t.value)}>`;
    case 'fn':    return `fn(${t.params.map(typeOf).join(', ')}) -> ${typeOf(t.ret)}`;
    case 'union': return t.types.map(typeOf).join(' | ');
  }
}

/** Structural type equality */
export function typesEqual(a: NxlType, b: NxlType): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'list' && b.kind === 'list') return typesEqual(a.item, b.item);
  if (a.kind === 'dict' && b.kind === 'dict') return typesEqual(a.value, b.value);
  if (a.kind === 'fn' && b.kind === 'fn') {
    if (a.params.length !== b.params.length) return false;
    return a.params.every((p, i) => typesEqual(p, b.params[i])) && typesEqual(a.ret, b.ret);
  }
  if (a.kind === 'union' && b.kind === 'union') {
    if (a.types.length !== b.types.length) return false;
    return a.types.every((t, i) => typesEqual(t, b.types[i]));
  }
  return true; // same primitive kind
}

/**
 * Is `a` assignable to `b`?
 * - any is assignable to/from anything
 * - identical types are assignable
 * - a | b is assignable to c if every member of the union is assignable to c
 */
export function isAssignable(from: NxlType, to: NxlType): boolean {
  if (to.kind === 'any' || from.kind === 'any') return true;
  if (to.kind === 'never') return false;
  if (from.kind === 'never') return true;
  if (typesEqual(from, to)) return true;
  // union from: all members must be assignable to target
  if (from.kind === 'union') return from.types.every(t => isAssignable(t, to));
  // union to: from must be assignable to at least one member
  if (to.kind === 'union') return to.types.some(t => isAssignable(from, t));
  return false;
}

/** Union of two types (simplify if identical) */
export function unionOf(a: NxlType, b: NxlType): NxlType {
  if (isAssignable(a, b)) return b;
  if (isAssignable(b, a)) return a;
  const members: NxlType[] = [];
  if (a.kind === 'union') members.push(...a.types); else members.push(a);
  if (b.kind === 'union') members.push(...b.types); else members.push(b);
  return { kind: 'union', types: members };
}

/** Parse a TypeExpr AST node into an NxlType */
export function typeFromAnnotation(name: string, _args: NxlType[] = []): NxlType {
  switch (name.toLowerCase()) {
    case 'num':    return T_NUM;
    case 'str':    return T_STR;
    case 'bool':   return T_BOOL;
    case 'null':   return T_NULL;
    case 'any':    return T_ANY;
    case 'never':  return T_NEVER;
    case 'list':   return { kind: 'list', item: _args[0] ?? T_ANY };
    case 'dict':   return { kind: 'dict', value: _args[0] ?? T_ANY };
    default:       return T_ANY; // unknown named type → any
  }
}
