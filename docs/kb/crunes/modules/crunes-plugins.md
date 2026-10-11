---
type: module
title: crunes-plugins
description: The first-party marketplace — a repository that serves its own plugin index, holding the plugins that ship with the project rather than any runtime.
tags: [repository, plugin, marketplace]
---

# crunes-plugins

The official [marketplace](/concepts/marketplace.md), and the plugins it publishes. It executes nothing on its own: every rune here runs inside the CLI's isolate under grants the installing project consented to.

The repository is its own marketplace source. `.crunes-plugin/marketplace.json` at the root lists each plugin by relative path, so adding the repository as a marketplace and installing from it are the same act against the same tree.

**Its knowledge base is [`crunes-plugins-main`](kb:crunes-plugins-main/index.md)** — what a plugin manifest owes, how commands are scoped and enabled, and the traps in pairing grants to commands.

## What it publishes

| Plugin | Purpose |
|---|---|
| `git` | Workspace orientation — every repository found, with branch, tracking and recent commits |
| `kb` | Reads knowledge bundles, including the ones this project keeps |
| `qdev` | Quarkus Dev UI access, read-only unless a project opts into more |

## Why it is separate

A marketplace is something a user adds by name and then trusts. It should be readable on its own terms by someone deciding whether to trust it, without cloning the runtime to audit a plugin. Folding it into `crunes-cli` would also tie a plugin fix to an npm release of the CLI — see [the repository topology](/decisions/repo-topology.md).

## Where it dogfoods the project

The `kb` plugin is what reads these bundles. Registering a bundle means granting that rune the roots it should see, which the [knowledge base layout spec](/specs/knowledge-base.md) states as part of the layout rather than as deployment trivia — an unregistered bundle is invisible rather than broken, and that is a property of this project reading its own documentation through its own plugin.
