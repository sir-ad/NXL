import { readFileSync } from 'node:fs';

interface TokensOpts {
  compare?: string;
}

export function tokensCommand(file: string, opts: TokensOpts): void {
  try {
    const content = readFileSync(file, 'utf-8');
    const charCount = content.length;

    // Rough GPT-4 token estimate (~4 chars per token for code)
    const estimatedTokens = Math.ceil(charCount / 4);

    console.log(`File: ${file}`);
    console.log(`Characters: ${charCount}`);
    console.log(`Estimated tokens (GPT-4): ~${estimatedTokens}`);

    if (opts.compare) {
      const original = readFileSync(opts.compare, 'utf-8');
      const origChars = original.length;
      const origTokens = Math.ceil(origChars / 4);

      const charReduction = ((1 - charCount / origChars) * 100).toFixed(1);
      const tokenReduction = ((1 - estimatedTokens / origTokens) * 100).toFixed(1);

      console.log(`\nComparison vs ${opts.compare}:`);
      console.log(`  Original: ${origChars} chars, ~${origTokens} tokens`);
      console.log(`  NXL:      ${charCount} chars, ~${estimatedTokens} tokens`);
      console.log(`  Character reduction: ${charReduction}%`);
      console.log(`  Token reduction:     ${tokenReduction}%`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${msg}`);
    process.exit(1);
  }
}
