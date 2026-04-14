export { Formatter, type FormatOptions } from './formatter.js';

import { parse } from '@nxl/core';
import { Formatter } from './formatter.js';

/** Convenience: format NXL source string → formatted NXL string */
export function format(source: string, opts?: import('./formatter.js').FormatOptions): string {
  const program = parse(source);
  return new Formatter(opts).format(program);
}
