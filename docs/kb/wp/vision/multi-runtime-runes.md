---
type: vision
title: Runes in any language
description: A rune becomes a project-local mini-program written in whatever language suits it, with crunes owning discovery, invocation and documentation rather than the runtime the program runs in.
tags: [vision, rune, runtime, proposal]
---

# Runes in any language

**Proposal.** This amends [Context runes](kb:crunes-main/vision/context-runes.md) and [Rune](kb:crunes-main/concepts/rune.md); neither is changed until it is accepted.

Today a rune is a JavaScript module run in a V8 isolate, and everything it does goes through `@utils`. That is a good home for small, portable logic and for code written by a stranger. It is a poor home for the work a project most wants to expose: the compiler that already understands the code, the Python tooling a data team already has, the shell script that already runs the deploy check. A library that needs Node built-ins or a native addon cannot be loaded in the isolate at all, and a rune that shells out to a real toolchain has already left the sandbox through its grant.

The position this proposal takes is that **what crunes owns is the rune, not the runtime.** A rune is a named, described, discoverable program that belongs to this repository. Crunes resolves its key, finds the interpreter it needs, invokes it the same way every time, and documents it through `crunes list` and `crunes docs rune`. What language the program is written in is the author's choice.

## What follows from that

**One review surface.** Every program a person or an agent may run in this project is an entry in configuration, reviewed in the same diff as any other change. An agent asks `crunes list` what exists instead of scanning `scripts/`, the `Makefile` and the READMEs and guessing what is safe to call.

**The ecosystems come back.** A Python rune imports whatever the project's virtualenv holds; a Node rune imports the TypeScript compiler. Crunes does not reimplement them behind `@utils`, and `@utils` stops having to grow to keep up.

**Trust follows the runtime, and is said out loud.** An isolate rune keeps its enforced grants. A script rune runs with the full access of the person who invoked it — the same trust a `package.json` script or a `Makefile` target already has — and crunes labels it as such rather than implying a sandbox it does not provide. A plugin may ship one too, but installing the plugin does not make it runnable: the user reviews the script and trusts it, and that trust lapses when the script changes. This replaces "there is no privileged tier" in [Rune](kb:crunes-main/concepts/rune.md) with two tiers that are named.

**Adoption starts from what exists.** A team registers the scripts it already has. Nothing has to be rewritten against a crunes API before it is useful.

## Lifecycles as slots

A rune today has lifecycles — `args`, `run`, `dispose`, and the REPL family — declared as exports of one module. The longer-term shape is that each lifecycle is a slot with a data contract, and a slot can be served by static data or by a handler in any runtime: a static argument schema in front of a Python `run`, a dynamic schema built in the isolate in front of a bash script. The contract each slot owes is defined by data, not by a language.

The first cut takes one step toward it. [Rune configuration v2](/specs/rune-config-v2.md) gives every lifecycle crunes executes in its own context a block of its own, and the [script rune contract](/specs/script-rune-contract.md) lets a script serve `run` behind a schema built in the isolate. Every other slot stays isolate-only, and the contract is shaped so that each one opened to scripts later is additive: a script written against it keeps working unchanged.

## Direct when alone, framed when shared

A rune run alone should reach its caller the way a command does. Today it cannot: every invocation is run as a batch of one, so a single rune's output is framed, its logs share standard output with its result, and its exit status can only say pass or fail. That shape is what a batch needs and what nothing else does.

[Single invocations are direct](/decisions/direct-single-invocation.md) keeps the framing where several streams share one channel — batches, JSONL, jobs — and drops it everywhere else. For a script rune the result is that crunes disappears at run time: the script owns the terminal, pipes as it always did, prompts if it needs to, and returns its own exit code. Everything crunes contributes — the name in `crunes list`, the page in `crunes docs rune`, the parsed schema — happens before the script starts.

It enriches the isolate side as much. A single isolate rune's output becomes plain markdown on standard output, with its diagnostics on standard error: the shape an agent reads cheapest and a pipeline expects. And because JSONL is untouched, a program that wants structure asks for it explicitly, instead of every caller paying for structure it never parses.

## What it refuses

**It does not port `@utils` to other languages.** A shim per language is the same maintenance burden this proposal exists to escape, multiplied. The contract with a script is environment variables in and standard output back.

**It does not grow the configuration into a language.** Configuration declares; handlers compute. A rune that needs a conditional is a script, and the project already has real languages for that.

**It does not let plugins ship native code in the first cut.** Installing a plugin whose runes run natively is running a stranger's program with full access; that needs a consent model of its own before it is allowed.

**It is still not a general task runner.** Crunes gains nothing over `just` or `mise` by running scripts. What earns a rune its entry is what crunes adds around it — discovery, documentation, a single invocation surface for people, agents and CI.

## Wrapping a command

[Context runes](kb:crunes-main/vision/context-runes.md) says that *a rune that only wraps a shell command it could have called directly has earned nothing*, and that what justifies a rune is reading project state and shaping it. [Rune configuration v2](/specs/rune-config-v2.md) lets a `run` block name a program on `PATH` with fixed arguments — which, taken alone, is exactly a rune that wraps a command.

**The principle stands, and it is the reason such an entry earns its place.** A rune over a command is justified by what crunes adds on top of it: an argument schema that reshapes a program's full, sprawling command line into the few options a task actually needs, documentation that `crunes docs rune` renders from that schema, and fixed arguments that settle everything the caller should not have to choose. What reaches an agent is a thin surface built for the task rather than the whole program. The shaping the main vision asks for is applied to the command's interface instead of to project state.

An entry that names a program and adds nothing to it is still the rune that earned nothing, and the skills should teach it as such.

**A surface is only thin if what is not on it cannot reach the program**, and a reshaped option only works if crunes can rewrite it into the program's own. Both are built as mapped arguments in the [script rune contract](/specs/script-rune-contract.md): with `run.pass: "mapped"`, a call outside the schema is refused, and each declared argument becomes the program tokens its `to` names. Raw pass-through stays the default, because a script that reads its own arguments needs no rewriting.

## What accepting it changes

Written out so that nothing is left describing the old model. Documents are named, not linked by path, where they live in another repository.

**`crunes-main`**

* *Rune* — a rune is no longer only a JavaScript module; the "two lifecycles" section and "there is no privileged tier" are both replaced.
* *Permission* — grants move from mode-scoped blocks into configuration blocks.
* *Plugin* — manifests move to format 2, and a plugin rune's `run` block may name a script, runnable only once trusted in its current form.
* *Terms* — "Lifecycle" changes meaning, and the terms in this bundle's [glossary](/glossary/terms.md) are added.
* *Context runes* — "not a general task runner" gains the reading above: a rune over a command earns its entry by reshaping the command's interface.
* *Knowledge base layout* — nothing, once it admits a work-proposals bundle.

**`crunes-cli-main`**

* *crunes run* and *crunes repl* flows — the run path splits as in [the proposed flow](/flows/run.md), and a single invocation's output is direct as in [Invocation output](/specs/invocation-output.md); a REPL exists only when declared.
* *shared* module — its account of the two section renderers changes, since a single invocation no longer uses the prefixed form.
* *crunes template apply* flow, and the *template* module — both write rune entries, and templates share the entry's shape.
* *rune*, *core*, *plugin* and *docs* modules — resolution, config loading and per-block merging, the manifest format, and how native runes are documented.
* *The isolate boundary* pattern — it describes the only tier there is today; it becomes one of two.

**`crunes-plugins`** — every plugin manifest is rewritten to format 2 and every plugin rune entry file renamed to `*.rune.js`.

**`crunes-skills`** — all four skills describe runes as isolate JavaScript and grants by mode, and the main skill's advice on reading output assumes the framed form. Their governing rule — state no API surface — means the change is in what they teach, not in any list they carry.

**`examples/`** — every example rune is renamed and every example configuration rewritten; a script rune example is added.
