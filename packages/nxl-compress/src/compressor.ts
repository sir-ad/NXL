import { serialize } from '@nxl/toon';

export interface CompressOptions {
  foldMethods?: boolean;
  useToon?: boolean;
  useShorthand?: boolean;
  useMetaGlyph?: boolean;
}

export class NXLCompressor {
  private options: Required<CompressOptions>;

  constructor(options: CompressOptions = {}) {
    this.options = {
      foldMethods: options.foldMethods ?? true,
      useToon: options.useToon ?? true,
      useShorthand: options.useShorthand ?? true,
      useMetaGlyph: options.useMetaGlyph ?? true,
    };
  }

  compressJSON(json: string): string {
    if (!this.options.useToon) return json;

    const data = JSON.parse(json);

    // If it's an array of objects with uniform keys, convert to TOON
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
      return serialize(data, { name: 'data' });
    }

    // If it's an object with a single array property
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value) && value.length > 0 && typeof (value as any[])[0] === 'object') {
        return serialize(value as Record<string, unknown>[], { name: key });
      }
    }

    return json;
  }

  compressPython(source: string): string {
    let result = source;

    if (this.options.useMetaGlyph) {
      result = this.applyMetaGlyphPatterns(result);
    }

    if (this.options.foldMethods) {
      result = this.foldClassMethods(result);
    }

    if (this.options.useShorthand) {
      result = this.applyShorthandPatterns(result);
    }

    return result;
  }

  private applyMetaGlyphPatterns(source: string): string {
    let result = source;

    // if x: ... elif y: ... → x ⇒ ... | y ⇒ ...
    result = result.replace(
      /if\s+(.+?):\s*\n\s+(\w+)\((.+?)\)/g,
      '$1 ⇒ $2:$3'
    );

    // [x for x in items if condition] → items → select condition
    result = result.replace(
      /\[(\w+) for \1 in (\w+) if (.+?)\]/g,
      '$2 → select $3'
    );

    // f(g(h(x))) → h ∘ g ∘ f
    // (simplified - only handles simple nested calls)
    result = result.replace(
      /(\w+)\((\w+)\((\w+)\(\)\)\)/g,
      '$3 ∘ $2 ∘ $1'
    );

    return result;
  }

  private foldClassMethods(source: string): string {
    // Fold Python class method bodies to just signatures
    const lines = source.split('\n');
    const result: string[] = [];
    let inMethod = false;
    let methodIndent = 0;

    for (const line of lines) {
      const indent = line.search(/\S/);
      const defMatch = line.match(/^(\s*)def\s+(\w+)\(([^)]*)\)(?:\s*->\s*(\w+))?\s*:/);

      if (defMatch) {
        const [, spaces, name, params, retType] = defMatch;
        const cleanParams = params.replace(/self,?\s*/, '');
        const retStr = retType ? `:${retType}` : '';
        result.push(`${spaces}${name}(${cleanParams})${retStr}: ...`);
        inMethod = true;
        methodIndent = indent;
        continue;
      }

      if (inMethod) {
        if (indent > methodIndent || line.trim() === '') {
          continue; // Skip method body
        }
        inMethod = false;
      }

      result.push(line);
    }

    return result.join('\n');
  }

  private applyShorthandPatterns(source: string): string {
    let result = source;

    // memory.search(...) → mem?[...]
    result = result.replace(/memory\.search\(([^)]+)\)/g, 'mem?[$1]');
    result = result.replace(/memory\.insert\(([^)]+)\)/g, 'mem![$1]');
    result = result.replace(/agent\.spawn\(([^)]+)\)/g, 'hire![$1]');
    result = result.replace(/agent\.terminate\(([^)]+)\)/g, 'fire![$1]');
    result = result.replace(/runtime\.execute\(([^)]+)\)/g, 'exec@[$1]');
    result = result.replace(/monitor\.observe\(([^)]+)\)/g, 'watch@[$1]');

    return result;
  }
}
