import { BPETokenizer } from './bpe.js';

export interface TokenComparison {
  text: string;
  charCount: number;
  nxlTokens: number;
  estimatedGPTTokens: number;
  reduction: string;
}

export class TokenComparator {
  private nxlTokenizer: BPETokenizer;

  constructor(nxlTokenizer?: BPETokenizer) {
    this.nxlTokenizer = nxlTokenizer ?? new BPETokenizer();
  }

  compare(text: string): TokenComparison {
    const charCount = text.length;
    const nxlTokens = this.nxlTokenizer.tokenCount(text);
    // Rough estimate: GPT tokenizers average ~4 chars per token for English
    const estimatedGPTTokens = Math.ceil(charCount / 4);
    const reduction = estimatedGPTTokens > 0
      ? `${Math.round((1 - nxlTokens / estimatedGPTTokens) * 100)}%`
      : '0%';

    return { text, charCount, nxlTokens, estimatedGPTTokens, reduction };
  }

  comparePair(original: string, nxl: string): {
    original: TokenComparison;
    nxl: TokenComparison;
    charReduction: string;
    tokenReduction: string;
  } {
    const origComp = this.compare(original);
    const nxlComp = this.compare(nxl);
    const charReduction = `${Math.round((1 - nxl.length / original.length) * 100)}%`;
    const tokenReduction = origComp.estimatedGPTTokens > 0
      ? `${Math.round((1 - nxlComp.estimatedGPTTokens / origComp.estimatedGPTTokens) * 100)}%`
      : '0%';

    return { original: origComp, nxl: nxlComp, charReduction, tokenReduction };
  }
}
