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
export async function run(args) {
  if (args.$command === 'endpoints') {
    const data = await scanModuleEndpoints(args.module)
    return section.create('api-endpoints', { type: 'markdown', content: data })
  }
}
```

You can query it directly from the CLI:

```bash
crunes run api endpoints authentication
```

Your AI assistant reaches runes the same way you do — through the CLI. Install the [crunes skills](https://github.com/darkrymit/crunes-skills) and your agent discovers what exists with `crunes list`, inspects a rune's arguments with `crunes docs rune api`, and runs it whenever it needs live project state instead of guessing or re-scanning your tree. No prompt syntax to learn, and it works the same in Claude Code, Codex, a plain terminal, or CI.

## Why Crunes?

You might be wondering why you can't just use the tools you already have. Here is where standard approaches fall short:

* **Static files (`CLAUDE.md`, `AGENTS.md`) go stale.** Your architecture today isn't your architecture next week. Plus, dumping your entire project structure into a static file wastes tokens on tasks that don't need it. Runes are dynamic and parameterized (e.g., `v2` vs `v3`).
* **Skills describe behavior, not data.** A skill can tell an AI *how* to explore a project, but a rune gives it the exact, current state immediately. The two compose: crunes ships skills whose whole job is knowing when and how to invoke a rune.
* **Brittle shell scripts and Makefiles scale poorly.** Bash scripts are platform-dependent, hard to maintain, and lack unified structure. Runes are standard, secure JavaScript ESM modules that act as a single, platform-agnostic command plane for your repository.
* **Tool-specific plumbing locks you in.** A hook written for one assistant does nothing for you in a standard terminal, a CI pipeline, or a different AI assistant. Crunes keeps the logic in your project, versioned with your code, invoked through a CLI that every one of them can call.

## Ecosystem

Context-runes is split into modular packages so you only use what you need:

| Repository | Description |
|---|---|
| [crunes-cli](https://github.com/darkrymit/crunes-cli) | Core CLI (`crunes`) — sandboxed JavaScript runtime providing `run`, `run-repl`, `docs`, `job`, `list`, `init`, `create`, `bench`, `plugin`, `template`, `marketplace`. Works standalone in any environment. |
| [crunes-skills](https://github.com/darkrymit/crunes-skills) | Agent skills — teach Claude Code, Codex, and other agents to discover, run, and write runes. Install with `npx skills add darkrymit/crunes-skills`. |
| [crunes-plugins](https://github.com/darkrymit/crunes-plugins) | Official first-party plugin marketplace — install with `crunes marketplace add darkrymit/crunes-plugins`. |

## License

MIT — [Tamerlan Hurbanov (DarkRymit)](https://github.com/darkrymit)
