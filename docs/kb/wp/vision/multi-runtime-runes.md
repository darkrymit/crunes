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

**Trust follows the runtime, and is said out loud.** An isolate rune keeps its enforced grants, and remains the only kind a plugin may ship. A script rune runs with the full access of the person who invoked it — the same trust a `package.json` script or a `Makefile` target already has — and crunes labels it as such rather than implying a sandbox it does not provide. This replaces "there is no privileged tier" in [Rune](kb:crunes-main/concepts/rune.md) with two tiers that are named.

**Adoption starts from what exists.** A team registers the scripts it already has. Nothing has to be rewritten against a crunes API before it is useful.

## Lifecycles, later

A rune today has lifecycles — `args`, `run`, `dispose`, and the REPL family — declared as exports of one module. The longer-term shape is that each lifecycle is a slot with a data contract, and a slot can be served by static data or by a handler in any runtime: a static argument schema in front of a Python `run`, a dynamic schema built in the isolate in front of a bash script. The contract each slot owes is defined by data, not by a language.

The first cut takes one step toward it. [Rune configuration v2](/specs/rune-config-v2.md) gives every lifecycle crunes executes in its own context a block of its own, and the [script rune contract](/specs/script-rune-contract.md) lets a script serve `run` behind a schema built in the isolate. Every other slot stays isolate-only, and the contract is shaped so that each one opened to scripts later is additive: a script written against it keeps working unchanged.

## What it refuses

**It does not port `@utils` to other languages.** A shim per language is the same maintenance burden this proposal exists to escape, multiplied. The contract with a script is environment variables in and standard output back.

**It does not grow the configuration into a language.** Configuration declares; handlers compute. A rune that needs a conditional is a script, and the project already has real languages for that.

**It does not let plugins ship native code in the first cut.** Installing a plugin whose runes run natively is running a stranger's program with full access; that needs a consent model of its own before it is allowed.

**It is still not a general task runner.** Crunes gains nothing over `just` or `mise` by running scripts. What earns a rune its entry is what crunes adds around it — discovery, documentation, a single invocation surface for people, agents and CI.
