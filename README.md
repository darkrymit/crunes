# crunes

New session. The AI runs `find . -type f` *again*. Your `CLAUDE.md` has a file tree from three weeks ago. You're pasting the exact same API reference into your prompt for the fifth time today.

**crunes** fixes this. It lets you define **runes**—small, project-local scripts that generate context on demand.

Query them from the CLI, pipe them into scripts, or let a native integration inject them automatically into your AI tool. No stale snapshots. No repeated bash commands. No bloated config files.

## How It Works

A rune is simply a JavaScript module living inside your project:

```js
// .crunes/runes/structure.js
import { section, tree } from '@utils'

export async function use(args) {
  // Build and return your live file tree, docs, or API surface
  // This executes on demand, ensuring 100% up-to-date context
  return section.create('structure', { type: 'tree', root: await generateLiveProjectTree() })
}
```

You can query it directly from the CLI with optional arguments:

```bash
crunes use structure
crunes use api v2
crunes -b use structure + api v2
```

With a native integration (like our Agentic Coder Interface), your AI assistant can automatically discover runes and inject their live output directly into its context window. Simply write `$structure` or `$api(v2)` in your prompt and the hook resolves and injects the rune output before the model ever sees it.

## Why Context Runes?

You might be wondering why you can't just use the tools you already have. Here is where standard approaches fall short:

* **Static files (`CLAUDE.md`, `AGENTS.md`) go stale.** Your architecture today isn't your architecture next week. Plus, dumping your entire project structure into a static file wastes tokens on tasks that don't need it. Runes are dynamic and parameterized (e.g., `v2` vs `v3`).
* **Skills describe behavior, not data.** A skill can tell an AI *how* to explore a project, but a rune gives it the exact, current state immediately. (Pro tip: The best pattern is a skill that invokes a rune).
* **Plugins and hooks lock you in.** Generic hooks are usually tool-specific plumbing. A Claude Code hook does nothing for you in a standard terminal, a CI pipeline, or a different AI assistant. Context-runes keeps the logic in your project, versioned with your code, usable anywhere.

## Ecosystem

Context-runes is split into modular packages so you only use what you need:

| Repository | Description |
|---|---|
| [crunes-cli](https://github.com/darkrymit/crunes-cli) | Core CLI (`crunes`) — `use`, `docs`, `version`, `doctor`, `check`, `bench`, `list`, `job`, `cache`, `sqlite`, `init`, `create`, `plugin`, `template`, `marketplace`, `completions`. Works standalone in any environment. |
| [crunes-aci](https://github.com/darkrymit/crunes-aci) | Agentic Coder Interface — native integrations and skills built on top of the CLI (Claude Code and generic CLI tools supported). |

## License

MIT — [Tamerlan Hurbanov (DarkRymit)](https://github.com/darkrymit)
