---
type: glossary
title: Terms
description: Quick definitions of the vocabulary every repository in the project uses, each linking to the document that owns the term.
tags: [glossary, vocabulary]
---

# Terms

**Rune** — a JavaScript module declaring a command line, run in a sandbox, returning sections. See [Rune](/concepts/rune.md).

**Section** — the named, typed container a rune returns instead of printing. See [Section](/concepts/section.md).

**Permission** — a capability token plus a scope, granted in configuration per lifecycle. See [Permission](/concepts/permission.md).

**Plugin** — a distributable bundle of runes, installed per machine and enabled per project. See [Plugin](/concepts/plugin.md).

**Marketplace** — a named source publishing an index of installable plugins. See [Marketplace](/concepts/marketplace.md).

**Rune key** — how a rune is named on the command line. Bare (`api`) for a project or global rune, qualified (`marketplace@plugin:rune`) for one inside a plugin.

**Lifecycle** — which entry point is being invoked, `run` for a single call or `repl` for a session. Permissions are granted per lifecycle and neither inherits from the other.

**Store** — the machine-wide directory, `~/.crunes/` or `$CRUNES_STORE`, holding the global config, installed plugins, marketplace caches, jobs, and cache and sqlite data.

**Rootless** — running in a directory that is not a project. Local state redirects into the store and nothing is written beside the working directory.

**Isolate** — the V8 sandbox a rune runs in. Fresh per invocation, no Node built-ins, every capability injected as a host reference.

**Utils bridge** — the `@utils` object inside the isolate. Each namespace is a set of host functions injected as references, because a callback cannot be serialised across the isolate boundary.

**Job** — a process a rune spawned that outlives the invocation, tracked by the CLI as one file per job.

**Bundle** — a knowledge base directory under `docs/kb/<dir>/` obeying [the layout spec](/specs/knowledge-base.md), identified by a qualified `kb:` name rather than its directory.
