---
tags:
  - completed
---

# Proposal: Separate Config Directory (`--ccd`)

## Overview

This proposal adds a `--ccd <path>` global flag. When set, crunes loads `.crunes/config.json` and resolves local rune files from `<path>` instead of `cwd`. The project directory — where `utils.fs` operates — remains controlled by the existing `--cwd` flag.

## Motivation

Teams running many projects often want a single shared repository of rune configurations rather than duplicating `.crunes/` setups per project. Currently this is impossible: `.crunes/config.json` is always loaded from `cwd`, so every project needs its own copy.

`--cfg` decouples where runes are defined from where they operate, enabling a monolithic rune repo usable across any number of projects:

```
~/company-runes/         ← config dir, checked into its own repo
  .crunes/
    config.json          ← plugins, rune aliases, vars
  runes/
    deploy.js
    scaffold.js

~/projects/my-app/       ← project dir (cwd)
```

```bash
cd ~/projects/my-app
crunes use deploy --ccd ~/company-runes
```

## Flags and env vars

| Flag | Default | Description |
|---|---|---|
| `--ccd <path>` | `cwd` | Config dir — where `.crunes/config.json` and local rune files live |
| `--cwd <path>` *(existing)* | `process.cwd()` | Project dir — where `utils.fs` operations are rooted |

Both resolve relative paths against `process.cwd()`.

## What changes per directory

| Concern | Resolved from |
|---|---|
| `.crunes/config.json` | `configDir` (`--cfg` / `CCD`) |
| Local rune files (`entry.path` in config) | `configDir` |
| `utils.fs` paths (read, write, glob, exists) | `projectDir` (`--cwd` / `CPD`) |
| Plugin files (installed globally in `~/.crunes/`) | unchanged — global store |
| `@plugin/` imports inside rune files | unchanged — resolved from plugin dir |

## Implementation Notes

**`cli/program.js`** — add `--ccd <path>` alongside `--cwd` in the global options; add a `configRoot()` helper mirroring the existing `projectRoot()` one; pass `configRoot()` to each command handler that calls `runRune`.

**`core/config.js`** — `loadConfig(dir)` already accepts any directory; no change needed.

**`rune/resolver.js`** — thread `configDir` through `runRune` as an optional parameter defaulting to `dir`. Change `join(dir, entry.path)` to `join(configDir, entry.path)`. Forward `configDir` in the recursive `runeCallback`.

**`rune/isolation/runner.js`** — `projectDir` passed to the isolate is unchanged; no changes needed.
