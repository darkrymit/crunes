---
type: vision
title: Context runes
description: A rune is a small project-local command that answers a question about the project right now, written once and called identically by a person, an agent and CI.
tags: [vision, rune, agent]
---

# Context runes

A rune is a JavaScript module in a project that answers a question about that project, or takes a structured action in it, at the moment it is asked. It declares its own command line, runs in a sandbox that grants it nothing it did not ask for, and returns sections rather than prose.

The problem it exists for is that **an agent's knowledge of a project is a snapshot, and a snapshot is wrong the moment the project moves.** A file listing pasted into a prompt described the tree at the time someone pasted it. A handbook committed to the repository described the architecture on the day it was written. Both keep being read long after they stopped being true, and neither announces that it has gone stale.

The alternative crunes takes is that **the project answers for itself, when asked.** Not a document about the endpoints, a command that enumerates the endpoints. Not a paragraph about which migrations are pending, a command that reads the migration table. The answer costs nothing until something needs it, and it cannot be out of date, because it did not exist until it was asked for.

## What follows from that

**One plane, not one integration.** The thing that reaches a rune is a CLI. A person types it, an agent shells out to it, CI runs it in a pipeline. There is no assistant-specific protocol in the middle, so a rune written for one caller already works for the others, and nothing has to be rewritten when the caller changes. A hook written against one vendor's extension point is worth nothing in a terminal or a build; this is the refusal that shapes the rest of the design.

**The logic lives in the project, versioned with the code it describes.** A rune that reads the router to list endpoints changes in the same commit as the router. That is the whole mechanism by which it stays true — not diligence, adjacency.

**Structured out, not prose out.** A rune returns sections, and a section declares its type. The caller decides how to render, filter or pipe it. A rune that returned a paragraph would have made that decision for every caller it will ever have.

**Capability is declared, never ambient.** A rune runs in a fresh V8 isolate with no access to the Node built-ins and no filesystem beyond what its configuration grants by pattern. This is not hardening added after the fact; it is what lets a project enable a plugin someone else wrote, because what that plugin may touch is written down, reviewable, and enforced rather than promised. See [the permission model](/concepts/permission.md).

## What it refuses

**It is not a prompt format.** Nothing about a rune assumes a language model is reading it. The same invocation in a shell pipeline is the same invocation, and that is the point: a thing that only made sense to one consumer would be a plugin for that consumer.

**It is not a replacement for skills, and does not compete with them.** A skill tells an agent *how to go about something*; a rune gives it *the current state of something*. The two compose, and this project ships both — see [the skills contract](/decisions/skills-state-no-api.md), which exists precisely so the two never drift into describing the same thing.

**It is not a general task runner.** A rune that only wraps a shell command it could have called directly has earned nothing. What justifies a rune is that it reads project state and shapes it — the gathering, the structuring, the parameterization — not that it saves typing.

**It does not try to be ambient.** An earlier integration injected rune output into prompts automatically through an editor hook. That is gone and has no replacement: it worked in exactly one tool, which contradicted the first principle above. An agent calls a rune the same way a person does, or not at all.
