---
type: glossary
title: Terms
description: Quick definitions of the vocabulary every repository in the project uses, each linking to the document that owns the term.
tags: [glossary, vocabulary]
---

# Terms

**Rune** — a declared, discoverable command declared with a `run` block — either an isolate module (`*.rune.js`) or a native script (`.sh`, `.py`, `.js`, program). See [Rune](/concepts/rune.md).

**Section** — the named, typed container a rune returns instead of printing. See [Section](/concepts/section.md).

**Direct invocation** — a single rune run in text format. Its output reaches the caller without framing: a script's streams and exit code are the caller's own, and an isolate rune prints markdown with its logs on standard error. See [Invocation output](/specs/invocation-output.md).

**Framed invocation** — a batch, `--format jsonl`, a child of `rune.exec` or a job, or `crunes bench`. Output is labelled with the rune and section it came from, because one stream carries more than one thing. See [Single invocations are direct](/decisions/direct-single-invocation.md).

**Script rune** — a rune whose `run.command` names a script or a program on PATH rather than an isolate module. Runs natively with caller access, validated against its argument schema. See [Script rune contract](/specs/script-rune-contract.md).

**Native trust** — explicit authorization recorded for a plugin rune that runs natively outside the sandbox. Granted via `crunes plugin trust` after reviewing the script. See [Plugin](/concepts/plugin.md).

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
