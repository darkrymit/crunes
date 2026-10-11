---
type: concept
title: Plugin
description: A distributable bundle of runes and templates, installed once per machine from a marketplace and enabled per project with permissions the user consented to.
tags: [concept, plugin, marketplace]
---

# Plugin

A plugin is a directory with a `.crunes-plugin/plugin.json` manifest declaring runes, their variables, and the permissions those runes need. It is how a rune written by someone else reaches a project.

## Installed globally, enabled per project

The split is the whole design:

* **The global registry** (`<store>/plugins.json`) records what is installed on the machine — where its files are, what version, and which permission patterns the user consented to.
* **The project config** records which of those are enabled *here*, as a boolean map.

So a plugin is downloaded and consented to once, and then switched on per project. A project may also restrict it — narrow its grants, or disable it outright even when a global config layer enabled it.

The map is a map rather than a list for exactly that reason: a list structurally cannot express *off*, so with a global layer beneath it a project could never turn off something the layer above had turned on. Legacy list form is still read and converted on the next write.

## Identity is `marketplace@name`

A plugin's registry key is composite: the [marketplace](/concepts/marketplace.md) it came from, then its name. Two plugins with the same name from different marketplaces coexist without either shadowing the other, and a bare name that matches more than one is an error naming the qualified forms rather than a guess.

A rune inside a plugin is reached as `marketplace@plugin:rune`, and that fully-qualified form is also the key a project uses to override the rune's permissions or variables.

## Consent is a snapshot, and the diff is what you are asked about

Every permission pattern approved at install is stored. On update, the new manifest is diffed against that snapshot, and **only new or escalated patterns are shown.** Patterns already approved are never re-prompted.

The snapshot is keyed per rune rather than per plugin. Adding a rune to a plugin is a new capability boundary, so it triggers consent even when every existing rune is untouched.

This is a deliberate trade against consent fatigue: a user who is asked to re-approve an unchanged list on every patch release stops reading the list, at which point the prompt protects nothing.

## What a plugin may assume

Very little, on purpose. A plugin rune gets read access to its own installation directory automatically and **nothing else** — reaching project files requires declaring it, and a plugin rune that reads a project path without the grant fails rather than silently returning nothing.

There is no mechanism for a plugin to declare which CLI version it needs; the manifest has no `engines` field and the CLI checks none. A plugin calling an API the installed CLI lacks fails at the call site. See [the repository topology](/decisions/repo-topology.md) for why that edge is currently left open.
