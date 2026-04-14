# Phase 8: Self-Hosting Roadmap

NXL self-hosting means the NXL lexer, parser, and interpreter are written in NXL itself. This is the ultimate test that the language is expressive enough for real-world programs.

## Status: In progress

`lexer.nxl` — a working NXL lexer written in NXL. Run it:

```bash
nxl run examples/self-host/lexer.nxl
```

## Why self-hosting matters

- If NXL can implement its own parser, it's genuinely Turing-complete and expressive enough for real programs.
- The self-hosted implementation becomes the canonical reference — any discrepancy between the TypeScript host and the NXL implementation is a bug.
- Self-hosting eliminates the dependency on Node.js/Bun for running NXL programs.

## Roadmap to full self-hosting

### Step 1 — Self-hosted lexer (done)
`lexer.nxl` tokenizes a subset of NXL source.
Missing: unicode MetaGlyphs (→ ∈ ⇒ ∩ ¬ ∘), multi-char operators (`**`, `||`, `>=`, `<=`, `!=`, `==`).

### Step 2 — Self-hosted parser
A recursive-descent parser written in NXL that produces an AST (as a list of dicts).
Requires: full lexer, pattern matching, recursive functions — all of which exist.

### Step 3 — Self-hosted interpreter
A tree-walking evaluator over the AST from Step 2.
Requires: the parser + a dict-based environment + recursive eval function.

### Step 4 — Bootstrap
1. Compile the NXL interpreter (self-hosted) with the TypeScript host.
2. Use the NXL interpreter to run itself on its own source.
3. Both must produce the same output — if they do, self-hosting is verified.

## What makes this tractable

NXL already has:
- ✅ First-class functions and closures
- ✅ Pattern matching (`match`)
- ✅ For/while loops
- ✅ File I/O (`read_file`, `write_file`)
- ✅ Regex (`regex_test`, `regex_find`)
- ✅ List/dict as universal data structures
- ✅ Module system (`use`/`pub`)

The self-hosted implementation can use dicts as AST nodes:
```nxl
// Example AST node representation
node = {"kind": "BinaryExpression", "op": "+", "left": ..., "right": ...}
```

And the interpreter is a recursive `eval` function:
```nxl
eval(node, env): match node.kind
  | "NumberLiteral"  → num(node.value)
  | "Identifier"     → dict_get(env, node.name)
  | "BinaryExpression" → eval_binary(node, env)
  | _                → null
```
