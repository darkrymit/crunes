# Task Manager

A per-project task tracker demonstrating complex argument structures in crunes runes.

## What it demonstrates

- **Nested subcommands** — `task add`, `task list`, `task done`, `task rm`, `task tag`
- **Three-level nesting** — `task tag <id> add|remove|list` with positionals accumulating across levels
- **Per-subcommand flags and positionals** — each command declares its own `option()` and `positional()` calls
- **`.example()` calls** — on the root builder, individual subcommands, and the `tag` subtree
- **`args.$command` routing** — the `use()` function routes on the space-joined command path (`'tag add'`, `'tag remove'`, `'tag list'`)
- **Relative imports inside the sandbox** — `task.js` imports handlers from `../scripts/*.js` with no permission token required

## How to run

```bash
cd examples/task-manager

crunes use init
crunes use task add "Buy milk" --priority high --tag shopping
crunes use task add "Write docs" --tag docs
crunes use task list
crunes use task list --status open --tag shopping
crunes use task done 1
crunes use task tag 2 add urgent
crunes use task tag 2 list
crunes use task tag 2 remove urgent
crunes use task rm 2
```

## What to expect

- `task add` — confirmation line with task ID, title, priority, and tags
- `task list` — markdown table with ID, Title, Priority, Status, Tags columns
- `task done` / `task rm` — confirmation line with task ID and title
- `task tag add` / `tag remove` — confirmation line
- `task tag list` — comma-separated list of tags on the task

## Key patterns

### `args.$command` routing

`args.$command` is the space-joined string of matched command tokens. The `use()` function in `task.js` routes on it:

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

### Relative imports from within `.crunes/runes/`

`task.js` imports handler modules using paths relative to its own directory:

```js
import { handleAdd } from '../scripts/add.js'
```

The sandbox resolves these off the referrer's path — no `@project/` prefix or permission token needed.

### Positionals accumulate across nesting levels

The `tag` command declares `<id>` as a positional, and its sub-commands (`add`, `remove`) each declare `<tag>`. Both land on the same `args` object:

```
crunes use task tag 1 add urgent
  → args.id === '1'
  → args.tag === 'urgent'
  → args.$command === 'tag add'
```
