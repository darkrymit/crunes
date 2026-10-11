---
type: concept
title: Rune
description: A JavaScript module that declares a command line, runs in a sandbox with only the capabilities it was granted, and returns structured sections.
tags: [concept, rune]
---

# Rune

A rune is an ESM JavaScript module that the CLI resolves by key, loads into a fresh V8 isolate, and calls. It is the unit everything else in the project exists to serve.

A rune is three things at once, and all three are declared in the module itself:

* **A command line.** An `args` export receives a builder and declares options, positionals, subcommands and examples. The CLI parses the user's invocation against that schema before the rune runs, so a rune never parses `argv`.
* **A capability request.** What the rune may read, write, run or reach is not in the module — it is in configuration, as patterns, granted by whoever installed it. See [permission](/concepts/permission.md).
* **A function returning sections.** The `run` export receives the parsed arguments and returns [sections](/concepts/section.md), not text.

## Where a rune comes from

| Source | Key form | Lives in |
|---|---|---|
| Project | `api` | the project's config and `.crunes/runes/` |
| Global | `api` | the store's config and `<store>/runes/` |
| Plugin | `marketplace@plugin:rune` | an installed [plugin](/concepts/plugin.md) |

A bare key resolves against the project first, then against enabled plugins. When two plugins expose the same bare key, resolution refuses rather than choosing, and names the qualified forms — silent shadowing would make it impossible to audit which code actually ran.

## Two lifecycles

A rune runs in one of two modes, and they are separate permission surfaces rather than one.

**`run` is one invocation.** The isolate is created, the module is evaluated, `run(args)` is called, sections are collected, the isolate is torn down. Nothing survives.

**`repl` is a session.** `crunes repl <key>` keeps the isolate alive across inputs, so module-level variables are session state and a connection opened once is reused. The rune exports `repl` to initialise and `inputRepl` to handle each input.

A `repl` block does not inherit from `run`. A rune that reads a file in both modes declares that grant twice, because the two modes are reached by different commands and a session is a materially larger thing to hand someone than a single call.

## What a rune is not

**Not a shell script with extra steps.** A rune that wraps one command it could have called directly has earned nothing. What justifies it is reading project state and shaping it — the gathering, the structuring, the parameterization.

**Not a long-running service.** A rune that must outlive its invocation starts a job, and the job is tracked by the CLI rather than by the rune. The isolate is not where a process lives.

**Not trusted.** A project rune written by the person running it and a plugin rune written by a stranger go through the same isolate and the same permission checks. There is no privileged tier.
