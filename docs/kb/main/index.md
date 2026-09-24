---
okf_version: 0.2
kb_version: 0.1
kb: crunes-main
---

# Crunes knowledge base

What is true of the crunes ecosystem rather than of any one repository: the model, the vocabulary every part uses, the contracts more than one repository implements, and the decisions that bind the project as a whole.

This is four git repositories, three of them mounted inside this one as ignored directories. Knowledge about a repository's own code lives with that code:

* The CLI, the sandbox and the permission engine — [`crunes-cli-main`](kb:crunes-cli-main/index.md).
* The first-party marketplace and its plugins — [`crunes-plugins-main`](kb:crunes-plugins-main/index.md).
* `crunes-skills` has no bundle; everything true of it is [one decision](/decisions/skills-state-no-api.md).

A document here earns its place by being true of more than one of them. Where to put a new note is [the layout spec](/specs/knowledge-base.md), section 6.

## Vision

* [Context runes](/vision/context-runes.md) - A rune is a small project-local command that answers a question about the project right now, written once and called identically by a person, an agent and CI.

## Concepts

* [Marketplace](/concepts/marketplace.md) - A named source publishing an index of installable plugins, cached locally for remote sources and read live for local ones, and never refreshed without being asked.
* [Permission](/concepts/permission.md) - A capability a rune may exercise, written as a token and a pattern, granted per lifecycle in configuration and checked at every call rather than assumed.
* [Plugin](/concepts/plugin.md) - A distributable bundle of runes and templates, installed once per machine from a marketplace and enabled per project with permissions the user consented to.
* [Rune](/concepts/rune.md) - A JavaScript module that declares a command line, runs in a sandbox with only the capabilities it was granted, and returns structured sections.
* [Section](/concepts/section.md) - The unit a rune returns — a named, typed container the caller renders, filters or pipes, so a rune never decides how its output is displayed.

## Specifications

* [Knowledge base layout](/specs/knowledge-base.md) - This project's layout standard for knowledge bundles — ten categories and how to choose between two that both fit, the front matter contract, which bundle a document belongs to across four repositories, the rule that an index bullet repeats its document's description, and how a bundle is registered with the kb plugin.

## Modules

* [crunes-cli](/modules/crunes-cli.md) - The CLI, the sandbox and the permission engine — the only repository that executes anything, published to npm as the package every other part assumes is installed.
* [crunes-plugins](/modules/crunes-plugins.md) - The first-party marketplace — a repository that serves its own plugin index, holding the plugins that ship with the project rather than any runtime.
* [crunes-skills](/modules/crunes-skills.md) - Four agent skills teaching when to reach for a rune and how to write one, carrying no API surface of their own and therefore no knowledge bundle of their own.

## Decisions

* [OKF bundles, one per repository that has something to say](/decisions/knowledge-base-format.md) - Knowledge is an Open Knowledge Format bundle per repository rather than one shared tree, because a repository's knowledge has to travel with the repository.
* [Four repositories with gitignored mounts](/decisions/repo-topology.md) - The umbrella repository holds documentation and examples and mounts the three published repositories as ignored directories rather than submodules.
* [Skills state no API surface](/decisions/skills-state-no-api.md) - The agent skills carry no signatures, namespace lists, flag tables or command inventories, because the installed CLI generates all of it and a copy in a skill would describe a different version.

## Glossary

* [Terms](/glossary/terms.md) - Quick definitions of the vocabulary every repository in the project uses, each linking to the document that owns the term.
