---
tags:
  - proposed
---

# Proposal: Import-Based Utils (`@utils`)

## Overview

This proposal replaces the `utils` argument in rune function signatures with a virtual ESM module importable as `@utils`. Rune authors write `import { fs, json } from '@utils'` instead of receiving a `utils` object as a third argument. The function signature shrinks to `use(args)` or `use(args, ctx)`. Both styles are supported simultaneously; v1 runes are detected by arity and called unchanged.

## Motivation

The current `use(dir, args, utils)` signature has two friction points:

1. **`utils` as an argument feels arbitrary.** Utilities like `fs` and `json` are capabilities, not call-site data — they don't belong alongside `dir` and `args`. Passing them as a third positional argument obscures that distinction and forces every rune to carry a parameter it may only partially use.

2. **`dir` is redundant.** The project root is already implicit in every `utils.fs` call. Surfacing it as a bare string argument alongside parsed args creates an inconsistent positional convention.

The import pattern is the natural fit: capabilities come from imports, call-site data comes from arguments.

## Developer Experience

```js
import { fs, json, section, md } from '@utils'

export async function use(args) {
  if (!(await fs.exists('package.json'))) {
    return [section.create('result', {
      type: 'markdown',
      content: md.p(`${md.bold('Error:')} package.json not found.`),
    })]
  }
  await json.modify('package.json', pkg => {
    pkg.scripts[args[0]] = args[1]
    return pkg
  })
  return [section.create('result', { type: 'markdown', content: md.p('Done.') })]
}
```

Developers who still want inline access to the project root or section context can opt into the `ctx` argument:

```js
export async function use(args, ctx) {
  // ctx.dir      — absolute project root
  // ctx.selected — section patterns from the key token (e.g. ::intro,body)
  // ctx.vars     — merged rune + project vars
}
```

## Import Surface

All sub-utils are named exports from a single specifier:

```js
import { fs, json, yaml, xml, shell, fetch, env, vars, section, md, tree, dir } from '@utils'
```

`dir` is a plain string export (absolute project root). All other exports are the same objects currently assembled on `globalThis.utils`.

## Backward Compatibility

The runner detects the old three-argument signature by `function.length === 3` and calls it as today: `use(dir, args, utils)`. No migration required. Both styles can coexist in the same plugin. There is no deprecation timeline for v1.

## Relationship to Other Proposals

- **`declarative-rune-arguments`** — defines how `args` becomes a parsed object instead of a raw array. Compatible: `args` in `use(args)` will be a parsed object once that proposal lands.
- **`rune-local-imports`** — extends `@plugin/` to local runes. Orthogonal; both can ship independently.

## Implementation Notes

Full implementation details are in `docs/superpowers/specs/2026-05-20-rune-import-utils-design.md`. High-level touch points:

- **`utils-bootstrap.js`** — add named exports for each sub-util and `export const dir = $__projectDir` alongside the existing `globalThis.utils` assignment
- **`resolver.js`** — accept a `virtualModules` map; intercept `@utils` at step 0 before all other resolution logic
- **`runner.js`** — inject `$__projectDir` global; pass the compiled utils module as a virtual module to the resolver; detect v1/v2 by arity in the `context.eval` call site
