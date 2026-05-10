---
tags:
  - proposed
---

# Proposal: Cache Utilities (`utils.cache`)

## Overview

This proposal introduces `utils.cache`, a TTL-based key-value store that persists data between Rune invocations. It follows the same path convention as `utils.fs`: a special `@plugin-cache/` prefix gives every plugin its own isolated namespace with no permission declaration required, while any other path lets runes open a user-defined shared cache.

## Motivation

Runes that fetch remote data (API specs, issue lists, registry metadata) or scan large codebases re-do that work on every invocation, even when the underlying data hasn't changed. Without a cache layer, the only workaround is manually writing JSON files via `utils.json`, which has no TTL mechanism and no isolation between runes.

Some workflows also benefit from shared caches — a `fetch-spec` rune that populates data that a `generate-client` rune later reads, for example. By opening a cache at a shared path, multiple runes can collaborate without any special coordination mechanism.

## API

All cache access goes through `utils.cache.open(path)`, which returns a handle. The path follows the same conventions as `utils.fs`: relative paths resolve against the project root, and the `@plugin-cache/` prefix resolves to the current plugin's isolated cache directory.

```js
// Plugin-local cache — always available, isolated per plugin
const local = await utils.cache.open('@plugin-cache/spec');

// User-defined shared cache — requires a cache: permission
const shared = await utils.cache.open('./my-team-cache');
```

Every handle exposes the same interface:

```js
await cache.set('key', value, 3600);  // TTL in seconds (optional)
const value = await cache.get('key'); // null if missing or expired
await cache.delete('key');
await cache.clear();                  // removes all entries in this cache
```

As a convenience, `utils.cache` itself is pre-opened at `@plugin-cache/default`, so simple per-rune caching requires no setup:

```js
await utils.cache.set('spec', parsedSpec, 3600);
const spec = await utils.cache.get('spec');
```

Only JSON-serializable values are accepted. Passing non-serializable data throws synchronously.

## Permissions

Paths starting with `@plugin-cache/` require no permission declaration — the framework automatically scopes them to the current plugin.

Any other path requires a `cache:<path>` permission:

```json
{
  "runes": {
    "fetch-spec": {
      "permissions": {
        "allow": ["cache:./my-team-cache"]
      }
    },
    "generate-client": {
      "permissions": {
        "allow": ["cache:./my-team-cache"]
      }
    }
  }
}
```

Calling `utils.cache.open(path)` for a non-`@plugin-cache/` path without the matching permission throws a `PermissionError`.

## Storage

- **`@plugin-cache/`** resolves to `.crunes/cache/plugins/<plugin-id>/` — managed by the framework, safe to delete manually.
- **User-defined paths** resolve against the project root via `canonicalizePath`, exactly as they would in `utils.fs`.

Each entry is stored as a `<key>.json` file containing `{ value, expiresAt: number | null }`.

## Implementation Groundwork

1. **Host implementation**: Add `src/rune/api/utils/cache.js`. Resolve `@plugin-cache/<sub>` to `.crunes/cache/plugins/<plugin-id>/<sub>/` using the execution context. Resolve all other paths via the existing `canonicalizePath` from `src/rune/api/fs.js`.
2. **TTL eviction**: On `get`, compare `expiresAt` against `Date.now()`. Delete the entry file and return `null` if expired. No background eviction is needed.
3. **Permission wiring**: Add a `cache:<path>` scope to `src/rune/permissions/permissions.js`. Skip the permission check for `@plugin-cache/` paths. For all others, run the path through `canonicalizePath` and check against declared permissions before resolving.
4. **Isolate bridge**: Register `utils.cache` in `src/rune/isolation/builtins.js`. Pre-open `utils.cache` itself at `@plugin-cache/default`. Expose `open`, `set`, `get`, `delete`, and `clear` as `ivm.Reference` callbacks.
5. **Serialization guard**: Validate that `value` is JSON-serializable on the host side before writing. Throw a descriptive error if not.
6. **Concurrency**: Write entries atomically via a temp file and rename to prevent partial reads when multiple runes write to the same cache simultaneously.
