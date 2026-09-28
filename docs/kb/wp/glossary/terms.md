---
type: glossary
title: Terms
description: The vocabulary the work proposals introduce or change — modes, lifecycles, blocks, handlers and the two kinds of rune — each linking to the document that owns it, and marking where a word means something different in crunes-main.
tags: [glossary, proposal]
---

# Terms

Words that already mean something in [`crunes-main`](kb:crunes-main/glossary/terms.md) are marked where this bundle uses them differently. Until a proposal is accepted, the main bundle's meaning is the one that describes shipped behaviour.

**Isolate rune** — a rune whose `run` block names an isolate module. It runs in the V8 sandbox under enforced grants, as every rune does today. See [Runes in any language](/vision/multi-runtime-runes.md).

**Script rune** — a rune whose `run` block names a Node, Python or bash script, or a program on `PATH`. It runs with the invoking user's full access and is labelled native. See [Script rune contract](/specs/script-rune-contract.md).

**Native** — the label crunes shows for a script rune, saying that nothing about it is sandboxed.

**Isolate module** — a JavaScript file named `*.rune.js` or `*.rune.mjs`. The suffix is what selects the isolate; a plain `.js` file is native Node. See [Rune configuration v2](/specs/rune-config-v2.md).

**Mode** — `run` for a single call or `repl` for a session. *In `crunes-main` this is called a lifecycle*, and grants are scoped by it.

**Lifecycle** — one export crunes calls: `args`, `run`, `dispose`, `argsRepl`, `commandsRepl`, `repl`, `bannerRepl`, `inputRepl`, `completeInputRepl`, `disposeRepl`. *In `crunes-main` the word means a mode.*

**Block** — the unit of a rune entry that names a handler and its grants: `args`, `run`, `argsRepl`, `commandsRepl` or `repl`. One block per lifecycle crunes executes in its own context; lifecycles sharing state share a block. See [Rune configuration v2](/specs/rune-config-v2.md).

**Handler** — the file or program a block names, which serves that block's lifecycles.

**Schema block** — `args`, `argsRepl` or `commandsRepl`: a block whose handler only builds a schema, in an isolate of its own, and whose result is cached.

**`command`** — the field naming a block's handler. A value containing a path separator, beginning with `.`, or absolute is a file; a bare name is a program on `PATH`.

**`argv`** — arguments a `run` block always places before the caller's own.

**Runtime** — what executes a handler: the isolate, Node, Python, bash, or the operating system for a program or an unrecognised file. Chosen by the handler's file name, never declared separately.

**Missed-rename guard** — the refusal of a plain `.js` or `.mjs` handler that imports `@utils`, which catches an isolate module that was not renamed to `*.rune.js`. See [Script rune contract](/specs/script-rune-contract.md).
