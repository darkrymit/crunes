# crunes

New session. The AI runs `find . -type f` *again*. Your `CLAUDE.md` has a file tree from three weeks ago. You're pasting the exact same API reference into your prompt for the fifth time today.

**crunes** fixes this. It lets you define **runes**—small, easy, manageable project-local CLI tools for both human developers and AI assistants to gather dynamic knowledge or execute safe, structured actions on demand.

Query them from the CLI, pipe them into scripts, or let a native integration inject them automatically into your AI tool. No stale snapshots. No repeated bash commands. No bloated config files.

## How It Works

A rune is simply a JavaScript module living inside your project:

```js
// .crunes/runes/api.js
import { section } from '@utils'

// 1. Declare your CLI interface & typed arguments schema
export async function args(b) {
  return b
    .option('--verbose', 'Enable verbose logging', false)
    .command('endpoints', 'Gather registered API endpoints', endpoints => {
      endpoints.positional('<module>', 'Target module name to scan')
    })
}

// 2. Execute on demand to gather knowledge or take action
export async function use(args) {
  if (args.$command === 'endpoints') {
    const data = await scanModuleEndpoints(args.module)
    return section.create('api-endpoints', { type: 'markdown', content: data })
  }
}
```

You can query it directly from the CLI:

```bash
crunes use api endpoints authentication
```

With a native integration (like our Agentic Coder Interface), your AI assistant can automatically discover runes and inject their live output directly into its context window. Simply write `$$api(endpoints,authentication)` or `$$api::api-endpoints` in your prompt and the hook resolves and injects the rune output before the model ever sees it.

## Why Crunes?

You might be wondering why you can't just use the tools you already have. Here is where standard approaches fall short:

* **Static files (`CLAUDE.md`, `AGENTS.md`) go stale.** Your architecture today isn't your architecture next week. Plus, dumping your entire project structure into a static file wastes tokens on tasks that don't need it. Runes are dynamic and parameterized (e.g., `v2` vs `v3`).
* **Skills describe behavior, not data.** A skill can tell an AI *how* to explore a project, but a rune gives it the exact, current state immediately. (Pro tip: The best pattern is a skill that invokes a rune).
* **Brittle shell scripts and Makefiles scale poorly.** Bash scripts are platform-dependent, hard to maintain, and lack unified structure. Runes are standard, secure JavaScript ESM modules that act as a single, platform-agnostic command plane for your repository.
* **Plugins and hooks lock you in.** Generic hooks are usually tool-specific plumbing. A Claude Code hook does nothing for you in a standard terminal, a CI pipeline, or a different AI assistant. Crunes keeps the logic in your project, versioned with your code, usable anywhere.

## Ecosystem

Context-runes is split into modular packages so you only use what you need:

| Repository | Description |
|---|---|
| [crunes-cli](https://github.com/darkrymit/crunes-cli) | Core CLI (`crunes`) — sandboxed JavaScript runtime providing `use`, `docs`, `job`, `cache`, `list`, `init`, `create`, `plugin`, `template`, `marketplace`. Works standalone in any environment. |
| [crunes-aci](https://github.com/darkrymit/crunes-aci) | Agentic Coder Interface — native integrations and skills built on top of the CLI (Claude Code and generic CLI tools supported). |
| [crunes-plugins](https://github.com/darkrymit/crunes-plugins) | Official first-party plugin marketplace — install with `crunes marketplace add darkrymit/crunes-plugins`. |

## License

MIT — [Tamerlan Hurbanov (DarkRymit)](https://github.com/darkrymit)
