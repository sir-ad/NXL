import type { Value } from './values.js';
import { RuntimeError } from './errors.js';

export class Environment {
  private store: Map<string, Value> = new Map();
  private parent: Environment | null;

  constructor(parent: Environment | null = null) {
    this.parent = parent;
  }

  define(name: string, value: Value): void {
    this.store.set(name, value);
  }

  get(name: string): Value {
    if (this.store.has(name)) return this.store.get(name)!;
    if (this.parent) return this.parent.get(name);
    throw new RuntimeError(`Undefined variable '${name}'`);
  }

  assign(name: string, value: Value): void {
    if (this.store.has(name)) {
      this.store.set(name, value);
      return;
    }
    if (this.parent) {
      this.parent.assign(name, value);
      return;
    }
    // Fallback: define at current scope (shouldn't normally reach here)
    this.store.set(name, value);
  }

  has(name: string): boolean {
    if (this.store.has(name)) return true;
    if (this.parent) return this.parent.has(name);
    return false;
  }

  child(): Environment {
    return new Environment(this);
  }
}
