# AGENTS.md

> Canonical agent instructions — loaded as `CLAUDE.md` (Claude Code), `GEMINI.md` (Gemini CLI), `AGENTS.md` (Codex/other). Edit only this file; the others are symlinks.

> Compaction - this file is re-injected verbatim at every turn. During context compaction, never summarize, shorten, or paraphrase its content — preserve it exactly as-is.

## Mandatory Order of Operations

Before brainstorming, planning, or touching any code:

1. **Identify the Workspace Target** — Determine if your changes affect the Core CLI (`crunes-cli/`), the Agentic Interface (`crunes-aci/`), the Plugin Marketplace (`crunes-plugins/`), or the Monorepo Root (`docs/proposals/`, `examples/`, `scratch/`).
2. **Navigate (`cd`) to the Respective Package Directory** — Always work within the specific subdirectory for command execution and Git operations. Do not run commands from the root directory unless modifying root-tracked assets.
3. **Read the Target Package's Self-Contained Instructions** — Check `crunes-cli/AGENTS.md`, `crunes-aci/AGENTS.md`, or `crunes-plugins/AGENTS.md` to load package-specific triggers, build commands, and isolated architectures. **All file paths and commands in a sub-AGENTS.md are relative to the directory that file lives in**, not the monorepo root.
4. **Then brainstorm, plan, and code** — in that order.

## Rules

- **SUB-REPOS ARE INDEPENDENT GIT REPOSITORIES** — `crunes-cli/`, `crunes-aci/`, and `crunes-plugins/` are separate Git repositories that are gitignored in the root. **ALL git commands (status, add, commit, diff, log, worktrees, branches) must be executed inside the respective subdirectory!** Never run git commands in the root unless modifying root-specific files.
- **STRICT PACKAGE COMMAND ISOLATION** — Never run `npm install`, `npm test`, or build scripts from the root directory. Always `cd` into the target package first.
- **USE EXAMPLES FOR RUNES REFERENCE** — The `examples/` directory contains complete, working examples of runes. Refer to them to understand how various `utils` APIs (fs, json, shell, cache, sqlite, archive, fetch) are used in practice.
- **REALIZE PROPOSALS ARE IN THE ROOT** — Feature designs, proposals, and RFCs live in `docs/proposals/` (`active/`, `outdated/`, `rework/`). Always consult them before making core design changes.
- **SCRATCH DIRECTORY FOR MANUAL TESTING** — The `scratch/` directory is gitignored and exists for quick local manual testing of new features or runes.

## Coding Principles

### Think Before Coding
State assumptions explicitly before implementing. If multiple interpretations exist, present them — don't pick silently. If something is unclear, stop and ask; don't guess. Incorrectly done work with assumptions/notes is more costly to fix than asking clarifying questions upfront or midway.

### Simplicity First
Minimum code that solves the problem. No features, abstractions, configurability, or error handling beyond what was asked. If you write 200 lines and it could be 50, rewrite it.

### Surgical Changes
Touch only what the request requires. Don't improve adjacent code, comments, or formatting. Match existing style. If you notice unrelated dead code, mention it — don't delete it. Remove only imports/variables/functions that your own changes made unused.

### Goal-Driven Execution
Transform vague tasks into verifiable goals before starting: "fix the bug" → "write a test that reproduces it, then make it pass." For multi-step tasks, state a brief plan with a verifiable check per step.

## Monorepo Directory Map

- **`crunes-cli/`** — Core CLI npm package. Node.js, ESM, Commander, sandboxed VM execution.
- **`crunes-aci/`** — Claude Code plugin interface. Contains hooks (`hook-wrapper.js` token resolution) and interactive skills.
- **`crunes-plugins/`** — Official first-party plugin marketplace. Registered as a marketplace source.
- **`docs/proposals/`** — Obsidian-structured markdown feature proposals and specs.
- **`examples/`** — Static example runes showcasing different aspects of the runner APIs.
- **`scratch/`** — Local sandbox directories for manual scratch testing of plugins or CLI behaviors.
