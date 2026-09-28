---
okf_version: 0.2
kb_version: 0.1
kb: crunes-wp
---

# Crunes work proposals

Designs that are being worked out and are not yet true of any repository. Nothing here describes shipped behaviour: where a document here and [`crunes-main`](kb:crunes-main/index.md) disagree, the main bundle describes what exists and this one describes what is proposed.

Every document names the main-bundle documents it would change. When a proposal is accepted, its content is written into the bundle that owns it — the umbrella for the model and contracts, [`crunes-cli-main`](kb:crunes-cli-main/index.md) for implementation — and the document leaves this bundle.

## Vision

* [Runes in any language](/vision/multi-runtime-runes.md) - A rune becomes a project-local mini-program written in whatever language suits it, with crunes owning discovery, invocation and documentation rather than the runtime the program runs in.

## Specifications

* [Script rune contract](/specs/script-rune-contract.md) - The MVP0 contract between crunes and a Node, Python or bash script registered as a rune — how the runtime is chosen, how the interpreter is found, what the script receives and what crunes does with what it returns.

## Decisions

* [Shape of a rune entry](/decisions/rune-entry-shape.md) - Open: three ways a rune entry in configuration could name its file and runtime once runes are no longer JavaScript only, and what each costs now and when lifecycle slots arrive.
