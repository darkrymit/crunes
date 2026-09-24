---
type: decision
title: Four repositories with gitignored mounts
description: The umbrella repository holds documentation and examples and mounts the three published repositories as ignored directories rather than submodules.
tags: [repository, topology]
---

# Four repositories with gitignored mounts

| Repository | Holds | Published as |
|---|---|---|
| `crunes` | Documentation, the knowledge base, examples, the proposal archive | nothing — it is the umbrella |
| `crunes-cli` | The CLI, the sandbox, the utils API, the permission engine | npm package |
| `crunes-skills` | Agent skills teaching an agent to discover, run and write runes | `npx skills add`, and a Claude plugin marketplace |
| `crunes-plugins` | The first-party plugin marketplace and its plugins | a crunes marketplace source |

The three published repositories are cloned into the umbrella as directories it gitignores. The umbrella records *what* to clone, in its README, not *which commit*.

The split is by **release cadence and consumer**, which is the only line that held. The CLI ships to npm on a version tag. The plugins are fetched by a marketplace index, at whatever version that index names. The skills are installed by a tool that knows nothing about either. Three consumers, three cadences, and a change to one of them is almost never a change to another.

## Why not one repository

A single repository would publish four things on one tag. A README fix in the skills would cut an npm release of the CLI, or the skills would wait on a CLI release to ship a typo fix. Neither is acceptable, and there is no tagging scheme that makes one repository behave as three independent release trains.

It would also make the permission surface dishonest. `crunes-plugins` is a marketplace that users add by URL and install from; it is meant to be readable on its own terms, by someone who has decided to trust it. Folding it into the CLI's repository would mean auditing a plugin required cloning the runtime.

## Why not submodules

A pinning mechanism earns its cost when a specific combination of versions has to be reproducible. Here the compatibility contract is the CLI's **published version and the API surface it exposes**, not a git tree — a plugin works against a released CLI, which a user installed from npm, not against whatever commit a pointer names.

At four repositories with one developer, submodule pointer commits and detached-HEAD checkouts would be paid daily for a guarantee never used. Worse, they would be actively misleading: a pinned `crunes-plugins` commit says nothing about whether those plugins work with the CLI the user actually has installed.

## What it costs

**Cross-repository references cannot be checked.** A document in the umbrella naming a source file in the CLI is a string, and nothing will notice when it goes stale. The convention that follows: **name repositories and documents, never paths into another repository**, because a name can be searched and a broken path only looks correct.

**A change to code and a change to the knowledge describing it can no longer be one commit.** That is the reason the knowledge base is a bundle per repository rather than one — see [the knowledge base format decision](/decisions/knowledge-base-format.md).

**Nothing enforces that a plugin still works against the current CLI.** There is no `engines` field in the plugin manifest and the CLI never checks one, so a plugin using an API the installed CLI does not have fails at the call site rather than at install. This is a known open edge, left open deliberately: at one first-party marketplace the failure is a bug report, and a version-matrix mechanism would cost more than it currently saves.

**Every git command has to be run in the right directory.** The three mounts are separate repositories, so a `git status` at the umbrella says nothing about them, and a commit at the umbrella cannot contain their changes. This is written into the agent instructions as a standing rule because it is the single easiest thing to get wrong here.
