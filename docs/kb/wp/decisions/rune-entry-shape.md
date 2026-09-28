---
type: decision
title: Shape of a rune entry
description: Lifecycle blocks replace path, each naming its handler with a single command field resolved like a shell resolves one, and nothing is resolved by convention — chosen over keeping path or adding a runtime field.
tags: [decision, config, rune, runtime, lifecycle, proposal]
---

# Shape of a rune entry

**Status: chosen, not implemented.** Part of [Runes in any language](/vision/multi-runtime-runes.md). The resulting contract is [Rune configuration v2](/specs/rune-config-v2.md).

## Context

A rune entry today is keyed by the rune's name and may carry `path`, `name`, `description`, `permissions`, `vars`, `batch` and `plugin`. `path` is optional: an entry without one resolves to `.crunes/runes/<key>.js`. Grants are scoped by mode — `permissions.run` covers `args`, `run` and `dispose`; `permissions.repl` covers the REPL functions — and `crunes repl` works for any rune whose module exports them. See [Rune](kb:crunes-main/concepts/rune.md).

Once a rune can be a Node, Python or bash script, the runtime has to come from somewhere, and the fallback no longer knows which extension to look for. Lifecycle handlers that are not the run handler — a schema built in the isolate in front of a bash script — need somewhere to be named, and grants need to sit with the code they constrain.

## Options considered

**1. Keep `path`, take the runtime from the extension.** The smallest break: only the `.js` → `.rune.js` rename. `path` would become the default handler for every lifecycle, with slot keys overriding it later. It keeps grants scoped by mode, so a script rune with a separately-built schema needs grants that belong to neither mode.

**2. Add an explicit `runtime` field.** Breaks nothing — an entry without `runtime` stays an isolate rune. But `.js` then means sandboxed or native depending on a field forever, so a file name stops telling a reviewer whether code is sandboxed, and every script entry states what it is twice.

**3. Lifecycle blocks replace `path`.** The largest break: the rename, `path` → a block, and grants moving into blocks. The entry then has its final shape, and a grant is always written beside the code it constrains.

## Decision

**Option 3**, with four refinements reached while designing it:

* **One field names every handler.** `command`, resolved as a shell resolves one — a path is a file, a bare name is a program on `PATH` — rather than separate fields for a file and a program. The name follows the `command` and fixed-arguments convention of MCP server configuration, VS Code tasks and Kubernetes. The fixed arguments are `argv` rather than that convention's `args`, because `args` is already the name of a lifecycle block in the same entry.
* **A block per lifecycle crunes executes in its own context.** Schema builders — `args`, `argsRepl`, `commandsRepl` — each run in an isolate of their own and share no state with anything, so each is a block. `dispose` shares the run context and the REPL functions share the session isolate, so they belong to the `run` and `repl` blocks.
* **Nothing is resolved by convention.** The fallback path and the implicit REPL are removed. A default between blocks is allowed only where it reads an export from a file the entry already names.
* **The isolate entry file is named `*.rune.js`**, so a file name says whether its code is sandboxed.

## Consequences

* Every existing entry and every plugin manifest is rewritten in one release. The old shape is refused with the rewrite printed rather than reinterpreted, `crunes doctor` lists what needs rewriting, and plugin manifests move to `"format": "2"`.
* Installed plugins keep their consent: consented permissions are stored as a flat list per rune, so only where grants are collected from changes.
* The fallback's removal is deliberate. It was the source of a rune resolving to a file nobody named, and an explicit `run` makes every runnable thing visible in the configuration a reviewer reads.
