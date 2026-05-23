---
tags:
  - completed
---

# Proposal: Background Rune Execution (`rune.spawn`)

## Overview

Extend the `rune` utils namespace into a proper object API, adding `rune.spawn` for background execution alongside the existing synchronous call. This requires a **breaking migration** from the current callable syntax (`rune(key, args)`) to an explicit method syntax (`rune.use(key, args)`).

```js
// Before (current, deprecated by this change)
const sections = await rune('other-rune', ['arg1'])

// After
const sections = await rune.use('other-rune', ['arg1'])     // synchronous, waits for result
const job      = await rune.spawn('worker-rune', ['arg1'])  // async, returns immediately
const alive    = await rune.exists(job.id)
await rune.kill(job.id)
```

No new CLI subcommand, no special rune export shape, no new utils namespace.

## Migration: `rune()` → `rune.use()`

The current API exposes `rune` as a plain async function (`rune(key, args)`). This proposal changes it to a namespace object. The breaking change:

| Before | After |
|---|---|
| `await rune(key, args)` | `await rune.use(key, args)` |
| `import { rune } from '@utils'` | unchanged |

All runes that currently call `rune(key, args)` must be updated to `rune.use(key, args)`. No other behaviour changes — `rune.use` is semantically identical to the old `rune` call.

## Full `rune` Namespace

```ts
declare namespace rune {
  /**
   * Calls another rune synchronously. Equivalent to the former rune(key, args) callable.
   * Waits for the target rune to complete and returns its Section[].
   */
  function use(key: string, args?: string[]): Promise<Section[]>

  /**
   * Starts a rune as a detached background job.
   * Returns immediately with a stable job id.
   * The background rune runs with no isolate timeout.
   */
  function spawn(key: string, args?: string[]): Promise<{ id: string }>

  /**
   * Sends a signal to a background job. Defaults to SIGTERM.
   * No-op if the job is already stopped.
   */
  function kill(id: string, signal?: string): Promise<void>

  /**
   * Returns true if the background job is still running.
   */
  function exists(id: string): Promise<boolean>
}
```

## Usage Pattern

```js
import { rune, json, section } from '@utils'

export async function use(args) {
  const action = args._[0] ?? 'status'
  const stateFile = '.crunes/state/server.json'

  if (action === 'start') {
    const port = args._[1] ?? '3099'
    const job = await rune.spawn('server-worker', [port])
    await json.write(stateFile, { id: job.id })
    return section.create('started', {
      type: 'markdown',
      content: `Server starting on port ${port} (job ${job.id})`,
    })
  }

  if (action === 'stop') {
    const { id } = await json.read(stateFile)
    await rune.kill(id)
    return section.create('stopped', { type: 'markdown', content: `Job ${id} stopped` })
  }

  // compose with another rune synchronously — note rune.use() syntax
  const meta = await rune.use('project-meta', [])

  // status
  const state = await json.read(stateFile).catch(() => null)
  if (!state?.id) return section.create('status', { type: 'markdown', content: 'Not running' })
  const alive = await rune.exists(state.id)
  return section.create('status', {
    type: 'markdown',
    content: alive ? `Running (job ${state.id})` : `Stopped (job ${state.id})`,
  })
}
```

The background rune (`server-worker`) is a plain rune — no special export shape:

```js
// .crunes/runes/server-worker.js
import { shell, section } from '@utils'

export async function use(args) {
  const port = args._[0] ?? '3099'
  // runs indefinitely — no timeout in background mode
  await shell(`node examples/server.mjs ${port}`, { timeout: 0 })
  return section.create('done', { type: 'markdown', content: 'Server exited' })
}
```

## How `rune.spawn` Works

`rune.spawn(key, args)` forks a new detached `node dist/cli.js use <key> [args...]` process with `{ detached: true }` and calls `child.unref()` immediately so the calling crunes process can exit. The background crunes process runs the target rune via the normal execution path with **no isolate timeout**. A job record `{ id, pid, startedAt }` is written to `.crunes/jobs/<id>.json`. The `id` is a short UUID — callers never handle PIDs directly.

The background rune resolves permissions and runs exactly as if invoked via `crunes use` directly.

## Permissions

`rune.use` (synchronous call) inherits the target rune's permissions, same as the current `rune()` behaviour. The new methods require explicit permission:

```json
{
  "runes": {
    "server": {
      "permissions": {
        "use": {
          "allow": ["rune.spawn", "rune.kill", "rune.exists"]
        }
      }
    }
  }
}
```

## Job Identity

`rune.spawn` returns `{ id: string }`. The host writes `.crunes/jobs/<id>.json` (`{ id, pid, startedAt }`) so `kill` and `exists` resolve the OS PID from the stable `id` without the rune author ever handling PIDs directly.

## What This Does Not Cover

- **Log monitoring**: `console.log` output from the background rune is not surfaced via the API. Deferred to a follow-up.
- **Structured results**: `rune.spawn` returns `{ id }` only. The background rune's `Section[]` output is not returned to the caller; result sharing goes through state files (`utils.json`/`utils.fs`).
- **Restart-on-failure**: If the background rune exits or throws, it stays stopped.
- **Cross-project jobs**: Job records are project-scoped (`.crunes/jobs/`).
- **`crunes daemon` CLI**: All lifecycle management goes through `crunes use`.
- **Windows process groups**: Teardown of child processes spawned by the background rune is out of scope.

## Implementation Groundwork

1. **`utils-bootstrap.js` — `rune` callable → namespace object**: Replace `rune: (key, args) => ...` with an object `{ use, spawn, kill, exists }`. `use` is the former callable. This is the breaking change.

2. **`runner.js` — new References**: Add `$__utils_rune_spawn`, `$__utils_rune_kill`, `$__utils_rune_exists` alongside the existing `$__utils_rune` (kept for any backward-compat shim period). `spawn` forks the CLI with `{ detached: true }`, unrefs, writes the job record, returns `{ id }`. `kill` reads the job record and calls `process.kill(pid, signal ?? 'SIGTERM')`. `exists` wraps `process.kill(pid, 0)` in a try/catch.

3. **Job registry**: `src/rune/jobs/registry.js` — reads/writes `.crunes/jobs/<id>.json`. Provides `create(pid)` → `{ id }`, `get(id)` → `{ pid }`, `clean()` (removes records for dead PIDs).

4. **Permission classes**: Add `rune.spawn`, `rune.kill`, `rune.exists` to `src/rune/permissions/permissions.js`.

5. **Background timeout**: Add a `CRUNES_NO_TIMEOUT` env var (set by the spawning process) that makes the runner pass `undefined` instead of `isolateTimeoutMs` to `context.eval`, disabling the isolate timeout for background jobs.

6. **`rune.d.ts`**: Update `src/rune/api/types/rune.d.ts` to declare the full namespace (`use`, `spawn`, `kill`, `exists`).

7. **Migration**: Scan all runes in `.crunes/runes/` and plugin rune files for `rune(` calls and replace with `rune.use(`. Update KB, SKILL.md, and any examples.
