import type { NxlType } from './types.js';
import { T_ANY } from './types.js';

/**
 * Lexically-scoped type environment.
 * Maps variable names to their inferred/declared NxlType.
 */
export class TypeEnv {
  private store: Map<string, NxlType> = new Map();
  private parent: TypeEnv | null;

  constructor(parent: TypeEnv | null = null) {
    this.parent = parent;
  }

  define(name: string, type: NxlType): void {
    this.store.set(name, type);
  }

  get(name: string): NxlType {
    if (this.store.has(name)) return this.store.get(name)!;
    if (this.parent) return this.parent.get(name);
    return T_ANY; // unknown variable → any (runtime will error if truly missing)
  }

  has(name: string): boolean {
    if (this.store.has(name)) return true;
    if (this.parent) return this.parent.has(name);
    return false;
  }

  child(): TypeEnv {
    return new TypeEnv(this);
  }
}
