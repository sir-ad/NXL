import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

interface BenchmarkResult {
  name: string;
  originalChars: number;
  nxlChars: number;
  charReduction: number;
  // Rough token estimate: ~4 chars per token for code (GPT-4 cl100k_base average)
  originalTokens: number;
  nxlTokens: number;
  tokenReduction: number;
}

function estimateTokens(text: string): number {
  // Conservative estimate based on GPT-4 tokenizer behavior for code:
  // - Average ~3.5-4 chars per token for code
  // - Whitespace and punctuation often 1 char = 1 token
  // - Common keywords usually 1 token
  // - This is a rough approximation; real tokenizer would be more accurate
  let tokens = 0;
  const words = text.split(/(\s+|[{}()\[\],:;=<>+\-*/!@?&|.]+)/);
  for (const word of words) {
    if (word.trim() === '') {
      // Whitespace: newlines and indentation cost tokens
      const newlines = (word.match(/\n/g) ?? []).length;
      tokens += newlines; // Each newline is roughly a token
      continue;
    }
    // Punctuation: usually 1 token each
    if (/^[{}()\[\],:;=<>+\-*/!@?&|.]+$/.test(word)) {
      tokens += word.length;
      continue;
    }
    // Words: roughly ceil(length / 4) tokens
    tokens += Math.ceil(word.length / 4);
  }
  return Math.max(1, tokens);
}

function benchmark(name: string, originalPath: string, nxlPath: string): BenchmarkResult {
  const original = readFileSync(originalPath, 'utf-8');
  const nxl = readFileSync(nxlPath, 'utf-8');

  const originalChars = original.length;
  const nxlChars = nxl.length;
  const charReduction = (1 - nxlChars / originalChars) * 100;

  const originalTokens = estimateTokens(original);
  const nxlTokens = estimateTokens(nxl);
  const tokenReduction = (1 - nxlTokens / originalTokens) * 100;

  return { name, originalChars, nxlChars, charReduction, originalTokens, nxlTokens, tokenReduction };
}

// Run benchmarks
const corpusDir = join(import.meta.dirname!, 'corpus');

const pairs: { name: string; original: string; nxl: string }[] = [
  {
    name: 'Agent Instructions',
    original: join(corpusDir, 'agent-instructions.py'),
    nxl: join(corpusDir, 'agent-instructions.nxl'),
  },
  {
    name: 'Data Payload (JSON→TOON)',
    original: join(corpusDir, 'data-payload.json'),
    nxl: join(corpusDir, 'data-payload.toon'),
  },
];

console.log('=== NXL Token Reduction Benchmark ===\n');

const results: BenchmarkResult[] = [];
for (const pair of pairs) {
  const result = benchmark(pair.name, pair.original, pair.nxl);
  results.push(result);
}

// Print results table
console.log('| Benchmark | Original | NXL | Char % | Est. Tokens (Orig) | Est. Tokens (NXL) | Token % |');
console.log('|-----------|----------|-----|--------|--------------------|--------------------|---------|');

for (const r of results) {
  console.log(
    `| ${r.name.padEnd(20)} | ${String(r.originalChars).padStart(8)} | ${String(r.nxlChars).padStart(5)} | ${r.charReduction.toFixed(1).padStart(5)}% | ${String(r.originalTokens).padStart(18)} | ${String(r.nxlTokens).padStart(18)} | ${r.tokenReduction.toFixed(1).padStart(6)}% |`
  );
}

// Summary
const totalOrigChars = results.reduce((s, r) => s + r.originalChars, 0);
const totalNxlChars = results.reduce((s, r) => s + r.nxlChars, 0);
const totalOrigTokens = results.reduce((s, r) => s + r.originalTokens, 0);
const totalNxlTokens = results.reduce((s, r) => s + r.nxlTokens, 0);

console.log('\n--- Summary ---');
console.log(`Total character reduction: ${((1 - totalNxlChars / totalOrigChars) * 100).toFixed(1)}%`);
console.log(`Total estimated token reduction: ${((1 - totalNxlTokens / totalOrigTokens) * 100).toFixed(1)}%`);
console.log(`\nOriginal: ${totalOrigChars} chars, ~${totalOrigTokens} tokens`);
console.log(`NXL:      ${totalNxlChars} chars, ~${totalNxlTokens} tokens`);
