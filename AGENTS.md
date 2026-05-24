# AGENTS.md

AI-first guide to the crunes monorepo. Read this before touching any code.

## Repository Structure

```
crunes/
  crunes-cli/    ← Core CLI — the crunes command, rune execution, plugin system
  crunes-aci/    ← Agentic Coder Interface — Claude Code plugin, hook wrapper, skills
  docs/
    proposals/   ← Feature proposals (active/, outdated/, rework/)
  examples/
  smoke/         ← Smoke tests
```

Each package has its own `AGENTS.md` with module-level context. Read the relevant one before touching that package's code.

## Package Summaries

**`crunes-cli/`** — The npm package `@darkrymit/crunes-cli`. Node.js ≥ 20, ESM, esbuild-bundled. Provides the `crunes` CLI: `use`, `list`, `init`, `create`, `check`, `bench`, `jobs`, `cache`, `sqlite`, and full plugin/marketplace/template management. All rune execution happens here inside isolated-vm sandboxes. Has its own KB at `crunes-cli/docs/knowledge-base/`.

**`crunes-aci/`** — The Claude Code plugin `crunes-aci`. Not an npm package — installed as a plugin directly into Claude Code via `crunes plugin install`. Contains:
- `hooks/hooks.json` + `scripts/hook-wrapper.js` — `UserPromptSubmit` hook that resolves `$key`, `$key(arg1,arg2)`, `$key::section`, and `$plugin:key(args)::section` tokens and injects rune output as XML context before the model sees the prompt.
- `skills/` — `crunes-help`, `crunes-use-rune`, `crunes-use-plugin`, `crunes-write-rune`, `crunes-write-plugin` skills for mid-conversation rune and plugin access.

## Context Rune Usage

The KB and module-structure runes live in `crunes-cli/`. Run them from inside that directory:

```bash
cd crunes-cli

# Module structure
crunes -p use m <module>

# Module + KB in one shot
crunes -p use m <module> + kb -m <module>

# All KB entries (index)
crunes -p use kb

# Flow doc
crunes -p use kb -f use
```

For changes to `crunes-aci/` only (no CLI changes), crunes context is less useful — read the hook and skill files directly.

## Working Across Packages

- Changes to rune execution (isolation, utils API, permissions) → `crunes-cli/src/rune/`
- Changes to how rune output is injected into Claude Code → `crunes-aci/scripts/hook-wrapper.js`
- New skills → `crunes-aci/skills/`
- CLI commands → `crunes-cli/src/<module>/commands/`

Never modify `crunes-cli/dist/` by hand — it is built by `npm run build` inside `crunes-cli/` and committed only as part of a release.

## Detailed Agent Docs

- `crunes-cli/AGENTS.md` — CLI-specific workflow, restrictions, build commands, release process, and testing philosophy.
