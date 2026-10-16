---
type: spec
title: Script rune contract
description: The MVP0 contract between crunes and a Node, Python or bash script registered as a rune — how the interpreter is found, what the script receives and what crunes does with what it returns.
tags: [spec, rune, runtime, proposal, mvp0]
---

# Script rune contract

**Proposal, MVP0.** Written from [Runes in any language](/vision/multi-runtime-runes.md). How an entry names its script, and which file names select which runtime, is [Rune configuration v2](/specs/rune-config-v2.md). The order in which the pieces below happen is [`crunes run` under configuration v2](/flows/run.md).

**Built:** [darkrymit/crunes-cli#6](https://github.com/darkrymit/crunes-cli/pull/6) implements this contract, and is what the behaviour below was checked against on Linux, with the test suite also run on Windows. It grew past the first cut: JSON argument schemas with validation and value types, `CRUNES_VARS`, structured output, mapped arguments, timeouts, `crunes create --lang`, and script runes in plugins behind explicit trust are all part of it.

MVP0 is one feature: **a Node, Python or bash script, or a program on `PATH`, can serve a rune's `run` lifecycle**, optionally behind an argument schema — written as JSON, or built by an isolate module — in the rune's `args` block. Every other lifecycle stays isolate-only.

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

**Crunes validates what a schema declares, for script runes.** A `<name>` positional is required; an option may declare `required` and `default`; positionals and options may declare `choices` and a `type` — `string`, `number` or `integer`. A value is a string unless its type says otherwise, so `1.10` and `007` reach the script as typed. Every problem is reported together, with the `--help` command to run, and nothing is spawned. An option the schema does not declare still reaches the script, unless the entry maps its arguments (2.1).

**A schema needs no JavaScript.** The `args` block may be the schema itself, written inline as JSON, or its `command` may name a `.json` file. The shape is the one an `args(builder)` module produces — `positionals`, `options`, `examples`, `commands` — and an unknown field is refused with its path, so a typo such as `defualt` fails at load rather than being ignored. Publishing this shape is what makes it a contract: it is the format a script printing its own schema would also use.

### 2.1 Mapped arguments

**With `run.pass: "mapped"`, the schema is the rune's whole surface.** A call using an option or argument the schema does not declare is refused before the program starts, and the parsed call is rewritten into the program's own arguments instead of being passed raw. Each positional, option or command may declare `to` — the program tokens it becomes, with `{value}` standing for its value:

```json
"run":  { "command": "git", "argv": ["log", "--oneline"], "pass": "mapped" },
"args": { "options": [{ "flags": "--limit <n>", "type": "integer", "default": 5, "to": "-n{value}" }] }
```

Without `to`, an option is passed as its own flag and a positional as its value. The program receives `argv`, then the matched command path, then the options in declaration order, then the positionals. A boolean is passed only when true. This is what lets a rune expose an option under a name the program does not use — the reading of [wrapping a command](/vision/multi-runtime-runes.md) that needs it.

### 2.2 Order

The process is invoked as the `command`, then the entry's `argv`, then the caller's arguments — or, mapped, the arguments built from the schema. `crunes run deploy staging --dry-run` against `{ "command": "scripts/deploy.sh", "argv": ["--region", "eu"] }` runs the script with `--region eu staging --dry-run`.

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
| `CRUNES_VARS` | The entry's `vars` as a JSON object, `{}` when it has none |

  The caller's environment may already hold other `CRUNES_` variables — `CRUNES_BASH` or `CRUNES_NO_GLOBAL` set by the user, `CRUNES_NO_TIMEOUT` set by crunes on a process it spawns for `rune.exec`. They pass through unchanged and are not part of this contract.

* **Standard streams** — in a single invocation, the caller's own: standard input, output and error are inherited, so `cat data.csv | crunes run import` works and a terminal stays a terminal. In a batch, JSONL, a job or `bench`, output is captured and standard input is closed. Which applies is [Invocation output](/specs/invocation-output.md).
* **Interrupts** — the script stops when the invocation is interrupted. See section 6 for why forwarding is not simply "send the signal on".

## 4. What crunes does with the result

What crunes does with a script's output depends on whether the invocation is direct or framed; [Invocation output](/specs/invocation-output.md) is the whole contract, and this is its summary for scripts.

* **Run alone, a script rune is not captured.** Its streams are the caller's and its exit code is crunes's exit code, unchanged. Crunes adds nothing to its output and takes nothing from it, so a script rune run alone behaves as its script does run by hand.
* **In a batch, JSONL, a job or `bench`, it is captured.** Standard output becomes the rune's result, handled as a string returned from an isolate `run` is handled; standard error passes through as diagnostics; a non-zero exit code makes the rune failed, with the code in the failure message.
* **Structured output is declared, never inferred.** With `"output": "sections"` in the `run` block, crunes reads standard output line by line, and a line shaped like a `--format jsonl` event is that event: `{"type": "section", "section": {"name", "data"}}` is a section, `{"type": "log", "level", "message"}` a log line. Any other line is plain text. There is one wire shape, the one crunes already prints, so a script relaying another rune's JSONL passes it through unchanged. Run alone, sections are rendered as markdown as they arrive, log lines go to standard error, plain text prints in place, and `rune[-s name]` filters sections. Framed, sections and log lines stream as events, labelled like any rune's, and plain text is gathered into one `output` section after the sections. The exit code behaves as without the field.
* **A timeout is declared, never assumed.** `run.timeout` is a number of seconds. A script still running when it expires is sent SIGTERM, then SIGKILL five seconds later, together with the processes it started; run alone it ends with status 124, the convention of `timeout(1)`, and captured it fails the rune. A script has no timeout unless its entry declares one, because a build or a test suite routinely outlasts any default. On an isolate module, `run.timeout` replaces the default 30 seconds.

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
* **A signal-killed child yields no exit code.** Run alone, crunes reports the shell convention, 128 plus the signal number, so a caller sees what it would have seen running the script itself.

## 7. Trust

* A script rune runs with the full access of whoever invoked it. `crunes list` and `crunes docs rune` mark it as native and name its runtime or program.
* `run.permissions` on a script rune is a configuration error, so that nobody reads one as a sandbox. The isolate modules in its other blocks keep their own grants.
* **A plugin may ship script runes, and they run only once trusted.** A plugin rune's `run` block may name a script or a program, with the same fields a project script rune has. Installing the plugin does not make it runnable: it is refused until `crunes plugin trust <plugin> [rune]` has shown the user the command and the script itself and recorded their decision. Trust is pinned to a digest of the run block, the argument schema and the script's content, so an update that changes any of them is refused until trusted again. Every run of a plugin script says on standard error that it runs natively. The script receives `CRUNES_PLUGIN_ROOT`, and its relative paths resolve against the plugin root.

## 8. The missed rename

Plain `.js` now means native Node, so an isolate module that keeps its old name would run with full access. **A plain `.js` or `.mjs` handler that imports `@utils` is refused**, with the rename that fixes it. Native Node can never import `@utils`, so a match is always a missed rename. This is a guard, not the rule that chooses a runtime; `crunes doctor` runs the same check over every layer.

## 9. What later lifecycles may rely on

These hold from MVP0 onward, so that every later addition is additive:

* **Raw arguments are passed unless the entry asks for mapping.** With or without a schema, the caller's arguments reach the script as they were typed; only `run.pass: "mapped"` (2.1) changes that, and it is a choice the entry makes, never a default.
* **`CRUNES_LIFECYCLE` is always set.** A script is only ever invoked for a lifecycle whose block names it, so a script that ignores the variable never receives one it does not handle.
* **Plain standard output stays the default.** Structured output will be a mode the entry declares, never one inferred from content.
* **The variables in section 3 keep their names and meanings.** New ones are added beside them, never in their place. The `CRUNES_` prefix belongs to crunes as a whole, so a script should not define its own variables under it.

## 10. Not in MVP0

`dispose` for scripts, and a per-invocation state directory for it. Argument schemas printed by a script. REPL lifecycles for scripts. Declared interpreter versions. A PowerShell or `cmd` runtime: a `.sh` rune on Windows runs with Git Bash, found as `shell.exec` finds it, and that is the supported path.

## Open questions

Each of these needs a decision before implementation; none is settled by anything above.

* **Streaming captured output.** Run alone, a script streams because nothing captures it. Captured — in a batch, JSONL or a job — its standard output is held until it exits, as a string returned from an isolate `run` is. Whether captured output should instead arrive as it is written, the way `section.emit` streams an isolate rune's sections, is open. Standard error passes through as it is written in every mode, which is where a long script's progress conventionally goes. A script that declares `output: "sections"` already streams its sections and log lines as it prints them; the question remains for plain output.

Found by using MVP0 on the examples and on `crunes-cli` itself:

* **A section filter is easy to write wrongly.** `rune[-s name]` filters; `rune -s name` passes `-s` to the rune. A script rune without a schema accepts the second silently, so the mistake shows only as unfiltered output.
* **A batch needs a `batch` block on every rune in it.** That gate was written for isolate runes whose arguments may reach far; for a script rune with a mapped surface, the schema already says what may be called, and the second gate reads as friction.
* **`--help` does not show what a mapped rune runs.** The schema's options are listed, but not the program tokens each becomes, so a reader cannot tell from `--help` alone what `--limit 3` will do. `crunes docs rune` names the command and its fixed `argv`, not the mapping.
* **An inline schema bloats the shared config.** A wrapper with a few options doubles the size of its entry; a `.json` file beside the script reads better and diffs on its own.

## Backlog

Accepted as needed, not scheduled for MVP0.

* **Argument validation for isolate runes.** Script runes get required arguments, allowed values and value types enforced. The `args(builder)` API has no way to declare `required`, `choices` or `type`, so a builder schema gets only required positionals, and only when it fronts a script.
