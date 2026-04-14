/**
 * In-memory vector store.
 * Uses a hash-based sparse embedding (no external API required).
 * Provides real insert + search semantics for mem! and mem? shorthands.
 */

const DIM = 256;

function wordHash(word: string): number {
  let h = 2166136261;
  for (let i = 0; i < word.length; i++) {
    h ^= word.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function hashEmbed(text: string): Float32Array {
  const vec = new Float32Array(DIM);
  const words = text.toLowerCase().split(/\W+/).filter(Boolean);
  for (const word of words) {
    const h = wordHash(word);
    // Use different bit positions per dimension to avoid correlation artifacts
    for (let d = 0; d < DIM; d++) {
      // Mix word hash with dimension using a multiplicative hash per dimension
      const mix = Math.imul(h ^ (d * 0x9e3779b9), 0x6c62272e) >>> 0;
      // Use multiple bits spread across the mixed value
      const sign = ((mix >>> (d % 31)) & 1) ? 1 : -1;
      vec[d] += sign;
    }
  }
  // Normalize
  let norm = 0;
  for (let d = 0; d < DIM; d++) norm += vec[d] * vec[d];
  norm = Math.sqrt(norm) || 1;
  for (let d = 0; d < DIM; d++) vec[d] /= norm;
  return vec;
}

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // both normalized
}

export interface MemoryEntry {
  id: string;
  text: string;
  value: unknown;
  vector: Float32Array;
  createdAt: number;
  metadata: Record<string, unknown>;
}

export class Memory {
  private entries: MemoryEntry[] = [];
  private idCounter = 0;

  insert(text: string, value: unknown = null, metadata: Record<string, unknown> = {}): string {
    const id = `mem_${++this.idCounter}`;
    this.entries.push({
      id,
      text,
      value,
      vector: hashEmbed(text),
      createdAt: Date.now(),
      metadata,
    });
    return id;
  }

  search(query: string, opts: { topK?: number; threshold?: number; recent?: number } = {}): MemoryEntry[] {
    const { topK = 5, threshold = 0.0, recent } = opts;
    const qv = hashEmbed(query);

    let candidates = this.entries;

    // Filter to most recent N entries first
    if (recent !== undefined && recent > 0) {
      candidates = [...candidates]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, recent * 10); // over-fetch then rank
    }

    const scored = candidates
      .map(e => ({ entry: e, score: cosine(qv, e.vector) }))
      .filter(({ score }) => score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return scored.map(({ entry }) => entry);
  }

  size(): number {
    return this.entries.length;
  }

  clear(): void {
    this.entries = [];
  }
}
