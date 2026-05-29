# Using a Plugin — Git Status

Install and invoke the official `git` plugin from the crunes GitHub marketplace.

## What it demonstrates

- Registering a remote GitHub marketplace source with `crunes marketplace add`
- Installing a plugin with `crunes plugin install`
- Invoking a plugin rune with `crunes use <plugin>:<rune>`

## Prerequisites

- `crunes` CLI installed and available on your PATH
- Internet access (GitHub API is used to resolve the marketplace)

## How to run

From this directory:

```bash
crunes marketplace add darkrymit/crunes-plugins
crunes plugin install crunes-plugins@git
crunes use git:status
```

The `marketplace add` step registers the GitHub-hosted `darkrymit/crunes-plugins` repository as a source.
The `plugin install` step downloads the `git` plugin and prompts you to consent to its permissions.
The `crunes use git:status` step runs the installed rune.

## What to expect

A markdown section for each git repository discovered in your current working directory, showing:

- Current branch and upstream tracking (ahead/behind counts)
- Staged, unstaged, and untracked file counts
- Last 10 commits (oneline)
- Stash count
