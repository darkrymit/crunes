---
type: flow
title: crunes run
description: The execution path of one crunes run invocation from key to output — where the entry's blocks are read, where the schema is built and the call parsed, where the path splits between the isolate and a native process, and where a single invocation goes direct while a framed one is captured.
tags: [flow, run]
---

# `crunes run`

The sequence of a `crunes run` invocation across both isolate runes and script runes. Flag parsing, batch splitting and key resolution precede this path; how output reaches the caller is described in [Invocation output](/specs/invocation-output.md).

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
    build_schema --> parse_call[parse the call against the schema<br/>answer --help here]
    parse_call --> dispatch{run runtime}
    pass_through --> dispatch
    dispatch -->|isolate| isolate_run[today's isolate path]
    dispatch -->|native| find_interpreter[find the interpreter]
    find_interpreter --> invocation_mode{direct or framed?}
    invocation_mode -->|direct| spawn_inherit[spawn with the caller's streams<br/>command, argv, caller arguments, CRUNES_ variables]
    spawn_inherit --> pass_status([script's exit code is crunes's])
    invocation_mode -->|framed| spawn_capture[spawn capturing output<br/>standard input closed in a batch]
    spawn_capture --> captured_result[standard output is the result<br/>non-zero exit marks the rune failed]
    isolate_run --> isolate_output{direct or framed?}
    isolate_output -->|direct| print_markdown([sections as markdown on stdout<br/>logs on stderr])
    isolate_output -->|framed| render_framed([framed as today<br/>logs on stderr in text format])
    captured_result --> render_framed
```

## 1. The entry is read, not searched

The resolved entry must have a `run` block. Nothing is looked up by convention: an entry without one is a configuration error raised at load, before this flow starts.

## 2. The runtime is known before anything runs

`run.command` is classified once. A bare name is a program on `PATH`. A path is a file, and its name selects the runtime. A plain `.js` or `.mjs` file that imports `@utils` stops here, with the rename that fixes it — the one point in the flow where the file's content is read to decide anything, and it only refuses.

## 3. The schema is settled before the handler is touched

The schema comes from the `args` block if there is one, or from the `args` export of an isolate `run` module if there is not. Either way it is built in an isolate of its own under the grants the configuration spec assigns, and cached unless the module opts out.

With a schema, the call is parsed against it here and `--help` is answered by crunes; no script is spawned for it. Parsing enforces nothing — see the [script rune contract](/specs/script-rune-contract.md). Without a schema, arguments pass through unparsed, `--help` included.

## 4. The path splits twice

**By runtime.** An isolate `run` module continues down today's path: a fresh isolate, the utils bridge, `run`, then `dispose`. A native handler has its interpreter found — or none needed for a program — and is started from the project root with `command`, then `argv`, then the caller's arguments, and the environment the contract lists.

**By invocation.** A single rune in text format is direct; a batch, `--format jsonl`, a child started by `rune.exec` or a job, and `crunes bench` are framed. Crunes decides this from the invocation; the rune has no say. See [Single invocations are direct](/decisions/direct-single-invocation.md).

## 5. Direct: nothing in between

A direct script is spawned with the caller's standard input, output and error, and crunes reads none of them. When it exits, its code is crunes's. A direct isolate rune prints its sections as markdown on standard output as it emits or returns them, and its `console` output goes to standard error.

## 6. Framed: captured and labelled

A framed script is captured: its standard output becomes its result, handled as a string returned from an isolate `run`, and a non-zero exit marks it failed. From there it reaches the same framed renderer as an isolate rune, which is why JSONL, `rune.exec`, batches and section filters need no knowledge of which runtime produced the result.
