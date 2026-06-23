# Schema Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cache `args`/`argsRepl`/`commandsRepl` schema evaluation results on disk to eliminate repeated isolate startups on every `crunes run`, `crunes repl`, `crunes docs rune`, and `crunes docs intro` invocation.

**Architecture:** A new `src/rune/schema-cache.js` module handles all disk I/O — reading, writing, listing, and deleting `.crunes/schemas/` files. `getArgsSchema` and `getReplSchema` in `runner.js` are wrapped with cache read-before/write-after logic. Two new CLI commands (`crunes schema list`, `crunes schema delete`) expose management.

**Tech Stack:** Node.js ESM, `node:fs/promises`, `node:crypto` (sha256), existing `isolated-vm` isolate path unchanged.

## Global Constraints

- All files under `src/` must use ES module imports/exports. Never use `require()`.
- Cache files live at `.crunes/schemas/<safe-key>-<type>.json` where `<safe-key>` is the rune key with `:` replaced by `__`.
- Three types: `args`, `argsRepl`, `commandsRepl`.
- `null` schema is a valid cached result (rune has no matching export).
- Atomic writes via temp file + `fs.rename` to avoid partial reads.
- Single commit at the end covering all tasks.

---

### Task 1: `src/rune/schema-cache.js` — core cache module

**Files:**
- Create: `src/rune/schema-cache.js`
- Test: `test/rune/schema-cache.test.js`

**Interfaces:**
- Produces:
  - `computeHash(runeFile, vars): Promise<string>` — sha256 of file content + ":" + sha256 of sorted vars JSON
  - `readSchemaCache(runeKey, type, runeFile, vars, projectDir): Promise<object|null|undefined>` — returns schema (incl. null) on hit, `undefined` on miss
  - `writeSchemaCache(runeKey, type, runeFile, vars, schema, projectDir): Promise<void>` — atomic write
  - `listSchemaCaches(projectDir): Promise<Array<{runeKey, type, hash, cachedAt, filePath}>>` — for CLI
  - `deleteSchemaCache(runeKey, projectDir): Promise<void>` — removes all 3 type files for key

- [ ] **Step 1: Write failing tests**

Create `test/rune/schema-cache.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import {
  computeHash,
  readSchemaCache,
  writeSchemaCache,
  listSchemaCaches,
  deleteSchemaCache,
} from '../../src/rune/schema-cache.js'

describe('schema-cache', () => {
  let tmp, projectDir, runeFile

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'crunes-sc-'))
    projectDir = tmp
    runeFile = join(tmp, 'my-rune.js')
    await writeFile(runeFile, `export function args(b) { return b.option('--verbose', 'v', false) }`)
  })

  afterEach(async () => { await rm(tmp, { recursive: true, force: true }) })

  it('computeHash returns a stable string for same file+vars', async () => {
    const h1 = await computeHash(runeFile, { foo: 'bar' })
    const h2 = await computeHash(runeFile, { foo: 'bar' })
    expect(h1).toBe(h2)
    expect(typeof h1).toBe('string')
    expect(h1).toContain(':')
  })

  it('computeHash differs when file content changes', async () => {
    const h1 = await computeHash(runeFile, {})
    await writeFile(runeFile, `export function args(b) { return b.option('--count', 'c', 0) }`)
    const h2 = await computeHash(runeFile, {})
    expect(h1).not.toBe(h2)
  })

  it('computeHash differs when vars change', async () => {
    const h1 = await computeHash(runeFile, { env: 'prod' })
    const h2 = await computeHash(runeFile, { env: 'dev' })
    expect(h1).not.toBe(h2)
  })

  it('computeHash is stable regardless of vars key insertion order', async () => {
    const h1 = await computeHash(runeFile, { b: '2', a: '1' })
    const h2 = await computeHash(runeFile, { a: '1', b: '2' })
    expect(h1).toBe(h2)
  })

  it('readSchemaCache returns undefined on miss (no file)', async () => {
    const result = await readSchemaCache('my-rune', 'args', runeFile, {}, projectDir)
    expect(result).toBeUndefined()
  })

  it('writeSchemaCache then readSchemaCache returns the schema on hit', async () => {
    const schema = { options: [{ flags: '--verbose', description: 'v', def: false }], positionals: [], examples: [], commands: [] }
    await writeSchemaCache('my-rune', 'args', runeFile, {}, schema, projectDir)
    const result = await readSchemaCache('my-rune', 'args', runeFile, {}, projectDir)
    expect(result).toEqual(schema)
  })

  it('writeSchemaCache accepts null schema (no export) and returns null on hit', async () => {
    await writeSchemaCache('my-rune', 'args', runeFile, {}, null, projectDir)
    const result = await readSchemaCache('my-rune', 'args', runeFile, {}, projectDir)
    expect(result).toBeNull()
  })

  it('readSchemaCache returns undefined when file content has changed (hash mismatch)', async () => {
    await writeSchemaCache('my-rune', 'args', runeFile, {}, null, projectDir)
    await writeFile(runeFile, `export function args(b) { return b.option('--count', 'c', 0) }`)
    const result = await readSchemaCache('my-rune', 'args', runeFile, {}, projectDir)
    expect(result).toBeUndefined()
  })

  it('readSchemaCache returns undefined when vars have changed (hash mismatch)', async () => {
    await writeSchemaCache('my-rune', 'args', runeFile, { env: 'prod' }, null, projectDir)
    const result = await readSchemaCache('my-rune', 'args', runeFile, { env: 'dev' }, projectDir)
    expect(result).toBeUndefined()
  })

  it('writeSchemaCache uses safe filename (colon replaced with __)', async () => {
    await writeSchemaCache('myplugin:my-rune', 'args', runeFile, {}, null, projectDir)
    const { readdir } = await import('node:fs/promises')
    const files = await readdir(join(projectDir, '.crunes', 'schemas'))
    expect(files.some(f => f.includes('myplugin__my-rune'))).toBe(true)
    expect(files.some(f => f.includes(':'))).toBe(false)
  })

  it('listSchemaCaches returns entries for written files', async () => {
    const schema = { options: [], positionals: [], examples: [], commands: [] }
    await writeSchemaCache('my-rune', 'args', runeFile, {}, schema, projectDir)
    await writeSchemaCache('my-rune', 'argsRepl', runeFile, {}, null, projectDir)
    const entries = await listSchemaCaches(projectDir)
    expect(entries).toHaveLength(2)
    expect(entries.map(e => e.type).sort()).toEqual(['args', 'argsRepl'].sort())
    expect(entries[0].runeKey).toBe('my-rune')
    expect(entries[0].cachedAt).toBeTruthy()
    expect(entries[0].hash).toBeTruthy()
    expect(entries[0].filePath).toBeTruthy()
  })

  it('listSchemaCaches returns empty array when schemas dir is absent', async () => {
    const entries = await listSchemaCaches(projectDir)
    expect(entries).toEqual([])
  })

  it('deleteSchemaCache removes all type files for the rune key', async () => {
    await writeSchemaCache('my-rune', 'args', runeFile, {}, null, projectDir)
    await writeSchemaCache('my-rune', 'argsRepl', runeFile, {}, null, projectDir)
    await writeSchemaCache('my-rune', 'commandsRepl', runeFile, {}, null, projectDir)
    await deleteSchemaCache('my-rune', projectDir)
    const entries = await listSchemaCaches(projectDir)
    expect(entries).toEqual([])
  })

  it('deleteSchemaCache does not throw when files are absent', async () => {
    await expect(deleteSchemaCache('nonexistent-rune', projectDir)).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd c:/Users/DarkRymit/Playground/crunes/crunes-cli && npx vitest run test/rune/schema-cache.test.js
```

Expected: all tests fail with "Cannot find module" or similar.

- [ ] **Step 3: Implement `src/rune/schema-cache.js`**

```js
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'

const TYPES = ['args', 'argsRepl', 'commandsRepl']

function safeKey(runeKey) {
  return runeKey.replace(/:/g, '__')
}

function schemasDir(projectDir) {
  return join(projectDir, '.crunes', 'schemas')
}

function cacheFilePath(runeKey, type, projectDir) {
  return join(schemasDir(projectDir), `${safeKey(runeKey)}-${type}.json`)
}

export async function computeHash(runeFile, vars) {
  const content = await readFile(runeFile, 'utf8')
  const sortedVars = Object.fromEntries(Object.entries(vars).sort(([a], [b]) => a.localeCompare(b)))
  const contentHash = createHash('sha256').update(content).digest('hex')
  const varsHash = createHash('sha256').update(JSON.stringify(sortedVars)).digest('hex')
  return `${contentHash}:${varsHash}`
}

export async function readSchemaCache(runeKey, type, runeFile, vars, projectDir) {
  const filePath = cacheFilePath(runeKey, type, projectDir)
  let raw
  try {
    raw = await readFile(filePath, 'utf8')
  } catch {
    return undefined
  }
  let entry
  try {
    entry = JSON.parse(raw)
  } catch {
    return undefined
  }
  const hash = await computeHash(runeFile, vars)
  if (entry.hash !== hash) return undefined
  return entry.schema
}

export async function writeSchemaCache(runeKey, type, runeFile, vars, schema, projectDir) {
  const dir = schemasDir(projectDir)
  await mkdir(dir, { recursive: true })
  const hash = await computeHash(runeFile, vars)
  const entry = {
    runeKey,
    hash,
    cachedAt: new Date().toISOString(),
    schema,
  }
  const filePath = cacheFilePath(runeKey, type, projectDir)
  const tmp = join(dir, `.tmp-${randomBytes(6).toString('hex')}.json`)
  await writeFile(tmp, JSON.stringify(entry, null, 2), 'utf8')
  await import('node:fs/promises').then(m => m.rename(tmp, filePath))
}

export async function listSchemaCaches(projectDir) {
  const dir = schemasDir(projectDir)
  let files
  try {
    files = await readdir(dir)
  } catch {
    return []
  }
  const results = []
  for (const file of files) {
    if (!file.endsWith('.json') || file.startsWith('.tmp-')) continue
    const filePath = join(dir, file)
    try {
      const entry = JSON.parse(await readFile(filePath, 'utf8'))
      const match = file.match(/^(.+)-(args|argsRepl|commandsRepl)\.json$/)
      if (!match) continue
      results.push({
        runeKey: entry.runeKey ?? match[1].replace(/__/g, ':'),
        type: match[2],
        hash: entry.hash,
        cachedAt: entry.cachedAt,
        filePath,
      })
    } catch { /* skip unreadable */ }
  }
  return results
}

export async function deleteSchemaCache(runeKey, projectDir) {
  await Promise.all(
    TYPES.map(type =>
      rm(cacheFilePath(runeKey, type, projectDir), { force: true })
    )
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd c:/Users/DarkRymit/Playground/crunes/crunes-cli && npx vitest run test/rune/schema-cache.test.js
```

Expected: all 13 tests pass.

---

### Task 2: Wrap `getArgsSchema` and `getReplSchema` with cache

**Files:**
- Modify: `src/rune/isolation/runner.js` (around lines 1473–1570 for `getArgsSchema`, 1572–1713 for `getReplSchema`)
- Test: `test/rune/isolation/runner.test.js` (extend existing `getArgsSchema` describe block)

**Interfaces:**
- Consumes: `readSchemaCache`, `writeSchemaCache` from `src/rune/schema-cache.js`
- `getArgsSchema` and `getReplSchema` signatures are **unchanged** — callers need no updates
- New option added to both: `runeKey = null` — when null, caching is skipped (backwards-compatible)

- [ ] **Step 1: Add `runeKey` option to both functions and wire cache**

At the top of `runner.js`, add the import:

```js
import { readSchemaCache, writeSchemaCache } from '../schema-cache.js'
```

Modify `getArgsSchema` — add `runeKey = null` to the options destructure and wrap with cache:

```js
export async function getArgsSchema(runeFile, effective, projectDir, {
  nodeModulesDir = null,
  pluginDeps = {},
  pluginDir = null,
  isolateMemoryMb = 128,
  isolateTimeoutMs = 30_000,
  vars = {},
  runeKey = null,
} = {}) {
  if (runeKey !== null) {
    const cached = await readSchemaCache(runeKey, 'args', runeFile, vars, projectDir)
    if (cached !== undefined) return cached
  }

  // ... existing isolate code unchanged ...

  // After: const schema = await context.evalClosure(...)
  // Replace the final `return schema` with:
  if (runeKey !== null) {
    await writeSchemaCache(runeKey, 'args', runeFile, vars, schema, projectDir).catch(() => {})
  }
  return schema
```

The full modified tail of `getArgsSchema` (replace the existing `return` statement at the end of the try block, around line 1569):

```js
    if (runeKey !== null) {
      await writeSchemaCache(runeKey, 'args', runeFile, vars, schema, projectDir).catch(() => {})
    }
    return schema
  } finally {
    await dispose()
    isolate.dispose()
  }
}
```

Modify `getReplSchema` — add `runeKey = null` to options and wrap both types atomically:

```js
export async function getReplSchema(runeFile, effective, args, projectDir, {
  nodeModulesDir = null,
  pluginDeps = {},
  pluginDir = null,
  isolateMemoryMb = 128,
  isolateTimeoutMs = 30_000,
  vars = {},
  runeKey = null,
} = {}) {
  if (runeKey !== null) {
    const cachedArgs = await readSchemaCache(runeKey, 'argsRepl', runeFile, vars, projectDir)
    const cachedCmds = await readSchemaCache(runeKey, 'commandsRepl', runeFile, vars, projectDir)
    if (cachedArgs !== undefined && cachedCmds !== undefined) {
      return { argsSchema: cachedArgs, commandsSchema: cachedCmds }
    }
  }

  // ... existing isolate code unchanged ...

  // Replace the final `return { argsSchema, commandsSchema }` (around line 1709) with:
  if (runeKey !== null) {
    await Promise.all([
      writeSchemaCache(runeKey, 'argsRepl', runeFile, vars, argsSchema, projectDir).catch(() => {}),
      writeSchemaCache(runeKey, 'commandsRepl', runeFile, vars, commandsSchema, projectDir).catch(() => {}),
    ])
  }
  return { argsSchema, commandsSchema }
```

- [ ] **Step 2: Pass `runeKey` from all three call sites**

**Call site 1** — `runner.js` run path (around line 1312):
```js
const schema = await getArgsSchema(runeFile, effective, projectDir, { vars, nodeModulesDir, pluginDeps, pluginDir, pluginId, runeKey })
```

**Call site 2** — `runner.js` repl path (around line 1776):
```js
const { argsSchema, commandsSchema } = await getReplSchema(runeFile, effective, [], projectDir, { vars, nodeModulesDir, pluginDeps, pluginDir, runeKey })
```

**Call site 3** — `src/docs/commands/rune.js` (lines 78 and 85):
```js
schema = await getArgsSchema(runeFile, runEffective, projectRoot, { vars, runeKey: key })
```
```js
const { argsSchema, commandsSchema } = await getReplSchema(runeFile, replEffective, [], projectRoot, { vars, runeKey: key })
```

**Call site 4** — `src/docs/intro-compiler.js` (line 160):
```js
schema = await getArgsSchema(runeFile, effective, projectRoot, { vars: entry.vars ?? {}, runeKey: key })
```

- [ ] **Step 3: Write failing tests for cache integration**

Add a new `describe` block to `test/rune/isolation/runner.test.js` at the end of the file:

```js
describe('getArgsSchema — schema cache', () => {
  let tmp

  beforeEach(async () => { tmp = await mkdtemp(join(tmpdir(), 'crunes-sc-runner-')) })
  afterEach(async () => { await rm(tmp, { recursive: true, force: true }) })

  const effective = { allow: [], deny: [] }

  it('caches args schema and returns it without spawning isolate on second call', async () => {
    const f = join(tmp, 'rune.js')
    await writeFile(f, `export function args(b) { return b.option('--verbose', 'v', false) }`)

    const schema1 = await getArgsSchema(f, effective, tmp, { runeKey: 'test-rune', vars: {} })
    expect(schema1).not.toBeNull()
    expect(schema1.options[0].flags).toBe('--verbose')

    // Corrupt the rune file — if cache is used, result won't change
    await writeFile(f, `this is not valid JS!!!`)

    const schema2 = await getArgsSchema(f, effective, tmp, { runeKey: 'test-rune', vars: {} })
    expect(schema2).toEqual(schema1)
  })

  it('caches null schema when rune has no args() export', async () => {
    const f = join(tmp, 'rune.js')
    await writeFile(f, `export async function run() {}`)

    const schema1 = await getArgsSchema(f, effective, tmp, { runeKey: 'test-rune', vars: {} })
    expect(schema1).toBeNull()

    await writeFile(f, `this is not valid JS!!!`)

    const schema2 = await getArgsSchema(f, effective, tmp, { runeKey: 'test-rune', vars: {} })
    expect(schema2).toBeNull()
  })

  it('misses cache when vars change', async () => {
    const f = join(tmp, 'rune.js')
    await writeFile(f, `export function args(b) { return b.option('--verbose', 'v', false) }`)

    await getArgsSchema(f, effective, tmp, { runeKey: 'test-rune', vars: { env: 'prod' } })

    // Miss because vars differ
    const schema2 = await getArgsSchema(f, effective, tmp, { runeKey: 'test-rune', vars: { env: 'dev' } })
    expect(schema2).not.toBeNull() // re-evaluated successfully
  })

  it('skips cache when runeKey is null', async () => {
    const f = join(tmp, 'rune.js')
    await writeFile(f, `export function args(b) { return b.option('--verbose', 'v', false) }`)

    await getArgsSchema(f, effective, tmp, { runeKey: null, vars: {} })

    const { listSchemaCaches } = await import('../../src/rune/schema-cache.js')
    const entries = await listSchemaCaches(tmp)
    expect(entries).toHaveLength(0)
  })
})

describe('getReplSchema — schema cache', () => {
  let tmp

  beforeEach(async () => { tmp = await mkdtemp(join(tmpdir(), 'crunes-sc-repl-')) })
  afterEach(async () => { await rm(tmp, { recursive: true, force: true }) })

  const effective = { allow: [], deny: [] }

  it('caches argsRepl and commandsRepl and returns them on second call', async () => {
    const f = join(tmp, 'rune.js')
    await writeFile(f, `
export function argsRepl(b) { return b.option('--verbose', 'v', false) }
export function commandsRepl(b) { return b.command('run', 'Run it') }
export async function repl() {}
export async function inputRepl(input) { return { type: 'done' } }
`)

    const r1 = await getReplSchema(f, effective, [], tmp, { runeKey: 'test-rune', vars: {} })
    expect(r1.argsSchema.options[0].flags).toBe('--verbose')
    expect(r1.commandsSchema.commands[0].name).toBe('run')

    await writeFile(f, `this is not valid JS!!!`)

    const r2 = await getReplSchema(f, effective, [], tmp, { runeKey: 'test-rune', vars: {} })
    expect(r2).toEqual(r1)
  })

  it('caches null schemas when repl has no argsRepl/commandsRepl exports', async () => {
    const f = join(tmp, 'rune.js')
    await writeFile(f, `export async function repl() {} export async function inputRepl() { return { type: 'done' } }`)

    const r1 = await getReplSchema(f, effective, [], tmp, { runeKey: 'test-rune', vars: {} })
    expect(r1.argsSchema).toBeNull()
    expect(r1.commandsSchema).toBeNull()

    await writeFile(f, `this is not valid JS!!!`)

    const r2 = await getReplSchema(f, effective, [], tmp, { runeKey: 'test-rune', vars: {} })
    expect(r2.argsSchema).toBeNull()
    expect(r2.commandsSchema).toBeNull()
  })
})
```

Also add to the imports at the top of `test/rune/isolation/runner.test.js` (it already imports `getArgsSchema` — also add `getReplSchema`):
```js
import { runRuneInIsolate, runRuneInRepl, getArgsSchema, getReplSchema } from '../../../src/rune/isolation/runner.js'
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd c:/Users/DarkRymit/Playground/crunes/crunes-cli && npx vitest run test/rune/isolation/runner.test.js
```

Expected: all existing tests still pass + 7 new cache integration tests pass.

- [ ] **Step 5: Run full test suite**

```bash
cd c:/Users/DarkRymit/Playground/crunes/crunes-cli && npm test
```

Expected: all tests pass.

---

### Task 3: `crunes schema` CLI commands + gitignore + cleanup

**Files:**
- Create: `src/rune/commands/schema/list.js`
- Create: `src/rune/commands/schema/delete.js`
- Modify: `src/cli/program.js` — register `crunes schema list` and `crunes schema delete`
- Modify: `src/core/commands/init.js` — add `schemas/` to gitignore template
- Modify: `src/docs/intro-compiler.js` — remove dead `format === 'json'` branch

**Interfaces:**
- Consumes: `listSchemaCaches`, `deleteSchemaCache` from `src/rune/schema-cache.js`

- [ ] **Step 1: Create `src/rune/commands/schema/list.js`**

```js
import { listSchemaCaches } from '../../schema-cache.js'

function pad(s, n) { return String(s ?? '-').padEnd(n) }

export async function handler({ projectDir }) {
  const entries = await listSchemaCaches(projectDir)

  if (entries.length === 0) {
    console.log('No schema cache entries.')
    return
  }

  const cols = ['RUNE KEY', 'TYPE', 'CACHED AT', 'HASH']
  const rows = entries.map(e => [
    e.runeKey,
    e.type,
    new Date(e.cachedAt).toLocaleString(),
    e.hash.slice(0, 12) + '...',
  ])
  const widths = cols.map((c, i) => Math.max(c.length, ...rows.map(r => String(r[i] ?? '').length)))
  console.log(cols.map((c, i) => pad(c, widths[i])).join('  '))
  console.log(widths.map(w => '-'.repeat(w)).join('  '))
  for (const row of rows) {
    console.log(row.map((cell, i) => pad(cell, widths[i])).join('  '))
  }
}
```

- [ ] **Step 2: Create `src/rune/commands/schema/delete.js`**

```js
import { deleteSchemaCache, listSchemaCaches } from '../../schema-cache.js'
import { output } from '../../../shared/output.js'

export async function handler({ runeKey, projectDir }) {
  const before = await listSchemaCaches(projectDir)
  const matching = before.filter(e => e.runeKey === runeKey)
  if (matching.length === 0) {
    output.warn(`No schema cache entries found for "${runeKey}".`)
    return
  }
  await deleteSchemaCache(runeKey, projectDir)
  console.log(`Deleted ${matching.length} schema cache file(s) for "${runeKey}".`)
}
```

- [ ] **Step 3: Register commands in `src/cli/program.js`**

After the `cache` command block (around line 309), add:

```js
  // Schema cache management commands
  const schema = program.command('schema').description('Manage schema cache')

  schema
    .command('list')
    .description('List cached schemas for the current project')
    .action(async () => {
      const { handler } = await import('../rune/commands/schema/list.js')
      await handler({ projectDir: projectRoot() })
    })

  schema
    .command('delete <rune-key>')
    .description('Delete cached schema files for a rune key')
    .action(async (runeKey) => {
      const { handler } = await import('../rune/commands/schema/delete.js')
      await handler({ runeKey, projectDir: projectRoot() })
    })
```

- [ ] **Step 4: Add `schemas/` to gitignore in `src/core/commands/init.js`**

Find the `GITIGNORE_CONTENT` constant (line 7) and add `schemas/`:

```js
const GITIGNORE_CONTENT = '# local overrides (machine-specific, never commit)\nconfig.local.json\nproject.local.json\n\n# run logs\nlogs/\n\n# local caches, databases, schema cache and job logs (gitignored by default)\ncaches/\nschemas/\nsqlite/\njobs/\n';
```

- [ ] **Step 5: Remove dead `format === 'json'` branch from `src/docs/intro-compiler.js`**

Delete lines 177–196 (the `if (format === 'json') { return JSON.stringify(...) }` block). The `format` parameter is left in the function signature but the json branch is removed — callers passing `format: 'json'` will fall through to the text output, which is the correct behavior.

- [ ] **Step 6: Build and smoke-test the CLI**

```bash
cd c:/Users/DarkRymit/Playground/crunes/crunes-cli && npm run build && node dist/cli.js schema --help
```

Expected output includes:
```
Usage: crunes schema [options] [command]

Manage schema cache

Commands:
  list              List cached schemas for the current project
  delete <rune-key> Delete cached schema files for a rune key
```

- [ ] **Step 7: Run full test suite**

```bash
cd c:/Users/DarkRymit/Playground/crunes/crunes-cli && npm test
```

Expected: all tests pass.

- [ ] **Step 8: Commit everything**

```bash
cd c:/Users/DarkRymit/Playground/crunes/crunes-cli && git add src/rune/schema-cache.js src/rune/commands/schema/list.js src/rune/commands/schema/delete.js src/rune/isolation/runner.js src/cli/program.js src/core/commands/init.js src/docs/intro-compiler.js test/rune/schema-cache.test.js test/rune/isolation/runner.test.js
git commit -m "feat(schema): cache args/argsRepl/commandsRepl schemas to skip isolate on repeat invocations"
```
