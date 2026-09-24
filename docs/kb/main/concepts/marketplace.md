---
type: concept
title: Marketplace
description: A named source publishing an index of installable plugins, cached locally for remote sources and read live for local ones, and never refreshed without being asked.
tags: [concept, marketplace, plugin]
---

# Marketplace

A marketplace is a source that publishes an index of [plugins](/concepts/plugin.md). Adding one registers its name; installing from it resolves a plugin through that index.

Four source types are recognised, classified from the source string each time rather than stored:

| Type | Written as | Fetch behaviour |
|---|---|---|
| GitHub | `owner/repo` | cached at add |
| npm | a package name | cached at add |
| HTTP | an `https://` URL | fetched live |
| Local | a path — `./`, `/`, `~`, or a drive letter | read live |

## Nothing refreshes on its own

A cached index is never updated except by an explicit `marketplace update`. Installing a plugin does not reach the network.

This is what makes an install reproducible: two people with the same registered index install the same thing, and a `crunes plugin install` in CI does not depend on what an upstream repository looks like this morning. The cost is that a marketplace which added a plugin yesterday does not offer it until someone updates, and the failure reads as *no such plugin* rather than as a stale cache.

Local sources invert both halves. They are read live, so an edit to a plugin under development is visible immediately with no reinstall — and a moved or deleted source directory breaks the entry silently, since nothing validated it at add time.

## Identity comes from the index, not the URL

The registry key is the `name` field inside the downloaded index, not the source it was fetched from. A marketplace that renames itself is re-keyed on the next update: a new entry appears, and the old entry and its cache are removed.

That is the intended behaviour for the registry and a trap for everything else. Configuration, scripts and documentation referring to the old name fail with *marketplace not found*, and nothing rewrites them.

## A plugin repository can be its own marketplace

A repository may carry `.crunes-plugin/marketplace.json` at its root listing plugins by relative path, which is how `crunes-plugins` publishes itself: one source, three plugins, each at `./plugins/<name>`.

Relative paths in an index resolve against the directory containing it — and for an index inside `.crunes-plugin/`, against that directory's parent, so `./plugins/git` means the repository root rather than the manifest folder. That rule is what allows the self-serving layout at all, and it is surprising until you know it.
