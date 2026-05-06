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

**`crunes-cli/`** — The npm package `@darkrymit/crunes-cli`. Node.js ≥ 20, ESM, esbuild-bundled. Provides the `crunes` CLI: `use`, `list`, `init`, `create`, `check`, `bench`, and full plugin/marketplace/template management. All rune execution happens here inside isolated-vm sandboxes. Has its own KB at `crunes-cli/docs/knowledge-base/`.

**`crunes-aci/`** — The Claude Code plugin `crunes-aci`. Not an npm package — installed as a plugin directly into Claude Code via `crunes plugin install`. Contains:
- `hooks/hooks.json` + `scripts/hook-wrapper.js` — `UserPromptSubmit` hook that resolves `$key[=args]` tokens and injects rune output as XML context before the model sees the prompt.
- `skills/` — `crunes-use`, `crunes-list`, `crunes-create` skills for manual mid-conversation rune access.

## Context Rune Usage

The KB and module-structure runes live in `crunes-cli/`. Run them from inside that directory:

```bash
cd crunes-cli

# Module structure
crunes use m=<module> --plain

# Module + KB in one shot
crunes use m=<module> -a kb=m,<module> --plain

# All KB entries (index)
crunes use kb --plain

# Flow doc
crunes use kb=f,use --plain
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
