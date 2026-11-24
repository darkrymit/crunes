# Using a Marketplace Plugin — Token Counter

Install and invoke the official `token` plugin from the crunes GitHub marketplace.

## What it demonstrates

- Registering a remote GitHub marketplace source with `crunes marketplace add`
- Installing a plugin with `crunes plugin install`
- Invoking a plugin rune with `crunes run <plugin>:<rune>`

## Prerequisites

- `crunes` CLI installed and available on your PATH
- Internet access (GitHub is used to resolve the marketplace)

## How to run

From this directory:

```bash
crunes marketplace add darkrymit/crunes-plugins
crunes plugin install crunes-plugins@token
crunes run token:token count README.md
```

The `marketplace add` step registers the GitHub-hosted `darkrymit/crunes-plugins` repository as a source.
The `plugin install` step downloads the `token` plugin and prompts you to consent to its permissions.
The `crunes run token:token count README.md` step runs the installed rune on this file.

## What to expect

A markdown section with one line for `README.md`, showing:

- Estimated token counts for OpenAI and Claude models
- Character and line counts
