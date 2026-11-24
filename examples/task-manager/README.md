# Task Manager

A per-project task tracker demonstrating complex argument structures in crunes runes.

## What it demonstrates

- **Nested subcommands** — `task add`, `task list`, `task done`, `task rm`, `task tag`
- **Three-level nesting** — `task tag add|remove|list <id>` with positionals accumulating across levels
- **Per-subcommand flags and positionals** — each command declares its own `option()` and `positional()` calls
- **`.example()` calls** — on the root builder, individual subcommands, and the `tag` subtree
- **`args.$command` routing** — the `run()` function routes on the space-joined command path (`'tag add'`, `'tag remove'`, `'tag list'`)
- **Relative imports inside the sandbox** — `task/src/index.rune.js` imports handlers from `./*.js`, covered by an `fs.read:.crunes/runes/task/src/**` grant

## How to run

```bash
cd examples/task-manager

crunes run init
crunes run task add "Buy milk" --priority high --tag shopping
crunes run task add "Write docs" --tag docs
crunes run task list
crunes run task list --status open --tag shopping
crunes run task done 1
crunes run task tag add 2 urgent
crunes run task tag list 2
crunes run task tag remove 2 urgent
crunes run task rm 2
```

## What to expect

- `task add` — confirmation line with task ID, title, priority, and tags
- `task list` — markdown table with ID, Title, Priority, Status, Tags columns
- `task done` / `task rm` — confirmation line with task ID and title
- `task tag add` / `tag remove` — confirmation line
- `task tag list` — comma-separated list of tags on the task

## Key patterns

### `args.$command` routing

`args.$command` is the space-joined string of matched command tokens. The `run()` function in `task/src/index.rune.js` routes on it:

```js
const cmd = args.$command ?? ''
if (cmd === 'add')         return handleAdd(args, fs, section, md)
if (cmd.startsWith('tag')) return handleTag(args, fs, section, md)
```

Inside `tag.js`, the same value distinguishes sub-levels:

```js
const sub = args.$command  // 'tag add', 'tag remove', 'tag list'
if (sub === 'tag add') { ... }
```

### Relative imports from within `.crunes/runes/task/src/`

`index.rune.js` imports handler modules using paths relative to its own directory:

```js
import { handleAdd } from './add.js'
```

The sandbox resolves these off the referrer's path — no `@project/` prefix needed. Project runes still need an `fs.read` grant covering the imported files: `fs.read:.crunes/runes/task/src/**` in `config.json`.

### Positionals accumulate across nesting levels

Each `tag` sub-command (`add`, `remove`, `list`) declares `<id>` as its first positional; `add` and `remove` also declare `<tag>`. Both land on the same `args` object:

```
crunes run task tag add 1 urgent
  → args.id === '1'
  → args.tag === 'urgent'
  → args.$command === 'tag add'
```
