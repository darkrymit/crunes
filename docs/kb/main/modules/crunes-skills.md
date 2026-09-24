---
type: module
title: crunes-skills
description: Four agent skills teaching when to reach for a rune and how to write one, carrying no API surface of their own and therefore no knowledge bundle of their own.
tags: [repository, skills, agent]
---

# crunes-skills

Markdown only. Four skills — `crunes`, `crunes-write-rune`, `crunes-permissions`, `crunes-write-plugin` — installed with `npx skills add darkrymit/crunes-skills` or through a Claude plugin marketplace. Each is standalone; installing one alone works.

They teach judgement: when a rune is the right move instead of re-scanning a tree, how to read a permission denial back to the grant it wants, what shape a rune or plugin should take. They state no signatures, namespace lists, flag tables or command inventories, because the installed CLI generates all of that — see [skills state no API surface](/decisions/skills-state-no-api.md), which is this repository's entire architecture.

**It has no knowledge bundle.** Everything true of it is the decision above plus the four files themselves, and a bundle here would hold a heading and a link. The rule that produced that is in [the knowledge base format decision](/decisions/knowledge-base-format.md).

## What replaced what

It supersedes `crunes-aci`, which integrated through a Claude Code `UserPromptSubmit` hook and injected rune output into prompts automatically. That repository is deprecated and its notice points here.

The hook and its `$$key(args)` token injection were **not** carried forward and have no replacement. They worked in exactly one tool, which contradicts the reason the project has a CLI at all — see [the vision](/vision/context-runes.md). An agent now calls a rune the way a person does.
