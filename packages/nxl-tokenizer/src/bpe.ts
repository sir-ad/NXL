export interface BPEVocab {
  merges: [string, string][];
  vocab: Map<string, number>;
}

export class BPETokenizer {
  private vocab: Map<string, number>;
  private merges: [string, string][];

  constructor(vocab?: BPEVocab) {
    this.vocab = vocab?.vocab ?? new Map();
    this.merges = vocab?.merges ?? [];

    // Initialize with byte-level vocabulary if empty
    if (this.vocab.size === 0) {
      for (let i = 0; i < 256; i++) {
        this.vocab.set(String.fromCharCode(i), i);
      }
    }
  }

  encode(text: string): number[] {
    const chars = [...text];
    let tokens = chars.map(ch => {
      const id = this.vocab.get(ch);
      if (id !== undefined) return id;
      // Fallback: encode as individual bytes
      const bytes = new TextEncoder().encode(ch);
      return Array.from(bytes).map(b => b);
    }).flat();

    // Apply merge rules
    for (const [a, b] of this.merges) {
      const aId = this.vocab.get(a);
      const bId = this.vocab.get(b);
      const merged = a + b;
      const mergedId = this.vocab.get(merged);
      if (aId === undefined || bId === undefined || mergedId === undefined) continue;

      let i = 0;
      while (i < tokens.length - 1) {
        if (tokens[i] === aId && tokens[i + 1] === bId) {
          tokens.splice(i, 2, mergedId);
        } else {
          i++;
        }
      }
    }

    return tokens;
  }

  decode(tokenIds: number[]): string {
    const reverseVocab = new Map<number, string>();
    for (const [str, id] of this.vocab) {
      reverseVocab.set(id, str);
    }
    return tokenIds.map(id => reverseVocab.get(id) ?? '').join('');
  }

  tokenCount(text: string): number {
    return this.encode(text).length;
  }

  train(corpus: string, targetVocabSize: number): void {
    // Split corpus into words
    const words = corpus.split(/\s+/).filter(w => w.length > 0);
    const wordFreqs = new Map<string, number>();
    for (const word of words) {
      wordFreqs.set(word, (wordFreqs.get(word) ?? 0) + 1);
    }

    // Initialize: each character is a token
    const wordTokens = new Map<string, string[]>();
    for (const word of wordFreqs.keys()) {
      wordTokens.set(word, [...word]);
    }

    while (this.vocab.size < targetVocabSize) {
      // Count adjacent pairs
      const pairCounts = new Map<string, number>();
      for (const [word, tokens] of wordTokens) {
        const freq = wordFreqs.get(word) ?? 0;
        for (let i = 0; i < tokens.length - 1; i++) {
          const pair = `${tokens[i]}|${tokens[i + 1]}`;
          pairCounts.set(pair, (pairCounts.get(pair) ?? 0) + freq);
        }
      }

      if (pairCounts.size === 0) break;

      // Find most frequent pair
      let bestPair = '';
      let bestCount = 0;
      for (const [pair, count] of pairCounts) {
        if (count > bestCount) {
          bestPair = pair;
          bestCount = count;
        }
      }

      const [a, b] = bestPair.split('|');
      const merged = a + b;

      // Add to vocabulary and merges
      this.vocab.set(merged, this.vocab.size);
      this.merges.push([a, b]);

      // Apply merge to all words
      for (const [word, tokens] of wordTokens) {
        let i = 0;
        while (i < tokens.length - 1) {
          if (tokens[i] === a && tokens[i + 1] === b) {
            tokens.splice(i, 2, merged);
          } else {
            i++;
          }
        }
      }
    }
  }

  getVocabSize(): number {
    return this.vocab.size;
  }

  exportVocab(): BPEVocab {
    return { merges: [...this.merges], vocab: new Map(this.vocab) };
  }
}
