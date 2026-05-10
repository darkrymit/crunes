---
tags:
  - proposed
---

# Proposal: Interactive Prompts (`utils.prompt`)

## Overview

This proposal introduces `utils.prompt`, a suite of interactive input primitives that let Runes collect user input at runtime — free-form text, password, single-choice, multi-choice, and yes/no confirmation.

## Motivation

Runes currently receive all input upfront via CLI arguments or static config. This is insufficient for scaffolding wizards where later choices depend on earlier answers, or for destructive operations that warrant an explicit confirmation before proceeding.

## Timeout Suspension

The `context.eval` timeout in `runner.js` is wall-clock time. A 30-second default would terminate a rune while a user is reading a prompt. Any rune that declares the `prompt` permission runs with no isolate timeout — the runner omits the `timeout` option from `context.eval` for those executions.

## API

All methods are async. They suspend the isolate by awaiting the host `ivm.Reference` — no CPU is consumed while waiting for input.

```js
// Free-form text
const name = await utils.prompt.input({ message: 'Component name?', default: 'MyComponent' });

// Masked input
const token = await utils.prompt.password({ message: 'API token:' });

// Single-choice menu — returns the selected value
const lang = await utils.prompt.select({
  message: 'Language?',
  choices: ['typescript', 'javascript'],
});

// Multi-choice menu — returns an array of selected values
const features = await utils.prompt.multiselect({
  message: 'Include features:',
  choices: ['tests', 'storybook', 'styles'],
});

// Yes/no — returns boolean
const ok = await utils.prompt.confirm({ message: 'Overwrite existing files?', default: false });
```

## Permissions

Declaring `prompt` in the allow list both gates access to `utils.prompt.*` and suppresses the isolate timeout:

```json
{
  "runes": {
    "scaffold": {
      "permissions": {
        "allow": ["prompt"]
      }
    }
  }
}
```

A rune calling any prompt method without this permission throws a `PermissionError`.

## Implementation Groundwork

1. **Host implementation**: Add `src/rune/api/utils/prompt.js` using `@inquirer/prompts`. Each method renders the prompt to the terminal and returns the user's response.

2. **Timeout suppression**: In `runner.js`, check `effective.allow` for `'prompt'`. If present, omit the `timeout` option from both `runeMod.evaluate()` and `context.eval()`.

3. **Permission wiring**: Add a `prompt` scope to `src/rune/permissions/permissions.js` as a flat token (no path suffix).

4. **Isolate bridge**: Register `$__utils_prompt_input`, `$__utils_prompt_password`, `$__utils_prompt_select`, `$__utils_prompt_multiselect`, and `$__utils_prompt_confirm` as `ivm.Reference` callbacks in `runner.js`. Config objects and return values cross the boundary as JSON strings.

5. **Bootstrap wiring**: Add `utils.prompt` to `utils-bootstrap.js` with one wrapper per method, each using `{ result: { promise: true } }`.
