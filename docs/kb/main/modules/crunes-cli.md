---
type: module
title: crunes-cli
description: The CLI, the sandbox and the permission engine — the only repository that executes anything, published to npm as the package every other part assumes is installed.
tags: [repository, cli]
---

# crunes-cli

The runtime. It resolves a rune key, builds an isolate, injects the utils bridge, enforces permissions on every call through it, and renders what comes back. Everything else in the project is content this executes or documentation about it.

Published to npm as `@darkrymit/crunes-cli`. It works standalone: no plugin, skill or marketplace is required for a project to define runes and run them.

**Its knowledge base is [`crunes-cli-main`](kb:crunes-cli-main/index.md)** — module boundaries, execution flows, the sandbox and storage patterns, and the traps found while building it.

## What it owns that nothing else does

**The sandbox boundary.** A fresh V8 isolate per invocation, no Node built-ins inside it, and every capability reaching the host through an injected reference. This is the mechanism the whole [permission model](/concepts/permission.md) rests on, and the constraint that shapes the codebase: adding a capability means touching the host implementation, the injection and the in-isolate bootstrap, and missing one of the three fails silently.

**Configuration layering.** Three layers — global store, project, and a gitignored local file — merged with a rule per key, and a rootless mode for directories that are not projects at all.

**The documentation pipeline.** `crunes docs` renders from TypeScript declarations and from live rune schemas rather than from prose, which is why an agent with only the CLI installed gets an accurate API reference. It is also why [the skills state no API surface](/decisions/skills-state-no-api.md).

## Boundary

It knows what a plugin and a marketplace *are* — it installs, enables and resolves them — but it contains none. It knows nothing about the skills; they are written against its command line like any other caller.
