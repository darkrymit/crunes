---
type: flow
title: crunes run under configuration v2
description: The proposed path of one crunes run invocation from key to output once the run block may name a script — where the entry's blocks are read, where the schema is built and validated, and where the path splits between the isolate and a native process.
tags: [flow, run, proposal, mvp0]
---

# `crunes run` under configuration v2

**Proposal, MVP0.** The sequence implied by [Rune configuration v2](/specs/rune-config-v2.md) and the [script rune contract](/specs/script-rune-contract.md); where it and they disagree, they win. It changes the middle of today's path, described in [`crunes run`](kb:crunes-cli-main/flows/run.md) — flag parsing, batch splitting, key resolution and output rendering are untouched.

```mermaid
flowchart TD
    resolve_key([resolved rune entry]) --> read_blocks[read the run and args blocks]
    read_blocks --> classify_run{run.command}
    classify_run -->|bare name| program[program on PATH]
    classify_run -->|path| runtime_by_name[runtime from the file name]
    runtime_by_name --> rename_guard{plain .js importing @utils?}
    rename_guard -->|yes| refuse([refuse with the rename])
    rename_guard -->|no| schema_source
    program --> schema_source{schema source}
    schema_source -->|args block, or an isolate run module's export| build_schema[build the schema in its own isolate<br/>or read it from the cache]
    schema_source -->|none| pass_through[pass arguments through unparsed]
    build_schema --> validate[validate the call<br/>answer --help and errors here]
    validate --> dispatch{run runtime}
    pass_through --> dispatch
    dispatch -->|isolate| isolate_run[today's isolate path]
    dispatch -->|native| find_interpreter[find the interpreter]
    find_interpreter --> spawn[spawn with command, argv, caller arguments<br/>and the CRUNES_ variables]
    spawn --> collect[standard output is the result<br/>exit code is crunes's exit code]
    isolate_run --> render([render as today])
    collect --> render
```

## 1. The entry is read, not searched

The resolved entry must have a `run` block. Nothing is looked up by convention: an entry without one is a configuration error raised at load, before this flow starts.

## 2. The runtime is known before anything runs

`run.command` is classified once. A bare name is a program on `PATH`. A path is a file, and its name selects the runtime. A plain `.js` or `.mjs` file that imports `@utils` stops here, with the rename that fixes it — the one point in the flow where the file's content is read to decide anything, and it only refuses.

## 3. The schema is settled before the handler is touched

The schema comes from the `args` block if there is one, or from the `args` export of an isolate `run` module if there is not. Either way it is built in an isolate of its own under the grants the configuration spec assigns, and cached unless the module opts out.

With a schema, the call is validated here. `--help` and invalid arguments are answered by crunes; no script is spawned for them. Without one, arguments pass through unparsed, `--help` included.

## 4. The path splits once

An isolate `run` module continues down today's path unchanged: a fresh isolate, the utils bridge, `run`, then `dispose`.

A native handler has its interpreter found — or none needed for a program — and is spawned from the project root with `command`, then `argv`, then the caller's arguments, and the environment the contract lists.

## 5. The two paths rejoin at rendering

A script's standard output is its result, handled as a string returned from an isolate `run` is handled, and its exit code becomes crunes's. From there both paths reach the same renderer, which is why `--format jsonl`, `rune.exec`, batching and section filters need no knowledge of which path produced the result.
