---
tags:
  - completed
---

# Proposal: Declarative Rune Arguments

## Overview
This proposal shifts the burden of argument parsing entirely away from the `use` function. Instead of rune authors manually parsing strings, they will optionally export an `args(dir, utils, opts)` function. Inside this function, they can use a new Commander-style builder (`utils.args()`) to effortlessly construct a dynamic schema. The Crunes framework then uses this schema to pre-parse inputs via `yargs-parser` before execution.

## Motivation

Currently, Rune authors receive raw arrays of strings (e.g., `['chat', '-c', '500']`) and are forced to write custom flag-extraction logic. 

While providing a parsing utility to use *inside* the execution block was considered, it falls short for two major reasons:
1. **Dynamic Configuration:** Runes often rely on environment variables or project state (`utils.env`, `utils.json`) to configure their default behavior.
2. **AI & User Discovery:** If parsing logic is hidden inside the `use` function, an AI agent or a human user typing `crunes help <rune>` cannot easily discover what flags the rune actually accepts.

By exposing a dedicated, exported `args` method, the rune can dynamically declare its expected parameters along with human/AI-readable descriptions. The framework can then use this schema to auto-generate help menus, provide context to AI agents, and seamlessly hand a fully parsed object directly to the `use` and `cast` functions.

## Example Usage

```javascript
// .crunes/runes/kb.js

export async function args(dir, utils, opts) {
  const defaultLimit = utils.env('KB_DEFAULT_LIMIT') || 10;

  // Use the Commander-style builder for clean DX
  return utils.args.config()
    .option('-c, --count <number>', 'The maximum number of results to fetch.', defaultLimit)
    .option('--strict', 'Enforce strict matching for lead generation.', false)
    .build();
}

export async function use(dir, args, utils, opts) {
  // `args` is ALREADY a fully parsed object based on the dynamic schema!
  // Example output: { _: ['chat'], count: 500, strict: true }
  
  // The raw string array is preserved for edge-cases:
  // console.log(args.$raw); // ['chat', '-c=500']
  
  const target = args._[0]; // "chat"
  
  return [{
    type: 'markdown',
    content: `Running target "${target}" with a limit of ${args.count}.`
  }];
}
```

## Implementation Groundwork

1. **Schema Builder (`utils.args.config`):** Expose a fluent builder in the sandbox that mimics Commander.js `.option('-f, --flag <type>', 'desc', default)`.
2. **Manual Parser (`utils.args.parse`):** Keep a manual parsing utility available inside `utils.args` for authors who need to parse raw arrays on the fly.
3. **Framework Interception:** Before calling `use`, the framework checks if the rune exports an `args` function.
4. **Dynamic Schema Resolution:** If present, the framework calls `args(dir, utils, opts)` to retrieve the schema definition. If NOT present, it falls back to an empty schema `{}`.
5. **Core Parser Integration (`yargs-parser`):** The framework feeds the raw string array and the schema into `yargs-parser` (which handles advanced POSIX parsing).
6. **CLI Help Menus:** Extend the CLI so that `crunes help <rune>` automatically invokes `args()` to print a beautifully formatted man-page.

## Handling Runes Without an `args` Export

What happens if a rune author **doesn't** export an `args` function? 

The framework is designed to gracefully degrade. If no `args` export is found, the framework will still pass the raw array through `yargs-parser` using a default, empty schema. 

* The `args` parameter in `use(dir, args)` will **always** be a parsed object, guaranteeing API consistency.
* Example: `['chat', '-c=500']` still becomes `{ _: ['chat'], c: 500 }`.
* *Drawback:* The author loses strict type-coercion (e.g., distinguishing between string `"500"` and number `500`), and AI agents will not get descriptions for the flags.

**Preserving Raw Access:**
To ensure backwards compatibility and support edge cases where authors need exactly what the user typed (or need to pass the raw string to another CLI tool), the framework will attach the raw array to the parsed object as a non-enumerable property: `args.$raw`. 

If the author skipped exporting the schema but still wants to parse a sub-array manually inside `use()`, they can call `utils.args.parse(args.$raw, config)` directly.

## Benefits
- **Zero Boilerplate:** The `use()` function remains 100% focused on business logic.
- **Self-Documenting:** The schema provides built-in descriptions, allowing AI models to accurately generate CLI flags without hallucinating parameters.
- **Dynamic Reactivity:** The argument parser natively respects the user's current project state and environment variables to set accurate defaults.
