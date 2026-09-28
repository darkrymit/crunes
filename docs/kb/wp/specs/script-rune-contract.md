---
type: spec
title: Script rune contract
description: The MVP0 contract between crunes and a Node, Python or bash script registered as a rune — how the interpreter is found, what the script receives and what crunes does with what it returns.
tags: [spec, rune, runtime, proposal, mvp0]
---

# Script rune contract

**Proposal, MVP0.** Written from [Runes in any language](/vision/multi-runtime-runes.md). How an entry names its script, and which file names select which runtime, is [Rune configuration v2](/specs/rune-config-v2.md).

MVP0 is one feature: **a Node, Python or bash script, or a program on `PATH`, can serve a rune's `run` lifecycle**, optionally behind an argument schema built by an isolate module in the rune's `args` block. Every other lifecycle stays isolate-only.

## 1. Finding the interpreter

The author names the file; crunes finds what runs it.

* **Node** — the Node binary crunes itself is running on. There is nothing to find.
* **Python** — the first that exists: `CRUNES_PYTHON`; the active `VIRTUAL_ENV`; a `.venv/` or `venv/` at the project root; `python3`; `python`; `py -3` on Windows. Resolving a project virtualenv without being told is what lets a Python rune import the project's own packages.
* **bash** — the resolution `shell.exec` already uses, including `CRUNES_BASH` and Git Bash on Windows.
* **A program, or a file with no known extension** — executed directly; there is no interpreter to find.

When nothing is found, the error names every candidate tried and the variable that overrides the search. The resolved interpreter is cached per project, and `crunes doctor` reports it for every script rune.

## 2. Arguments

* **Without an argument schema**, crunes does not parse the caller's arguments. Everything after the rune key is passed on unchanged, `--help` included.
* **With a schema** from the rune's `args` block, crunes validates the call before anything is spawned: `--help` and invalid arguments are answered by crunes and never reach the script, and `crunes docs rune` documents the rune. The script then receives both the raw arguments and the parsed result.

The process is invoked as the `command`, then the entry's `argv`, then the caller's arguments. `crunes run deploy staging --dry-run` against `{ "command": "scripts/deploy.sh", "argv": ["--region", "eu"] }` runs the script with `--region eu staging --dry-run`.

**A schema built from project state goes stale.** The schema cache is keyed on the schema module's content and the rune's `vars`, so choices read from the filesystem are frozen until the module changes. A schema module opts out with `export const cache = false`.

## 3. What the script receives

* **Working directory** — the project root.
* **Environment** — the caller's environment, plus:

| Variable | Value |
|---|---|
| `CRUNES_PROJECT_ROOT` | Absolute path of the project root |
| `CRUNES_RUNE_KEY` | The key the rune was invoked by |
| `CRUNES_LIFECYCLE` | `run` |
| `CRUNES_ARGS` | The parsed arguments as JSON — only when the rune has a schema |

* **Standard input** — inherited, so `cat data.csv | crunes run import` works.
* **Signals** — an interrupt delivered to crunes is forwarded to the script.

## 4. What crunes does with the result

* **Standard output** becomes one text section, rendered the way a rune's text output is rendered today.
* **Standard error** streams through as it is written.
* **The exit code** becomes crunes's exit code.

## 5. Trust

* A script rune runs with the full access of whoever invoked it. `crunes list` and `crunes docs rune` mark it as native and name its runtime or program.
* `run.permissions` on a script rune is a configuration error, so that nobody reads one as a sandbox. The isolate modules in its other blocks keep their own grants.
* Script runes may be declared in project and global configuration only. Every block of a plugin rune must be an isolate module.

## 6. The missed rename

Plain `.js` now means native Node, so an isolate module that keeps its old name would run with full access. **A plain `.js` or `.mjs` handler that imports `@utils` is refused**, with the rename that fixes it. Native Node can never import `@utils`, so a match is always a missed rename. This is a guard, not the rule that chooses a runtime; `crunes doctor` runs the same check over every layer.

## 7. What later lifecycles may rely on

These hold from MVP0 onward, so that every later addition is additive:

* **Raw arguments are always passed**, with or without a schema.
* **`CRUNES_LIFECYCLE` is always set.** A script is only ever invoked for a lifecycle whose block names it, so a script that ignores the variable never receives one it does not handle.
* **Plain standard output stays the default.** Structured output will be a mode the entry declares, never one inferred from content.
* **The `CRUNES_` environment prefix is reserved** for this contract.

## 8. Not in MVP0

`dispose` for scripts, and a per-invocation state directory for it. Argument schemas written statically in configuration or printed by a script, which need the schema format published as a contract first. REPL lifecycles for scripts. Mapping parsed arguments onto a program's `argv`. Structured section output from scripts. Script runes in plugins. Declared interpreter versions. A `--lang` option on `crunes create`.
