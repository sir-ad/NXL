# AGENTS.md

This file is used by Codex and other repo-local agent tooling.

<!-- nexus-prime:codex-bootstrap:start -->
## Nexus Prime Bootstrap (managed)

> This block is managed by `nexus-prime setup codex` or automatic bootstrap.
> Keep your project-specific Codex guidance above or below it.

## Nexus Prime Managed Bootstrap

- REQUIRED session start: call `nexus_session_bootstrap(goal, files?)`, then `nexus_orchestrate(prompt=<raw user request>)`.
- `nexus_orchestrate` does NOT replace during-work or session-close lifecycle steps.
- Use `nexus_plan_execution` only when a plan-before-run is requested.
- Discover catalogs only when needed: `nexus_list_skills`, `nexus_list_workflows`, `nexus_list_hooks`, `nexus_list_automations`, `nexus_list_specialists`, `nexus_list_crews`.
- REQUIRED before reading 3+ files: call `nexus_optimize_tokens(goal, files)`.
- REQUIRED before file modification or destructive work: call `nexus_mindkit_check(action, filesToModify)`.
- REQUIRED before refactoring 3+ files: call `nexus_ghost_pass(goal, files)`.
- REQUIRED after significant findings and at session end: call `nexus_store_memory(content, priority, tags)`.
- REQUIRED before ending the session: call `nexus_session_dna(action="generate")`.
- Worker context lives in `.agent/runtime/context.json`; the compiled packet lives in `.agent/runtime/packet.json`.
<!-- nexus-prime:codex-bootstrap:end -->

