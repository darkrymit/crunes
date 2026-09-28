---
type: spec
title: Script rune contract
description: The MVP0 contract between crunes and a Node, Python or bash script registered as a rune — how the runtime is chosen, how the interpreter is found, what the script receives and what crunes does with what it returns.
tags: [spec, rune, runtime, proposal, mvp0]
---

# Script rune contract

**Proposal, MVP0.** Written from [Runes in any language](/vision/multi-runtime-runes.md). How a rune entry names its file is still open — see [Shape of a rune entry](/decisions/rune-entry-shape.md) — and nothing below depends on which shape wins.

MVP0 is one feature: **a Node, Python or bash script can be a rune.** It covers the `run` lifecycle only.

## 1. Choosing the runtime

The runtime is chosen from the handler file's name:

| File | Runtime |
|---|---|
| `*.rune.js`, `*.rune.mjs` | isolate — today's runes, renamed |
| `*.js`, `*.mjs`, `*.cjs` | native Node |
| `*.py` | Python |
| `*.sh` | bash |

A file matching none of these is a configuration error unless its entry names the runtime explicitly.

**Only a rune's entry file carries `.rune.js`.** A module the isolate imports from a rune keeps its own name and resolves as it does today.

## 2. Finding the interpreter

The author names the file; crunes finds what runs it.

* **Node** — the Node binary crunes itself is running on. There is nothing to find.
* **Python** — the first that exists: `CRUNES_PYTHON`; the active `VIRTUAL_ENV`; a `.venv/` or `venv/` at the project root; `python3`; `python`; `py -3` on Windows. Resolving a project virtualenv without being told is what lets a Python rune import the project's own packages.
* **bash** — the resolution `shell.exec` already uses, including `CRUNES_BASH` and Git Bash on Windows.

When nothing is found, the error names every candidate tried and the variable that overrides the search. The resolved interpreter is cached per project, and `crunes doctor` reports it for every script rune.

## 3. What the script receives

* **Arguments** — everything after the rune key, unchanged and unparsed. `crunes run coverage auth --min 80` gives the script `auth --min 80`.
* **Working directory** — the project root.
* **Environment** — the caller's environment, plus:

| Variable | Value |
|---|---|
| `CRUNES_PROJECT_ROOT` | Absolute path of the project root |
| `CRUNES_RUNE_KEY` | The key the rune was invoked by |
| `CRUNES_LIFECYCLE` | `run` |

* **Standard input** — inherited, so `cat data.csv | crunes run import` works.
* **Signals** — an interrupt delivered to crunes is forwarded to the script.

## 4. What crunes does with the result

* **Standard output** becomes one text section, rendered the way a rune's text output is rendered today.
* **Standard error** streams through as it is written.
* **The exit code** becomes crunes's exit code.

## 5. Trust

* A script rune runs with the full access of whoever invoked it. `crunes list` and `crunes docs rune` mark it as native and name its runtime.
* A `permissions` block on a script rune is a configuration error, so that nobody reads one as a sandbox.
* Script runes may be declared in project and global configuration only. A plugin rune must be an isolate rune.

## 6. Migrating isolate runes

Plain `.js` now means native Node, so an existing isolate rune must be renamed to `.rune.js`. To keep a missed rename from silently running a sandboxed rune with full access:

* **A plain `.js` or `.mjs` entry that imports `@utils` is refused**, with the exact rename and configuration edit that fixes it. Native Node can never import `@utils`, so a match is always a missed rename. This is a guard, not the rule that chooses a runtime.
* **`crunes doctor` runs the same check** over every rune in every configuration layer.
* **`crunes create` scaffolds `.rune.js`.**

## 7. What later lifecycles may rely on

These hold from MVP0 onward, so that every later addition is additive:

* **Raw arguments are always passed.** A parsed-arguments variable added with argument schemas sits beside them.
* **`CRUNES_LIFECYCLE` is always set.** A later lifecycle is opt-in per rune in configuration, so a script that ignores the variable is never invoked for a lifecycle it does not handle.
* **Plain standard output stays the default.** Structured output will be a mode the entry declares, never one inferred from content.
* **The `CRUNES_` environment prefix is reserved** for this contract.

## 8. Not in MVP0

Argument schemas, static or produced by a script, and the parsed-arguments variable. `dispose` and a per-invocation state directory. REPL lifecycles for scripts. Command aliases mapping arguments onto another program's argv. Structured section output from scripts. Script runes in plugins. Declared interpreter versions. A `--lang` option on `crunes create`.
