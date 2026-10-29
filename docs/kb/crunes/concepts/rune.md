---
type: concept
title: Rune
description: A declared, discoverable command declared with a run block — either an isolate module (*.rune.js) or a native script (.sh, .py, .js, program) — that returns structured output.
tags: [concept, rune]
---

# Rune

A rune is a named, described, discoverable command that belongs to a project workspace (or the global store). It is declared with a `run` block in configuration.

A rune belongs to one of two runtime tiers:

* **Isolate runes (`*.rune.js`)** — evaluated in a fresh V8 isolate (`isolated-vm`), gated by granular permissions. All standard `@utils` APIs apply.
* **Script runes (`.sh`, `.py`, `.js`, programs on PATH)** — executed natively by an interpreter or as a subprocess with caller access. An optional `args` block defines argument validation and JSON schemas without requiring JavaScript.

## Where a rune comes from

| Source | Key form | Lives in |
|---|---|---|
| Project | `api` | the project's config and `.crunes/runes/` |
| Global | `api` | the store's config and `<store>/runes/` |
| Plugin | `marketplace@plugin:rune` | an installed [plugin](/concepts/plugin.md) |

A bare key resolves against the project first, then against enabled plugins. When two plugins expose the same bare key, resolution refuses rather than choosing, and names the qualified forms — silent shadowing would make it impossible to audit which code actually ran.

## Two execution modes

A rune runs in one of two modes:

**`run` is one invocation.** For isolate runes, the sandbox is created, `run(args)` runs, and the isolate is destroyed. For script runes, the script runs direct (with caller streams and exit code) or captured (in batches or JSONL). See [Invocation output](/specs/invocation-output.md).

**`repl` is an interactive session.** `crunes repl <key>` keeps the isolate alive across inputs, allowing session state and connections to survive. A rune has a REPL only when it declares a `repl` block.

## Two trust tiers

* **Isolate runes** are untrusted by default and run strictly within permissions granted in `run.permissions` and `repl.permissions`.
* **Script runes** run natively with the user's full permissions. A script rune in a plugin is refused until explicitly reviewed and trusted via `crunes plugin trust`.

## What a rune is not

**Not a shell script with extra steps.** A rune wrapping a command justifies itself by adding discovery, argument validation, structured output, and documentation.

**Not a long-running service.** A rune that must outlive its invocation starts a background job tracked by the CLI.
