# Design Spec: Schema Cache for args/argsRepl/commandsRepl

**Date:** 2026-06-23
**Status:** Approved

## Problem

Every call to `getArgsSchema` or `getReplSchema` spins up a fresh `isolated-vm` isolate, compiles the rune module, and evaluates `args()` / `argsRepl()` / `commandsRepl()` just to extract a declarative schema. This happens on every `crunes run`, `crunes repl`, `crunes docs rune`, and `crunes docs intro` invocation — the last being the worst case, iterating all project runes in a loop.

Schemas are almost always static declarations. Caching them on disk eliminates the isolate startup cost on repeated invocations.

## Solution

A file-based schema cache under `.crunes/schemas/`. Cache key is derived from rune file content + vars. Hash is stored inside the file so no file is created on a cache miss. A `crunes schema` command family provides visibility and manual invalidation.

---

## 1. Cache Key

```
hash = sha256(file_content) + ":" + sha256(JSON.stringify(vars_sorted_by_key))
```

- `file_content` — raw bytes of the rune `.js` file
- `vars_sorted_by_key` — project vars object with keys sorted deterministically
- `env` is excluded — best-effort tradeoff; `crunes schema delete <key>` is the escape hatch for env-dynamic schemas

`null` schema (rune has no matching export) is a valid cached result — stored and returned to skip the isolate on the next call.

---

## 2. Storage

**Location:** `.crunes/schemas/` (local, per-project, already gitignored alongside `.crunes/caches/`)

No global cache — schemas depend on `vars` which are project-specific.

**Three files per rune+vars combination** (one per schema type):

```
.crunes/schemas/<safe-key>-args.json
.crunes/schemas/<safe-key>-argsRepl.json
.crunes/schemas/<safe-key>-commandsRepl.json
```

`<safe-key>` is the rune key with `:` replaced by `__` for Windows filename compatibility (e.g. `myplugin__my-rune`). The original rune key is preserved inside the file.

**File format:**

```json
{
  "runeKey": "myplugin:my-rune",
  "hash": "<content-hash>:<vars-hash>",
  "cachedAt": "2026-06-23T16:00:00.000Z",
  "schema": { "options": [...], "positionals": [...], "examples": [...], "commands": [...] }
}
```

`schema` is `null` when the rune has no matching export (`args`, `argsRepl`, or `commandsRepl`).

**On read:** load file → recompute hash → compare. Mismatch = cache miss → overwrite. Match = return `schema` field (including `null`).

**On write:** atomic write via temp file + `fs.rename` to avoid partial reads under concurrent processes. `.crunes/schemas/` is created on first write if absent.

---

## 3. New Module: `src/rune/schema-cache.js`

```js
// Compute the cache hash for a rune file + vars combination
computeHash(runeFile, vars): Promise<string>

// Returns schema (including null) on hit, undefined on miss
readSchemaCache(runeKey, type, runeFile, vars, projectDir): Promise<object | null | undefined>

// Writes cache entry atomically; creates .crunes/schemas/ if needed
writeSchemaCache(runeKey, type, runeFile, vars, schema, projectDir): Promise<void>

// Returns array of { runeKey, type, hash, cachedAt, filePath } for CLI list
listSchemaCaches(projectDir): Promise<Array>

// Deletes all three type files for a given rune key
deleteSchemaCache(runeKey, projectDir): Promise<void>
```

`type` is one of `'args'`, `'argsRepl'`, `'commandsRepl'`.

---

## 4. Integration Points

### `getArgsSchema(runeFile, effective, projectDir, opts)`

```
1. read cache → hit: return cached schema (even null)
2. miss: run isolate as today
3. write cache entry (type: 'args')
4. return schema
```

### `getReplSchema(runeFile, effective, args, projectDir, opts)`

Both `argsRepl` and `commandsRepl` are computed in a single isolate run. Treat them atomically:

```
1. read cache for both 'argsRepl' and 'commandsRepl'
2. both hit: return { argsSchema: cached, commandsSchema: cached }
3. any miss: run isolate as today
4. write both cache entries
5. return { argsSchema, commandsSchema }
```

A partial hit (one file present, one missing) is treated as a full miss — both are re-evaluated and rewritten. This prevents stale state if a write was interrupted.

---

## 5. CLI Commands

Registered under `crunes schema` in `src/cli/program.js`, matching the `cache` and `job` command family pattern.

### `crunes schema list`

Lists all schema cache entries for the current project.

**File:** `src/rune/commands/schema/list.js`

Output columns: rune key, type, cachedAt, hash (truncated to 12 chars).

### `crunes schema delete <rune-key>`

Removes all three type files for the given rune key. Primary escape hatch for env-dynamic schemas.

**File:** `src/rune/commands/schema/delete.js`

Accepts the original rune key (e.g. `myplugin:my-rune`) — translates to safe filename internally.

---

## 6. Cleanup

Remove the `format === 'json'` branch from `src/docs/intro-compiler.js` — dead code, output is not compatible with the text format and has no known callers.

---

## Scope

- **Create:** `src/rune/schema-cache.js`
- **Create:** `src/rune/commands/schema/list.js`
- **Create:** `src/rune/commands/schema/delete.js`
- **Modify:** `src/rune/isolation/runner.js` — wrap `getArgsSchema` and `getReplSchema` with cache read/write
- **Modify:** `src/cli/program.js` — register `crunes schema list` and `crunes schema delete`
- **Modify:** `src/docs/intro-compiler.js` — remove dead `format === 'json'` branch
- **Modify:** `src/core/commands/init.js` — add `schemas/` to gitignore template (alongside `caches/`)
