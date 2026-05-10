---
tags:
  - proposed
---

# Proposal: SQLite Utilities (`utils.sqlite`)

## Overview

This proposal introduces `utils.sqlite`, a permission-gated SQLite client for Runes. It allows rune authors to open, query, and mutate structured relational data using a familiar async API, without exposing raw database handles across the isolate boundary.

## Motivation

Context Runes that map codebase metadata, build local knowledge bases, or track incremental state need more than flat JSON files. Relational queries, joins, and indexed lookups are impractical to replicate with `utils.json`. A native SQLite bridge fills this gap without adding a network dependency or requiring a running database server.

Two constraints shape the design:

- **Isolate boundary**: `isolated-vm` cannot pass live object instances between the host and the sandbox. Database handles must be managed on the host side and referenced inside the isolate via opaque integer IDs.
- **Callback isolation**: Callbacks cannot cross the isolate boundary. Transactions are therefore implemented entirely inside `utils-bootstrap.js`, composing the primitive `exec` calls — exactly as `utils.json.update` does with `utils.fs.write`.

## API

`utils.sqlite.open(path)` returns a `Database` handle. The path follows the same conventions as `utils.fs` and `utils.cache`: relative paths resolve against the project root, `@plugin/` resolves to the plugin directory, and the special `@plugin-sqlite/` prefix resolves to a plugin-scoped directory under `.crunes/sqlite/`. Any file extension is accepted (`.sqlite`, `.db`, `.sqlite3`).

```js
// Plugin-local database — always available, scoped to this plugin
const db = await utils.sqlite.open('@plugin-sqlite/meta.sqlite');

// User-defined path — requires sqlite.read / sqlite.write permission
const shared = await utils.sqlite.open('./data.sqlite');

// Read — returns an array of row objects
const users = await db.query('SELECT * FROM users WHERE active = ?', [1]);

// Read first row — returns a single object or null
const user = await db.get('SELECT * FROM users WHERE id = ?', [42]);

// Write — returns { changes: number, lastInsertRowid: number }
const result = await db.exec('INSERT INTO users (name) VALUES (?)', ['Alice']);

// Transaction — callback runs inside the isolate; only exec calls cross the boundary
await db.transaction(async () => {
  await db.exec('INSERT INTO orders (user_id) VALUES (?)', [result.lastInsertRowid]);
  await db.exec('UPDATE users SET order_count = order_count + 1 WHERE id = ?', [result.lastInsertRowid]);
});

await db.close();
```

Databases are opened in WAL mode by default. If the rune exits without calling `db.close()`, the framework closes all open connections automatically before disposing the isolate.

## Permissions

Paths under `@plugin-sqlite/` require no permission declaration — the framework automatically scopes them to the current plugin.

For any other path, `utils.sqlite.open()` requires a declared permission. Read-only runes (SELECT only) may declare `sqlite.read`; runes that mutate data must also declare `sqlite.write`:

```json
{
  "runes": {
    "query-meta": {
      "permissions": {
        "allow": [
          "sqlite.read:./shared.sqlite"
        ]
      }
    },
    "index-files": {
      "permissions": {
        "allow": [
          "sqlite.read:./shared.sqlite",
          "sqlite.write:./shared.sqlite"
        ]
      }
    }
  }
}
```

The framework enforces the split at runtime: a rune with only `sqlite.read` that calls `db.exec()` with a mutating statement throws a `PermissionError`.

## Storage

- **`@plugin-sqlite/`** resolves to `.crunes/sqlite/<plugin-id>/` — managed by the framework, safe to delete manually.
- **User-defined paths** resolve against the project root via `canonicalizePath`, exactly as they would in `utils.fs`.

## Implementation Groundwork

1. **Host implementation**: Add `src/rune/api/utils/sqlite.js` using `better-sqlite3`. Maintain a connection registry (`Map<number, Database>`) scoped to each `createUtils` call. `open()` allocates a new integer handle ID, opens the connection, applies `PRAGMA journal_mode=WAL`, and stores it.

2. **`@plugin-sqlite/` resolution**: Resolve `@plugin-sqlite/<name>` to `.crunes/sqlite/<plugin-id>/<name>` using the plugin ID from the execution context. Skip the permission check for these paths.

3. **Connection cleanup**: Extend `createUtils` to return a `dispose()` hook alongside the utils object. Call `dispose()` in the `finally` block of `runRuneInIsolate` (before `isolate.dispose()`) to close all connections in the registry.

4. **Permission split**: `query` and `get` check `sqlite.read:<canonical-path>`; `exec` checks `sqlite.write:<canonical-path>`. Use `canonicalizePath` from `src/rune/api/fs.js` for normalization. Add both scopes to `src/rune/permissions/permissions.js`.

5. **Isolate bridge**: Add `ivm.Reference` callbacks in `runner.js`: `$__utils_sqlite_open`, `$__utils_sqlite_query`, `$__utils_sqlite_get`, `$__utils_sqlite_exec`, and `$__utils_sqlite_close`. Params and row results cross the boundary as JSON strings.

6. **Handle wrapping in `utils-bootstrap.js`**: `utils.sqlite.open(path)` calls `$__utils_sqlite_open` and receives an integer handle ID. It returns a plain JS object `{ query, get, exec, transaction, close }` that closes over the handle ID.

7. **Transaction (isolate-side)**: Implement `transaction` entirely in `utils-bootstrap.js` — no callback crosses the boundary:
   ```js
   transaction: async (fn) => {
     await db.exec('BEGIN');
     try { await fn(); await db.exec('COMMIT'); }
     catch (e) { await db.exec('ROLLBACK'); throw e; }
   }
   ```
