export interface ToonSchema {
  name: string;
  count: number | null;
  fields: ToonField[];
}

export interface ToonField {
  name: string;
  type?: 'string' | 'number' | 'boolean' | 'null';
}

export type ToonValue = string | number | boolean | null;

export type ToonRecord = Record<string, ToonValue>;
