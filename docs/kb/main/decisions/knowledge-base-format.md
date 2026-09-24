---
type: decision
title: OKF bundles, one per repository that has something to say
description: Knowledge is an Open Knowledge Format bundle per repository rather than one shared tree, because a repository's knowledge has to travel with the repository.
tags: [knowledge-base, okf, documentation]
---

# OKF bundles, one per repository that has something to say

Knowledge lives in OKF v0.2 bundles under `docs/kb/main/`, one in the umbrella and one in each published repository with knowledge of its own. The layout they obey is [the knowledge base layout spec](/specs/knowledge-base.md).

The decision has two halves: *why bundles at all*, and *why more than one*.

## Why bundles rather than a documentation tree

What came before was `docs/knowledge-base/`, a three-category tree — modules, flows, one architecture page — written for an agent to read before touching code. It was good material and it rotted, in the specific way ad-hoc trees rot: **nothing said where a new note went, so notes went wherever the last one had.**

A permission rule is a module note, an architecture principle and a gotcha at once, and with three categories it landed in whichever the author opened first. By the end, one module page was carrying a module's boundary, six decision records, a dozen traps and a rune-authoring tutorial. Finding the trap meant reading the tutorial.

OKF's contribution is not the folder names. It is that **the categories are defined by a question each answers, with a written rule for choosing when two both fit.** A note has one right home and the standard says how to find it, which is the difference between a layout and a convention.

The second contribution is the index contract: a bullet repeats its document's `description` byte for byte, so a summary cannot drift from the thing it summarises, and the drift is machine-checkable rather than a matter of noticing.

## Why one bundle per repository, not one shared tree

The repositories are separate git repositories mounted as ignored directories — see [the repository topology](/decisions/repo-topology.md). A single shared tree in the umbrella would mean **the knowledge about a repository's code lives where that repository's commits cannot reach it.** A change to the CLI's isolation boundary and the note describing it would be two commits in two repositories, one of which nobody checks out.

So a repository's knowledge lives in that repository, travels with it, and is edited in the same commit as the code it describes. The umbrella keeps what is true of no single repository: the model, the vocabulary, the contracts more than one repository implements.

**A repository with nothing of its own to say gets no bundle.** `crunes-skills` is four skill files whose whole contract is that they state no API surface — that is one decision, and it lives here rather than in a bundle that would otherwise hold a heading and a link.

## What it costs

**A cross-bundle link is a string nothing resolves.** `kb:crunes-cli-main/modules/rune.md` is checked by no tool, because the tool would have to resolve a path into a repository that may not be cloned. Links rot silently. The mitigation is a convention, not a mechanism: name bundles and documents, never paths.

**The split has to be re-decided per document.** "Is this true of the ecosystem or of this code" is a judgement, and a document that is half of each has to be split rather than filed under the larger half. The spec's section 6 states the rule; it does not remove the judgement.

**Two indexes can disagree about one document.** A module brief in the umbrella and the module page in the repository's bundle describe the same thing at two depths, and nothing compares them. The rule that a brief *points and does not restate* is what keeps this from being two copies, and it is enforced by nothing but review.
