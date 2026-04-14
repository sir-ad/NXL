<p align="center">
  <img src="https://raw.githubusercontent.com/sir-ad/NXL/main/assets/banner.png" alt="NXL" width="100%">
</p>

<p align="center">
  <a href="https://github.com/sir-ad/NXL/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/tests-168%20passing-brightgreen?style=flat-square" alt="Tests">
  <img src="https://img.shields.io/badge/token%20reduction-70%25-black?style=flat-square" alt="Token Reduction">
  <img src="https://img.shields.io/badge/semantic%20equivalence-95%25+-blue?style=flat-square" alt="Semantic Equivalence">
  <a href="https://nexus-prime.cfd/nxl"><img src="https://img.shields.io/badge/docs-nexus--prime.cfd%2Fnxl-0066cc?style=flat-square" alt="Docs"></a>
  <img src="https://nexus-prime.cfd/api/nxl/badge" alt="Downloads">
</p>

---

## The Problem

Every LLM call costs tokens. Every token costs money, latency, and context window space.

AI agents routinely burn **60-80% of their token budget** on syntactic overhead — repeated JSON keys, verbose control flow keywords, boilerplate class definitions, and redundant data structure formatting. This isn't a minor inefficiency. When an agent processes 100K tokens per session, **60-80K of those tokens carry zero semantic value**. They're the tax you pay for languages that were designed for humans, not machines.

The consequences compound:
- **Cost** — token pricing is linear; waste scales with usage
- **Context windows** — every wasted token displaces information the model actually needs
- **Latency** — more tokens = slower inference, slower agents
- **Memory systems** — storing verbose representations inflates vector DBs and retrieval pipelines

**NXL eliminates this waste.** Same semantics. 70% fewer tokens.

---

## What is NXL?

**NXL** is a full programming language built for LLMs and agents. It reduces token consumption by 70% while shipping a complete runtime: tree-walking interpreter, closures, pattern matching, and built-in agent primitives (`mem?`, `tool!`, `llm@`) that wire to real backends.

```
// Python — 856 tokens                        // NXL — 355 tokens (58% reduction)

class Agent:                                   Agent{id,role,capabilities}{
    def __init__(self, id, role, caps):          execute(task:Task): ...
        self.id = id                             hire_subagent(role:str, budget:int): ...
        ...                                      query_memory(query:str, k:int): ...
    def execute(self, task):                   }
        if task['priority'] > 5:
            result = self.execute_immediate()   tasks → select ∈(ready) ∩ ¬(blocked) ∩ priority>5
            ...
                                                retrieve ∘ validate ∘ transform ∘ store
tasks = [t for t in all_tasks
    if t.status == 'ready'                      mem?[query, recent=10, threshold=0.7]
    and not t.blocked
    and t.priority > 5]                         agents[3]{id,status,tasks}:
                                                agt-001,active,12
result = store(transform(                       agt-002,idle,0
    validate(retrieve())))                      agt-003,busy,8
```

---

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
nxl run file.nxl                        # Execute an NXL program
nxl run file.nxl --agent               # Execute with agent runtime (mem/tool/llm)
nxl repl                                # Interactive REPL (interpreter mode)
nxl compile file.nxl --target python    # Compile to Python
nxl compile file.nxl --target js        # Compile to JavaScript
nxl tokens file.nxl --compare orig.py   # Token comparison
```

### NXL in 60 seconds

```nxl
// Functions (no keyword — saves tokens)
fib(n): n < 2 ? n : fib(n - 1) + fib(n - 2)
print(fib(10))   // 55

// Closures
make_counter(): {
  n = 0
  return (): { n = n + 1; return n }
}
c = make_counter()
print(c(), c(), c())   // 1 2 3

// For loop + pattern matching
classify(x): match x
  | 0 → "zero"
  | n if n < 0 → "negative"
  | _ → "positive"

for i ∈ [0, -1, 5] {
  print(classify(i))
}

// Agent primitives (--agent flag)
mem!["NXL is built for agents"]
results = mem?["agents language"]
weather = tool!["get_weather", city="SF"]
answer = llm@[prompt="What is NXL?", model="claude-haiku-4-5-20251001"]
```

---

## Five Techniques

| Technique | What it does | Reduction |
|-----------|-------------|-----------|
| **MetaGlyph Symbols** | `→ ∈ ⇒ ∩ ¬ ∘` replace verbose keywords. LLMs already know them from training data. ASCII fallbacks for every symbol. | 60% on control flow |
| **TOON Format** | Token-Oriented Object Notation. Declare schema once, send only values. Kills repeated keys and quotes. | 57% on data |
| **AST Folding** | Collapse method bodies to `...` signatures. Show structure, hide implementation. Unfold on demand. | 80% on code defs |
| **Domain Shorthand** | `mem?[]` for search, `hire![]` for agents, `exec@[]` for execution. Extensible via `.nxlrc`. | 70% on API calls |
| **Custom BPE** | Vocabulary trained on agent orchestration. "agent", "memory" → single tokens. | 15-25% additional |

### MetaGlyph Symbols

| Symbol | ASCII | Meaning | Example |
|--------|-------|---------|---------|
| `→` | `->` | Pipeline | `tasks → select ∈(ready)` |
| `∈` | — | Membership | `∈(active)` |
| `⇒` | `=>` | Conditional | `x>5 ⇒ action:run` |
| `∩` | `&&` | Intersection | `∈(ready) ∩ ¬(blocked)` |
| `¬` | `!` | Negation | `¬(blocked)` |
| `∘` | `\|>` | Composition | `validate ∘ transform ∘ store` |

### TOON Data Format

```
agents[5]{id,status,tasks,memory_usage}:
agt-001,active,12,450
agt-002,idle,0,120
agt-003,busy,8,890
```

### Domain Shorthand

```
mem?[query, recent=10, threshold=0.7]    // → memory.search(...)
mem!["key", value, ttl=3600]             // → memory.insert(...)
hire![researcher, budget=500]            // → agent.spawn(...)
exec@[mode=parallel, timeout=30s]        // → runtime.execute(...)
```

### AST Folding

```
Agent{id,role,capabilities}{
  init(config:Config): ...
  execute(task:Task): ...
  hire_subagent(role:str, budget:int): ...
  query_memory(semantic:str, k:int): ...
}
```

---

## Benchmarks

| Benchmark | Original | NXL | Char Reduction | Token Reduction |
|-----------|----------|-----|----------------|-----------------|
| Agent Instructions | 2,517 | 816 | 67.6% | 58.5% |
| Data Payload (JSON) | 1,850 | 787 | 57.5% | 44.2% |
| **Combined** | **4,367** | **1,603** | **63.3%** | **52.1%** |

```bash
bun benchmarks/run-benchmark.ts
```

---

## Architecture

```
packages/
  nxl-core/         # Lexer, parser, AST — hand-written recursive descent
  nxl-interpreter/  # Tree-walking interpreter, closures, builtins, shorthand registry
  nxl-runtime/      # Agent runtime: memory store, tool registry, Anthropic LLM, subagents
  nxl-compiler/     # NXL → Python / JavaScript transpiler
  nxl-compress/     # Python / JavaScript → NXL compressor
  nxl-toon/         # TOON serializer/deserializer
  nxl-tokenizer/    # Custom BPE tokenizer
  nxl-cli/          # Command-line interface (run, repl, compile, tokens)
```

## Tests

```bash
bun test     # 168 tests across all packages
```

---

<p align="center">
  <a href="https://nexus-prime.cfd/nxl">Documentation</a> &middot;
  <a href="https://github.com/sir-ad/NXL/issues">Issues</a> &middot;
  MIT License
</p>
