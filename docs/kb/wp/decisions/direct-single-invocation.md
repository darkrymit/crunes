---
type: decision
title: Single invocations are direct
description: A single rune invoked in text mode reaches the caller directly — results on standard output, diagnostics on standard error, a script's own streams and exit code — and the framing that keeps several streams apart is kept for batches, JSONL and the paths that capture output.
tags: [decision, output, run, script, proposal]
---

# Single invocations are direct

**Status: proposed, direction agreed.** Part of [Runes in any language](/vision/multi-runtime-runes.md). The contract that results is [Invocation output](/specs/invocation-output.md).

## Context

`crunes run` treats every invocation as a batch of one. Without `-b`, the command still builds a list of segments and runs the single rune through the batch loop. Every consequence of that loop is paid on every call:

* **Every line is framed.** Text output carries an `[instance:key:type]` prefix — `[1:t:section] report` — whose instance number means nothing when there is one rune. `renderSection` already produces a clean markdown heading for each section; `crunes run` discards it and writes the prefix in its place.
* **Results and diagnostics share one channel.** A rune's `console.log`, and its `console.error` too, are written to standard output with a prefix (`[1:t:log:error] …`). Nothing a rune does reaches standard error. The prefix is the only thing keeping a log line apart from a result, so the framing cannot be dropped while both use one channel.
* **Exit status is pass or fail.** A failure is caught so the loop can carry on to the next segment, and the command exits `1` at the end if anything failed. One status for any number of runes can say nothing else.
* **Everything must have a name.** Framing and section filters address output by section name, so a plain string result — which has none — renders as `undefined` and breaks filters ([darkrymit/crunes-cli#1](https://github.com/darkrymit/crunes-cli/issues/1)).

For an isolate rune this is tolerable. For a script it is fatal to the idea: a script run through crunes could not pipe its output unchanged, could not use the terminal, could not prompt, and could not report its own exit code. Each of the script contract's open questions about output and exit status traced back to this one shape.

**The runner already has the other half.** When it is called without an event handler — as `crunes bench` calls it — a rune's `console` output goes to standard error. Only `crunes run` opts into routing it through the framed standard output.

## What framing is for

Framing is needed exactly when one stream carries more than one thing a reader must tell apart:

* **A batch**, where several runes share standard output.
* **JSONL**, which a program reads and which is the wire format `rune.exec` uses between a calling rune and the `crunes` process it starts.
* **Background jobs**, whose output is written to a log and parsed back into sections later.
* **`crunes bench`**, which runs a rune to time it and has no use for its output.

A single rune invoked in text mode — by a person, by an agent, in a pipeline — is none of these.

## Options considered

**1. Keep framing everywhere.** Nothing changes. Script runes would have to be captured, framed and given a pass-or-fail status, and every question about pipes, terminals, prompts and exit codes would need its own workaround.

**2. Add a flag that turns framing off.** A `--raw` option on `crunes run`. It keeps today's output as the default and makes direct output something every caller has to know to ask for. An agent following the skills would get framed output unless the skills taught the flag, and a script rune would still behave unlike its script by default.

**3. Frame only when the invocation needs it.** Crunes chooses from the shape of the invocation: a single rune in text mode is direct, a batch or a machine format is framed. No flag, and no choice for the rune to make.

## Decision

**Option 3.** Direct output is what a single invocation means, so it is the default rather than an opt-in; framing remains exactly where a reader would otherwise be unable to tell streams apart.

* **Results go to standard output; diagnostics go to standard error** — in every text mode, batch included. This is the separation the framing was standing in for.
* **A single script rune is given the caller's streams.** Crunes does not capture it at all: its output, its terminal, its prompts and its exit code are the caller's, exactly as if the script had been run by hand.
* **A single isolate rune prints its sections as markdown**, as `renderSection` already produces them, without the prefix.
* **Batches, JSONL, jobs and `bench` are unchanged in kind**: they capture and frame, and a script's output in them is a captured result.

## Consequences

* **A script rune behaves like its script when run alone.** That is what makes [wrapping a command](/vision/multi-runtime-runes.md) honest: crunes adds discovery, documentation and an argument schema around the program and changes nothing about how it runs. The script contract's questions about streaming, terminals and passing an exit code through are answered for the single case, and remain only for captured modes, where crunes already has a defined format.
* **Text output for a single rune changes.** Anything that parses the `[1:key:section]` prefix from a single invocation breaks; a consumer that needs a stable, parseable shape uses `--format jsonl`, which does not change. The `crunes-cli-main` flow for `crunes run` and the `shared` module's account of the two renderers describe the old behaviour and change with it.
* **Log output moves to standard error for isolate runes.** A rune that relied on its `console.log` lines appearing in captured standard output loses them there; in JSONL they remain events in the stream.
* **A section filter has nothing to select from a script it does not capture**, so a filter on a single script rune is refused rather than silently ignored.
* **The batch exit status stays pass or fail.** Several runes still have one status to report; only a single invocation can return a rune's own.
