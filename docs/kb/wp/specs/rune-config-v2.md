---
type: spec
title: Rune configuration v2
description: The proposed shape of a rune entry — one block per lifecycle crunes executes in its own context, each naming its handler with command, with nothing resolved by convention — and the migration from the path-and-permissions entry.
tags: [spec, config, rune, lifecycle, proposal, mvp0]
---

# Rune configuration v2

**Proposal, MVP0.** The outcome of [Shape of a rune entry](/decisions/rune-entry-shape.md), written from [Runes in any language](/vision/multi-runtime-runes.md). It replaces the entry described in [Rune](kb:crunes-main/concepts/rune.md) and the lifecycle-scoped grants of [Permission](kb:crunes-main/concepts/permission.md).

## 1. Principle: nothing is found that was not declared

Every handler a rune has is named in its entry. There is no default file, no probing of extensions, and no lifecycle that exists because a module happens to export it. A rune without a `run` block does not run; a rune without a `repl` block has no REPL.

This replaces two fallbacks that exist today: an entry without `path` resolving to `.crunes/runes/<key>.js` (`runes/<key>.js` in the global layer and in a plugin), and `crunes repl` working for any rune whose module exports the REPL functions.

## 2. Blocks

**A lifecycle crunes executes in its own context has its own block, named after its export. Lifecycles that share state belong to the block of the one that owns the state.**

| Block | Lifecycles it holds | Executes in |
|---|---|---|
| `args` | `args` | its own isolate; the schema is cached |
| `run` | `run`, `dispose` | the run context; `dispose` shares it |
| `argsRepl` | `argsRepl` | its own isolate; the schema is cached |
| `commandsRepl` | `commandsRepl` | its own isolate; the schema is cached |
| `repl` | `repl`, `bannerRepl`, `inputRepl`, `completeInputRepl`, `disposeRepl` | the session isolate; module state is the session |

`completeInputRepl` stays in the session because completion routinely depends on session state.

### 2.1 Fields

| Block | Fields |
|---|---|
| `run` | `command` (required), `argv`, `permissions` |
| `args`, `argsRepl`, `commandsRepl`, `repl` | `command`, `permissions` |

A block may be written as a string, which is shorthand for `{ "command": <string> }`.

### 2.2 The top level

`name`, `description`, `vars` and `batch` describe the rune as a whole and stay at the top level. `plugin` stays as the alternative to `run`: an entry has exactly one of the two.

## 3. `command`

`command` is always a single token; crunes never splits it on spaces. It is resolved the way a shell resolves a command:

| Value | Resolved as |
|---|---|
| Contains `/` or `\`, begins with `.`, or is absolute | A file, relative to the directory of the configuration layer that declared it (for a plugin, the plugin root) |
| A bare name | A program on `PATH`, executed directly with no shell |

A file's runtime comes from its name:

| File | Runtime |
|---|---|
| `*.rune.js`, `*.rune.mjs` | isolate |
| `*.js`, `*.mjs`, `*.cjs` | Node |
| `*.py` | Python |
| `*.sh` | bash |
| any other name | executed directly — a shebang, or an executable format on Windows |

How the interpreter for a script is found is part of the [script rune contract](/specs/script-rune-contract.md).

## 4. `argv`

Arguments always placed before the caller's own, on `run` only. `{ "command": "git", "argv": ["log", "--oneline"] }` invoked as `crunes run log -n 5` executes `git log --oneline -n 5`. An argument's default value when the caller omits it belongs to the argument schema, not here.

## 5. Defaults between blocks

A block may omit `command` only where another block names the module it belongs in. None of these defaults searches for anything: each reads an export from a file the entry already declares.

| Block | `command` when omitted | `permissions` when omitted |
|---|---|---|
| `args` | `run.command`, if it is an isolate module; otherwise the rune has no schema | `run`'s |
| `argsRepl` | `repl.command` | `repl`'s |
| `commandsRepl` | `repl.command` | `repl`'s |
| `repl` | — the block must name its `command` | — |

The grant defaults reproduce today's behaviour, in which `args` is built under the run grants and `argsRepl` and `commandsRepl` under the REPL grants.

## 6. Constraints in MVP0

* **`run`** accepts any `command`. `permissions` and `argv` are both allowed; `permissions` only when `command` is an isolate module, because grants on anything else would read as a sandbox that is not there.
* **`args`, `argsRepl`, `commandsRepl` and `repl`** accept isolate modules only. A separate schema module contributes only its schema export: exporting `run` or `repl` from it is a configuration error.
* **Plugin runes** accept isolate modules only, in every block.
* **An override entry** keyed `marketplace@plugin:rune` carries `vars` and `permissions` inside blocks, never a `command`: it grants, it does not replace.

## 7. Merging across layers

Entries merge per block and key by key, so a local entry that sets only `vars` or `run.permissions` keeps the `run.command` of the layer that defined the rune. `permissions` inside a block is replaced whole by a higher layer, as the lifecycle-scoped block is today. `vars` still merges key by key.

## 8. Examples

```jsonc
"runes": {
  "check": { "run": "scripts/check.sh" },

  "log": {
    "description": "Recent commits",
    "run": { "command": "git", "argv": ["log", "--oneline", "-n", "20"] }
  },

  "deploy": {
    "description": "Deploy to an environment",
    "args": {
      "command": ".crunes/runes/deploy.args.rune.js",
      "permissions": { "allow": ["fs.glob:deploy/envs/*::*"] }
    },
    "run": { "command": "scripts/deploy.sh", "argv": ["--region", "eu"] }
  },

  "db": {
    "description": "Query the local database",
    "run":  { "command": ".crunes/runes/db.rune.js", "permissions": { "allow": ["sqlite.open:data/app.db"] } },
    "repl": { "command": ".crunes/runes/db.rune.js", "permissions": { "allow": ["sqlite.open:data/app.db"] } }
  }
}
```

## 9. Migrating from the current entry

The old shape is refused, not reinterpreted. Each refusal prints the entry rewritten.

| Current | Becomes |
|---|---|
| `path` | `run.command` |
| no `path` | `run.command` naming the file the fallback used to find |
| `permissions.run` | `run.permissions` |
| `permissions.repl` | `repl.permissions` |
| a module exporting the REPL functions | a `repl` block naming that module |
| an isolate module named `*.js` | renamed to `*.rune.js` |

`crunes doctor` reports every entry in every layer that needs one of these rewrites. A plugin manifest moves to `"format": "2"` with the same rewrites.

**Installed plugins need no new consent.** The permissions a user consented to are stored as a flat list per rune, not by lifecycle, so moving grants into blocks changes where they are collected from and not what was agreed to.
