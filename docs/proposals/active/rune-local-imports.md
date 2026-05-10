---
tags:
  - proposed
---

# Proposal: Local Rune Imports (`@plugin/` for local runes)

## Overview

This proposal extends the `@plugin/` import prefix to work in local runes. Currently `@plugin/` is only valid in plugin runes (resolving to the plugin's own directory); in a local rune it throws an error. Under this proposal `@plugin/` becomes a context-aware "home directory" prefix: in a plugin rune it still resolves to `<plugin-dir>/`, and in a local rune it resolves to `.crunes/`. One prefix, same mental model everywhere.

## Motivation

Plugin runes can already import any file within their plugin using `@plugin/` or relative paths. Local runes have no equivalent root alias — they can only use relative imports scoped to their own file's directory. This means sharing code across local runes requires fragile chains like `../../shared/utils.js` that break when files move.

The `@plugin/` prefix already carries the meaning "my rune's home directory". Extending it to local runes is the most natural fit: no new prefix to learn, and parity with plugins is immediate.

## Developer Experience

The same import style works regardless of whether the rune is local or a plugin:

```js
// .crunes/shared/format.js  (local rune shared code)
export function pascal(str) {
  return str.replace(/(^\w|[-_]\w)/g, m => m.replace(/[-_]/, '').toUpperCase());
}

// .crunes/runes/scaffold.js  (local rune)
import { pascal } from '@plugin/shared/format.js';

export async function use(dir, args, utils) {
  const name = pascal(args[0]);
  await utils.fs.write(`src/${name}.ts`, `export class ${name} {}`);
}
```

The structure of `.crunes/` is entirely up to the author. `@plugin/` is a root alias — `shared/`, `lib/`, `data/`, `templates/` — any layout works.

## Resolution Table

| Context | `@plugin/<path>` resolves to |
|---|---|
| Plugin rune | `<plugin-dir>/<path>` |
| Local rune | `.crunes/<path>` |

Both contexts are bounded to their respective roots — any path that resolves outside throws a `PermissionError`. Both share the same module cache, so multiple runes importing the same `@plugin/` file within one isolate share the same compiled module instance.

## Permissions

No new permission scope is needed. The runner already injects `fs.read:@plugin/**` into the effective allow list for plugin runes. For local runes, the same string is injected with `@plugin/` resolving to `.crunes/`.

## Independence Note

This change is fully backward-compatible. All existing plugin runes that use `@plugin/` are unaffected — `pluginDir` is non-null for them, so resolution is identical to today. Only local runes (where `pluginDir` is currently `null`) gain new behavior.

## Implementation Groundwork

1. **Resolver update**: In `src/rune/isolation/resolver.js`, the existing `@plugin/` handling checks `pluginDir`. Extend it: if `pluginDir` is `null` and `specifier` starts with `@plugin/`, resolve against `path.join(projectDir, '.crunes', specifier.slice('@plugin/'.length))`. Validate the result stays within `.crunes/` before calling `compileFile()`.

2. **`projectDir` threading**: `createModuleResolver` currently receives `pluginDir` but not `projectDir`. Pass `projectDir` through from `runRuneInIsolate` so the local `@plugin/` resolution has a stable root.

3. **Allow list injection**: In `runner.js`, when `pluginDir` is `null`, include `'fs.read:@plugin/**'` in the augmented allow list (it is currently absent for local runes).

4. **`fs.js` parity**: `resolveToAbs` in `src/rune/api/fs.js` already handles `@plugin/` for `utils.fs` paths. Apply the same local-rune fallback there: if `pluginDir` is `null` and the path starts with `@plugin/`, resolve against `.crunes/` instead of throwing.
