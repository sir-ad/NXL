import type { Value } from './values.js';

// Internal control-flow signals thrown as exceptions and caught at boundaries.

export class ReturnSignal {
  readonly value: Value;
  constructor(value: Value) { this.value = value; }
}

export class BreakSignal {
  constructor() {}
}

export class ContinueSignal {
  constructor() {}
}
