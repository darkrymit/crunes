---
type: spec
title: Invocation output
description: Where each stream of a crunes run invocation goes — standard output, standard error, standard input and the exit status — for isolate and script runes, in a direct single invocation and in the framed modes that batches, JSONL, jobs and bench use.
tags: [spec, output, run, script, proposal, mvp0]
---

# Invocation output

**Proposal, MVP0.** The contract that follows from [Single invocations are direct](/decisions/direct-single-invocation.md). It replaces the output half of [`crunes run`](kb:crunes-cli-main/flows/run.md) and is what the [script rune contract](/specs/script-rune-contract.md) relies on for everything a script produces.

**Prototype:** [darkrymit/crunes-cli#6](https://github.com/darkrymit/crunes-cli/pull/6) implements the script rune half of this contract — direct and captured — as a draft. The isolate half, and diagnostics moving to standard error, are not built: they change every existing rune's output and come as their own change.

**Framed output does not survive a reader that leaves early** today: piping `crunes run` into `head` crashes with an `EPIPE` stack trace ([darkrymit/crunes-cli#5](https://github.com/darkrymit/crunes-cli/issues/5)). A direct script rune is unaffected, because crunes writes nothing of its own to standard output.

## 1. Two modes, chosen by crunes

An invocation is either **direct** or **framed**. Crunes decides which from the shape of the invocation; neither the caller nor the rune selects it.

| Invocation | Mode |
|---|---|
| `crunes run <key>` — one rune, text format | direct |
| `crunes run -b …` — a batch, even of one segment | framed |
| `crunes run --format jsonl …` | framed |
| A rune started by `rune.exec` or `rune.job.start` — a child `crunes run --format jsonl` | framed |
| A rune run by `crunes bench` | framed, output discarded |

A batch of one segment is framed because `-b` is a request to treat output as one of several streams; the caller who writes it is preparing to add more.

## 2. Direct mode

### Isolate rune

| Stream | Behaviour |
|---|---|
| Standard output | The rune's sections, each rendered as markdown — its name or title as a heading, then its content — separated by a blank line. No prefix. Sections stream as the rune emits them, as they do today. |
| Standard error | The rune's `console` output and logger lines, unprefixed or with the level only. Crunes's own errors and permission hints, as today. |
| Standard input | Not read. |
| Exit status | `0` when `run` resolves, `1` when it throws. |
| Section filter (`-s`) | Applies, as today. |

### Script rune

| Stream | Behaviour |
|---|---|
| Standard output, standard error, standard input | **The caller's own.** Crunes spawns the script with its streams inherited and reads none of them. A terminal stays a terminal, so colour, progress, pagers and prompts behave as they do when the script is run by hand. |
| Exit status | **The script's exit code**, passed through unchanged. |
| Section filter (`-s`) | **Refused.** Crunes captures nothing, so there is nothing to filter. |

Crunes writes nothing to standard output in direct mode for a script rune. Its own errors — an unknown key, a missing interpreter, the missed-rename guard, an argument the schema parser rejects — go to standard error before the script is spawned, and the exit status is `1`.

## 3. Framed mode

Framed mode keeps today's shape for everything a reader needs to tell apart, with one change: in text format, diagnostics move to standard error.

| Stream | Text format | JSONL |
|---|---|---|
| Standard output | Each result section prefixed `[instance:key:section] name`, as today | One JSON event per line, as today: sections, and log events |
| Standard error | Log lines, prefixed `[instance:key:log:level]`; crunes's own errors | Crunes's own errors |
| Exit status | `1` if any rune failed, otherwise `0` | Same |

**A script rune in framed mode is captured.** Its standard output becomes its result, handled as a string returned from an isolate `run` — which requires [darkrymit/crunes-cli#1](https://github.com/darkrymit/crunes-cli/issues/1) fixed — and its standard error is passed through as diagnostics. A non-zero exit code makes the rune failed, with its code reported in the failure message.

**No rune in a batch reads standard input.** One input stream cannot be shared meaningfully between several runes, and the first to read it would consume what a later one expected. A script rune in a batch starts with standard input closed. `rune.exec` keeps its own `stdin` option, which writes to the child it starts.

## 4. What does not change

* **JSONL is unchanged** as a format. It remains the stable shape for any consumer that parses crunes's output, and the wire format of `rune.exec`.
* **The REPL is unchanged.** It is isolate-only and has its own input and output protocol.
* **Batch syntax, the `batch.allow` rule, and the order segments run in** are unchanged.

## 5. Choosing direct output in a skill or a script

A consumer that wants output it can parse should ask for it: `--format jsonl` is stable in both single and batch invocations. Text output is for reading — by a person or an agent — and in direct mode it is whatever the rune printed.

## Open questions

* **The heading on a single-section rune.** Direct mode prints each section's name as a markdown heading. For a rune that returns exactly one section, the heading may be noise; omitting it in that case makes output depend on the number of sections.
* **An exit status for isolate runes.** A script's code passes through; an isolate rune can only resolve or throw. Whether `run` gains a way to report a code — so an isolate rune over a check can return "found nothing" as distinct from failure — is open.
* **The status of a signal-killed script** in direct mode: the shell convention of 128 plus the signal number, or `1`. Passing the code through unchanged suggests the shell convention.
* **Log levels on standard error in direct mode** — unprefixed, or prefixed with the level so `console.error` remains distinguishable from `console.log`.
