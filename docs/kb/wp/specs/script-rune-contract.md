---
type: spec
title: Script rune contract
description: The MVP0 contract between crunes and a Node, Python or bash script registered as a rune — how the interpreter is found, what the script receives and what crunes does with what it returns.
tags: [spec, rune, runtime, proposal, mvp0]
---

# Script rune contract

**Proposal, MVP0.** Written from [Runes in any language](/vision/multi-runtime-runes.md). How an entry names its script, and which file names select which runtime, is [Rune configuration v2](/specs/rune-config-v2.md). The order in which the pieces below happen is [`crunes run` under configuration v2](/flows/run.md).

**Prototype:** [darkrymit/crunes-cli#6](https://github.com/darkrymit/crunes-cli/pull/6) implements this contract as a draft, and is what the behaviour below was checked against on Linux. [darkrymit/crunes-cli#10](https://github.com/darkrymit/crunes-cli/pull/10) (MVP0.1) builds on it with JSON argument schemas, validation, `CRUNES_VARS`, structured output and `crunes create --lang`; the sections below marked **MVP0.1** describe that branch.

MVP0 is one feature: **a Node, Python or bash script, or a program on `PATH`, can serve a rune's `run` lifecycle**, optionally behind an argument schema built by an isolate module in the rune's `args` block. Every other lifecycle stays isolate-only.

## 1. Finding the interpreter

The author names the file; crunes finds what runs it.

* **Node** — the Node binary crunes itself is running on. There is nothing to find.
* **Python** — the first that exists: `CRUNES_PYTHON`; the active `VIRTUAL_ENV`; a `.venv/` or `venv/` at the project root; `python3`; `python`; `py -3` on Windows. Resolving a project virtualenv without being told is what lets a Python rune import the project's own packages.
* **bash** — the resolution `shell.exec` already uses, including `CRUNES_BASH` and Git Bash on Windows.
* **A program, or a file with no known extension** — executed directly; there is no interpreter to find.

When nothing is found, the error names every candidate tried and the variable that overrides the search. The resolved interpreter is cached per project and shown wherever a rune is described: `crunes list` names each script rune's runtime, `crunes docs rune` names the interpreter that will run it, and `crunes doctor` reports it for every script rune — so a rune that runs differently on two machines says so where people already look.

## 2. Arguments

* **Without an argument schema**, crunes does not parse the caller's arguments. Everything after the rune key is passed on unchanged, `--help` included.
* **With a schema** from the rune's `args` block, crunes parses the call against it before anything is spawned and answers `--help` itself, so `crunes docs rune` documents the rune and `--help` never reaches the script. This is new for script runes: an isolate rune today receives `help: true` among its arguments and renders its own help with `rune.helpSection`, which a script has no way to call. The script then receives both the raw arguments and the parsed result.

**Parsing is not validation** in MVP0: a missing required positional, a value of the wrong kind and an option the schema does not declare all reach the handler.

**MVP0.1 validates what a schema declares, for script runes.** A `<name>` positional is required; an option may declare `required` and `default`; positionals and options may declare `choices`. Every problem is reported together, with the `--help` command to run, and nothing is spawned. Value kinds and undeclared options are still not checked.

**MVP0.1 schemas need no JavaScript.** The `args` block may be the schema itself, written inline as JSON, or its `command` may name a `.json` file. The shape is the one an `args(builder)` module produces — `positionals`, `options`, `examples`, `commands` — and an unknown field is refused with its path, so a typo such as `defualt` fails at load rather than being ignored. Publishing this shape is what makes it a contract: it is the format a script printing its own schema would also use.

The process is invoked as the `command`, then the entry's `argv`, then the caller's arguments. `crunes run deploy staging --dry-run` against `{ "command": "scripts/deploy.sh", "argv": ["--region", "eu"] }` runs the script with `--region eu staging --dry-run`.

**A schema built from project state goes stale.** The schema cache is keyed on the schema module's content and the rune's `vars`, so choices read from the filesystem are frozen until the module changes. A schema module opts out with `export const cache = false`.

## 3. What the script receives

* **Working directory** — the project root.
* **Environment** — the caller's environment, plus:

| Variable | Value |
|---|---|
| `CRUNES_PROJECT_ROOT` | Absolute path of the project root |
| `CRUNES_RUNE_KEY` | The key the rune was invoked by |
| `CRUNES_LIFECYCLE` | `run` |
| `CRUNES_ARGS` | The parsed arguments as JSON — only when the rune has a schema |
| `CRUNES_VARS` | The entry's `vars` as a JSON object, `{}` when it has none — **MVP0.1** |

  The caller's environment may already hold other `CRUNES_` variables — `CRUNES_BASH` or `CRUNES_NO_GLOBAL` set by the user, `CRUNES_NO_TIMEOUT` set by crunes on a process it spawns for `rune.exec`. They pass through unchanged and are not part of this contract.

* **Standard streams** — in a single invocation, the caller's own: standard input, output and error are inherited, so `cat data.csv | crunes run import` works and a terminal stays a terminal. In a batch, JSONL, a job or `bench`, output is captured and standard input is closed. Which applies is [Invocation output](/specs/invocation-output.md).
* **Interrupts** — the script stops when the invocation is interrupted. See section 6 for why forwarding is not simply "send the signal on".

## 4. What crunes does with the result

What crunes does with a script's output depends on whether the invocation is direct or framed; [Invocation output](/specs/invocation-output.md) is the whole contract, and this is its summary for scripts.

* **Run alone, a script rune is not captured.** Its streams are the caller's and its exit code is crunes's exit code, unchanged. Crunes adds nothing to its output and takes nothing from it, so a script rune run alone behaves as its script does run by hand.
* **In a batch, JSONL, a job or `bench`, it is captured.** Standard output becomes the rune's result, handled as a string returned from an isolate `run` is handled; standard error passes through as diagnostics; a non-zero exit code makes the rune failed, with the code in the failure message.
* **MVP0.1: structured output is declared, never inferred.** With `"output": "sections"` in the `run` block, crunes reads standard output line by line. A line `{"section": {…}}` is a section, in the shape `--format jsonl` prints; a line `{"log": {"level", "message"}}` is a log line, written to standard error; any other line is plain text. Run alone, sections are rendered as markdown as they arrive, plain text prints in place, and `-s` filters sections. Framed, sections stream as section events and plain text is gathered into one `output` section after them. The exit code behaves as without the field.

## 5. Inside the rest of crunes

A script rune is reached through the same resolution as any other rune, so the commands built on that resolution apply to it unchanged:

* **`rune.exec` from another rune** spawns `crunes` as a child process and parses its JSONL output — a framed invocation, so the script is captured. The script's result arrives as that child's output, so an isolate rune can call a script rune — within its `rune.run:<key>` grant — without knowing what the script is written in.
* **Batch invocation** (`-b a + b`) resolves each segment separately, so script and isolate runes mix in one batch. `batch.allow` matches the rune's arguments as it does today.
* **Background jobs** (`rune.job.start`) run the rune in a detached `crunes` process and read its logged output, so a script rune can run as a job. A job started with `repl: true` needs a `repl` block, which a script rune may only have as an isolate module.

## 6. Interaction with how crunes runs itself

These follow from existing behaviour and bind the implementation; they are not choices.

* **A script rune is crunes's child process.** `crunes` 0.9 runs as a single process — the earlier re-spawn for `--no-node-snapshot` is no longer in the source, although `crunes-cli-main` still records it. Called through `rune.exec`, the script is a grandchild: the calling crunes, the child crunes, then the script.
* **An interrupt from a terminal reaches the whole foreground process group**, so the script usually receives it directly. Forwarding it again from crunes delivers it twice; forwarding exists for interrupts that did not come from a terminal, such as a parent process signalling crunes.
* **Crunes's exit status is pass or fail today.** It exits `1` when any rune in the invocation failed and `0` otherwise, because every invocation is run as a batch. A direct single invocation is what lets a script's own code through; a batch of several runes still has one status to report, so it keeps pass or fail.
* **A signal-killed child yields no exit code.** Whether that maps to `1` or to the shell convention of 128 plus the signal number is open — see below.

## 7. Trust

* A script rune runs with the full access of whoever invoked it. `crunes list` and `crunes docs rune` mark it as native and name its runtime or program.
* `run.permissions` on a script rune is a configuration error, so that nobody reads one as a sandbox. The isolate modules in its other blocks keep their own grants.
* Script runes may be declared in project and global configuration only. Every block of a plugin rune must be an isolate module.

## 8. The missed rename

Plain `.js` now means native Node, so an isolate module that keeps its old name would run with full access. **A plain `.js` or `.mjs` handler that imports `@utils` is refused**, with the rename that fixes it. Native Node can never import `@utils`, so a match is always a missed rename. This is a guard, not the rule that chooses a runtime; `crunes doctor` runs the same check over every layer.

## 9. What later lifecycles may rely on

These hold from MVP0 onward, so that every later addition is additive:

* **Raw arguments are always passed**, with or without a schema.
* **`CRUNES_LIFECYCLE` is always set.** A script is only ever invoked for a lifecycle whose block names it, so a script that ignores the variable never receives one it does not handle.
* **Plain standard output stays the default.** Structured output will be a mode the entry declares, never one inferred from content.
* **The variables in section 3 keep their names and meanings.** New ones are added beside them, never in their place. The `CRUNES_` prefix belongs to crunes as a whole, so a script should not define its own variables under it.

## 10. Not in MVP0

MVP0.1 builds three of these: argument schemas written statically in configuration (inline or a `.json` file), structured section output, and `crunes create --lang`. The rest stand.

`dispose` for scripts, and a per-invocation state directory for it. Argument schemas written statically in configuration or printed by a script, which need the schema format published as a contract first. REPL lifecycles for scripts. Mapping parsed arguments onto a program's `argv` — the step that lets a rune expose an option under a name the program does not use, and so the one the vision's reading of a rune over a command most depends on. Structured section output from scripts. Script runes in plugins. Declared interpreter versions. A `--lang` option on `crunes create`.

## Prerequisites

Existing behaviour that must change before MVP0 ships.

* **A plain string result is mishandled** — it renders as an `undefined` section in text mode and fails section filters ([darkrymit/crunes-cli#1](https://github.com/darkrymit/crunes-cli/issues/1), fixed by [darkrymit/crunes-cli#3](https://github.com/darkrymit/crunes-cli/pull/3), which names a string result `output`). A captured script's output goes down the same path, so it has to be merged first.

## Open questions

Each of these needs a decision before implementation; none is settled by anything above.

* **Streaming captured output.** Run alone, a script streams because nothing captures it. Captured — in a batch, JSONL or a job — its standard output is held until it exits, as a string returned from an isolate `run` is. Whether captured output should instead arrive as it is written, the way `section.emit` streams an isolate rune's sections, is open. Standard error passes through as it is written in every mode, which is where a long script's progress conventionally goes.
* **A timeout for scripts.** Isolate evaluation runs under a timeout; a build or a test suite routinely outlasts one. The choice is between no default timeout, the isolate's, or one the entry declares.
* **The exit status of a signal-killed script** — the shell convention of 128 plus the signal number, which passing a code through unchanged suggests, or crunes's existing mapping to `1`. See [Invocation output](/specs/invocation-output.md).
* **Bash on a Windows machine without it.** A `.sh` rune fails there with the interpreter error. Whether MVP0 should name PowerShell or `cmd` runtimes, or leave Windows users to install Git Bash, is open.

## Backlog

Accepted as needed, not scheduled for MVP0.

* **Argument validation for value kinds, and for isolate runes.** MVP0.1 enforces required arguments and allowed values for script runes. Value kinds are not checked, and the `args(builder)` API has no way to declare `required` or `choices`, so a builder schema gets only required positionals.
* **Refusing undeclared arguments.** Section 9 promises raw arguments are always passed. That is right for a script whose schema only documents it, and wrong for a rune whose schema is meant to be the whole surface of a program — see [Wrapping a command](/vision/multi-runtime-runes.md). An entry will need a way to ask for undeclared arguments to be refused, and section 9 will need to say what it then promises.
