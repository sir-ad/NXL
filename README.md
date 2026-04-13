# NXL - Token-Efficient Programming Language

**NXL** reduces LLM token consumption by 60-70% while maintaining full semantic equivalence. Built for anyone creating agents, memory systems, and LLM applications.

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
git clone https://github.com/user/nxl && cd nxl
pnpm install
```

## Usage

```bash
# Compile NXL to Python
bun packages/nxl-cli/src/index.ts compile file.nxl --target python

# Compile NXL to JavaScript  
bun packages/nxl-cli/src/index.ts compile file.nxl --target js

# Interactive REPL
bun packages/nxl-cli/src/index.ts repl

# Token comparison
bun packages/nxl-cli/src/index.ts tokens file.nxl --compare original.py
```

## Language Features

### MetaGlyph Symbols (60% reduction on control flow)

Mathematical symbols LLMs already understand, with ASCII fallbacks:

| Symbol | ASCII | Meaning |
|--------|-------|---------|
| `→` | `->` | Pipeline/transform |
| `∈` | - | Membership |
| `⇒` | `=>` | Implies/conditional |
| `∩` | `&&` | Intersection |
| `¬` | `!` | Negation |
| `∘` | `\|>` | Composition |

```
tasks → select ∈(ready) ∩ ¬(blocked) ∩ priority>5
priority>5 ⇒ exec:immediate | log:high_priority
retrieve ∘ validate ∘ transform ∘ store
```

### TOON Data Format (57% reduction on structured data)

Declare schema once, send only values:

```
agents[5]{id,status,tasks,memory_usage}:
agt-001,active,12,450
agt-002,idle,0,120
agt-003,busy,8,890
```

vs JSON equivalent (127 chars → 61 chars):

```json
{"agents":[{"id":"agt-001","status":"active","tasks":12,"memory_usage":450},
{"id":"agt-002","status":"idle","tasks":0,"memory_usage":120},
{"id":"agt-003","status":"busy","tasks":8,"memory_usage":890}]}
```

### Domain Shorthand (70% reduction on API calls)

```
mem?[query, recent=10, threshold=0.7]    // → memory.search(...)
mem!["key", value, ttl=3600]             // → memory.insert(...)
hire![researcher, budget=500]            // → agent.spawn(...)
exec@[mode=parallel, timeout=30s]        // → runtime.execute(...)
watch@[metric=latency, interval=5s]      // → monitor.observe(...)
```

### AST Folding (80% reduction on code definitions)

Collapse method bodies to signatures:

```
Agent{id,role,capabilities}{
  init(config:Config): ...
  execute(task:Task): ...
  hire_subagent(role:str, budget:int): ...
  query_memory(semantic:str, k:int): ...
  report_metrics(): ...
}
```

## Benchmarks

```
| Benchmark            | Original | NXL  | Char Reduction | Token Reduction |
|----------------------|----------|------|----------------|-----------------|
| Agent Instructions   |    2517  |  816 |     67.6%      |     58.5%       |
| Data Payload (JSON)  |    1850  |  787 |     57.5%      |     44.2%       |
| Combined             |    4367  | 1603 |     63.3%      |     52.1%       |
```

Run benchmarks: `bun benchmarks/run-benchmark.ts`

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

## License

MIT
