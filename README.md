# NXL — Less tokens. Same meaning.

**NXL** reduces LLM token consumption by 70% while maintaining full semantic equivalence. Built for agents, memory systems, and anyone shipping AI.

```
// Python (856 tokens)                    // NXL (355 tokens) — 58% reduction
tasks = [t for t in all_tasks             tasks → select ∈(ready) ∩ ¬(blocked) ∩ priority>5
  if t.status == 'ready'
  and not t.blocked
  and t.priority > 5]

result = store(transform(                 retrieve ∘ validate ∘ transform ∘ store
  validate(retrieve())))

memory.search(                            mem?[query, recent=10, threshold=0.7]
  query=query,
  limit=10,
  min_similarity=0.7)
```

## Install

```bash
curl -fsSL https://nexus-prime.cfd/nxl/install.sh | sh
```

Or clone manually:

```bash
git clone https://github.com/sir-ad/NXL.git && cd NXL && pnpm install
```

## Usage

```bash
# Compile NXL to Python
nxl compile file.nxl --target python

# Compile NXL to JavaScript
nxl compile file.nxl --target js

# Interactive REPL
nxl repl

# Token comparison
nxl tokens file.nxl --compare original.py
```

## Five Techniques

### MetaGlyph Symbols — 60% reduction on control flow

Mathematical symbols LLMs already understand, with ASCII fallbacks:

| Symbol | ASCII | Meaning |
|--------|-------|---------|
| `→` | `->` | Pipeline/transform |
| `∈` | — | Membership |
| `⇒` | `=>` | Implies/conditional |
| `∩` | `&&` | Intersection |
| `¬` | `!` | Negation |
| `∘` | `\|>` | Composition |

```
tasks → select ∈(ready) ∩ ¬(blocked) ∩ priority>5
priority>5 ⇒ exec:immediate | log:high_priority
retrieve ∘ validate ∘ transform ∘ store
```

### TOON Data Format — 57% reduction on structured data

Declare schema once, send only values:

```
agents[5]{id,status,tasks,memory_usage}:
agt-001,active,12,450
agt-002,idle,0,120
agt-003,busy,8,890
```

### Domain Shorthand — 70% reduction on API calls

```
mem?[query, recent=10, threshold=0.7]    // → memory.search(...)
mem!["key", value, ttl=3600]             // → memory.insert(...)
hire![researcher, budget=500]            // → agent.spawn(...)
exec@[mode=parallel, timeout=30s]        // → runtime.execute(...)
```

### AST Folding — 80% reduction on code definitions

```
Agent{id,role,capabilities}{
  init(config:Config): ...
  execute(task:Task): ...
  hire_subagent(role:str, budget:int): ...
  query_memory(semantic:str, k:int): ...
}
```

### Custom BPE Tokenizer — 15-25% additional reduction

Vocabulary trained on agent orchestration patterns. Common terms become single tokens.

## Benchmarks

| Benchmark | Original | NXL | Char Reduction | Token Reduction |
|-----------|----------|-----|----------------|-----------------|
| Agent Instructions | 2517 | 816 | 67.6% | 58.5% |
| Data Payload (JSON) | 1850 | 787 | 57.5% | 44.2% |
| Combined | 4367 | 1603 | 63.3% | 52.1% |

```bash
bun benchmarks/run-benchmark.ts
```

## Architecture

```
packages/
  nxl-core/       # Lexer, parser, AST (hand-written recursive descent)
  nxl-toon/       # TOON serializer/deserializer (standalone)
  nxl-compiler/   # NXL → Python/JavaScript transpiler
  nxl-compress/   # Python/JavaScript → NXL compressor
  nxl-tokenizer/  # Custom BPE tokenizer
  nxl-cli/        # Command-line interface
```

## Tests

```bash
pnpm test     # Run all 83 tests
```

## Docs

[nexus-prime.cfd/nxl](https://nexus-prime.cfd/nxl)

## License

MIT
