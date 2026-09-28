---
type: decision
title: Shape of a rune entry
description: Open: three ways a rune entry in configuration could name its file and runtime once runes are no longer JavaScript only, and what each costs now and when lifecycle slots arrive.
tags: [decision, config, rune, runtime, proposal, open]
---

# Shape of a rune entry

**Status: open.** Part of [Runes in any language](/vision/multi-runtime-runes.md). The [script rune contract](/specs/script-rune-contract.md) holds whichever shape is chosen.

## Context

A rune entry today is keyed by the rune's name and may carry `path`, `description`, `permissions`, `vars` and `batch`. **`path` is already optional**: an entry without one resolves to `.crunes/runes/<key>.js` (`resolveRuneFilePath` in the CLI's rune resolver). The configuration layers and their precedence are described in [Rune](kb:crunes-main/concepts/rune.md) and are not affected by this decision.

Two things break that entry once a rune can be a Node, Python or bash script. The runtime has to come from somewhere, and the fallback path no longer knows what extension to look for. A third pressure is further out: lifecycle slots — an `args` schema served separately from `run`, a `dispose` handler — will eventually want to be named in the entry, and the shape chosen now decides whether that is an addition or a second migration.

## Option 1 — `path`, runtime from the extension

```jsonc
"coverage": { "path": ".crunes/runes/coverage.py" },
"api":      { "path": ".crunes/runes/api.rune.js" },
"odd":      { "path": "tools/report", "runtime": "python" }   // extensionless: explicit override
```

The entry keeps today's shape. The runtime is read from the file name as the contract's table gives it, and `runtime` overrides it for a file whose name says nothing. Without `path`, crunes looks for `.crunes/runes/<key>` under each known extension and refuses when more than one exists.

* **Breaks:** only the `.js` → `.rune.js` rename.
* **When slots arrive:** `path` is defined as the rune's default handler for every lifecycle, and a slot key overrides one lifecycle. An isolate rune whose one module exports `args`, `run` and `dispose` stays a single `path`, which is exactly what it is.
* **Costs:** the runtime is implicit in a file name; the fallback probes several names instead of one.

## Option 2 — an explicit `runtime` field

```jsonc
"coverage": { "runtime": "python", "path": ".crunes/runes/coverage.py" },
"types":    { "runtime": "node" },                // → .crunes/runes/types.js
"api":      { "path": ".crunes/runes/api.js" }    // no runtime: isolate, as today
```

An entry without `runtime` is an isolate rune, so nothing existing changes and no file is renamed. The fallback path is exact, because the runtime names its extension.

* **Breaks:** nothing.
* **When slots arrive:** as in option 1 — `path` is the default handler, slots override it — but each slot handler in another runtime needs its own runtime named beside it.
* **Costs:** `.js` means isolate or Node depending on a field, permanently, so the file name no longer tells a reviewer whether code is sandboxed. A `.py` entry that forgets the field fails as an isolate load error rather than as a missing runtime, and needs a guard of its own. Every script entry states twice what it is.

## Option 3 — lifecycle slots replace `path`

```jsonc
"coverage": { "run": ".crunes/runes/coverage.py" },
"api":      { "run": ".crunes/runes/api.rune.js" }
// later: "args": { ...schema } | "<file>", "dispose": "<file>"
```

`path` is removed and each lifecycle names its handler. MVP0 supports `run` only; the runtime comes from the extension as in option 1.

* **Breaks:** the rename and the key change, in every entry, in one release.
* **When slots arrive:** nothing further to migrate — the entry already has the final shape.
* **Costs:** it designs the entry around lifecycles MVP0 does not have. An isolate rune reads oddly — `run` names a module that also provides `args` and `dispose` — and needs a rule that its exports fill the unnamed slots.

## Comparison

| | 1 — `path` + extension | 2 — `runtime` field | 3 — slots |
|---|---|---|---|
| Breaking in MVP0 | rename | none | rename and key |
| Sandboxed code visible from the file name | yes | no | yes |
| Fallback path | probes each extension | exact | probes each extension |
| Migration when slots arrive | none — slots are added | none — slots are added | none |
| Designs ahead of MVP0 | no | no | yes |

## Leaning

**Option 1.** It is the smallest change that keeps the file name honest about trust, and it does not force a second migration: defining `path` as the default handler makes slots an addition, and it describes the isolate rune — one module, several lifecycles — more truthfully than option 3 does. Option 2 is the choice if the rename proves too costly for existing users; option 3 buys nothing option 1 does not, at the price of a larger break.
