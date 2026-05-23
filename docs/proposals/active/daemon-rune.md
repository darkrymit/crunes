---
tags:
  - proposed
---

# Proposal: Daemon Runes (`crunes daemon`)

## Overview

A daemon rune is a rune that manages the lifecycle of a long-running external process — a dev server, a database, a watch process, a test fixture — that needs to outlive a single `crunes use` call. It exports `start()` instead of `use()`, and optionally `stop()` and `status()`. The CLI manages a PID registry; `crunes daemon start/stop/status/list` drives the lifecycle.

## Hard Constraint: Runes Cannot Be the Process

A rune runs inside an `isolated-vm` context with a wall-clock timeout. It cannot host a socket, listen on a port, or run an event loop. **A daemon rune does not run as the daemon** — it runs a short script that launches an external process, then exits. The external process is what stays alive.

This distinction is load-bearing. Any design that attempts to keep the isolate alive is a non-starter.

## Motivation

The canonical friction point: a rune that uses `utils.ws` or `utils.fetch` needs a running server to test against. Today the developer has to:

1. Open a second terminal
2. Start the server manually (`node echo-server.mjs`)
3. Run the rune
4. Remember to kill the server later

A daemon rune makes this a single command per step — `crunes daemon start echo-server`, `crunes use ws-test`, `crunes daemon stop echo-server` — with the CLI tracking the process so nothing leaks.

Other use cases: database fixtures, mock HTTP APIs, file watchers, language servers, background compilers.

## New Primitive: `utils.process.spawn`

The isolation layer has no way to launch a detached process today. A new bridge function is needed:

```js
const handle = await utils.process.spawn(cmd, args?, opts?)
// handle: { pid: number }
```

| Parameter | Type | Description |
|---|---|---|
| `cmd` | `string` | Executable path or name |
| `args` | `string[]` | Argument list (default: `[]`) |
| `opts.cwd` | `string` | Working directory (default: project root) |
| `opts.env` | `Record<string, string>` | Additional env vars merged with `process.env` |
| `opts.stdout` | `string` | Relative path for stdout log file (default: none) |
| `opts.stderr` | `string` | Relative path for stderr log file (default: none) |

The host calls `child_process.spawn(cmd, args, { detached: true, stdio: 'ignore' })` and immediately calls `child.unref()` so the crunes process can exit. Returns `{ pid: child.pid }`.

`utils.process.spawn` is only permitted in daemon rune exports (`start`, `stop`, `status`). Calling it from `use()` throws a `PermissionError`.

## Daemon Rune Shape

```js
// .crunes/runes/echo-server.js
import { process as proc } from '@utils'

export async function args(b) {
  return b
    .positional('[port]', 'Port to listen on', 3099)
    .build()
}

export async function start(args) {
  const port = args._[0] ?? 3099
  const { pid } = await proc.spawn('node', ['../examples/ws/echo-server.mjs', String(port)], {
    stdout: '.crunes/logs/echo-server.log',
    stderr: '.crunes/logs/echo-server.err',
  })
  return section.create('started', {
    type: 'markdown',
    content: `Echo server started on port ${port} (pid ${pid})`,
  })
}

// stop() is optional — CLI falls back to SIGTERM on stored PID
export async function stop({ pid }) {
  await proc.kill(pid, 'SIGTERM')
  return section.create('stopped', {
    type: 'markdown',
    content: `Echo server (pid ${pid}) stopped`,
  })
}

// status() is optional — CLI falls back to process.kill(pid, 0) liveness check
export async function status({ pid }) {
  const alive = await proc.exists(pid)
  return section.create('status', {
    type: 'markdown',
    content: alive ? `Echo server running (pid ${pid})` : 'Echo server not running',
  })
}
```

If `stop()` is omitted, the CLI sends SIGTERM to the stored PID.
If `status()` is omitted, the CLI checks liveness via `process.kill(pid, 0)`.

## CLI: `crunes daemon`

```bash
crunes daemon start <key> [rune-args...]   # run start(), store PID in registry
crunes daemon stop  <key>                  # run stop() or SIGTERM stored PID
crunes daemon status <key>                 # run status() or check PID liveness
crunes daemon list                         # show all registered daemons + status
crunes daemon clean                        # remove stale registry entries (dead PIDs)
```

The daemon registry lives at `.crunes/daemons.json` (project-scoped). Format:

```json
{
  "echo-server": {
    "pid": 12345,
    "startedAt": "2026-05-23T01:00:00.000Z",
    "args": ["3099"]
  }
}
```

`crunes daemon list` output:

```
  echo-server   running   pid 12345   started 2026-05-23 01:00
  db-fixture    stopped   (no pid)
```

## Permissions

A new `process.spawn` permission class, URL-free and coarse-grained:

```json
{
  "runes": {
    "echo-server": {
      "permissions": {
        "start": { "allow": ["process.spawn"] },
        "stop":  { "allow": ["process.spawn"] }
      }
    }
  }
}
```

`process.spawn` is only grantable on `start`, `stop`, and `status` permission scopes — not on `use`. This prevents regular runes from launching detached processes.

## `utils.process` API surface

```ts
declare namespace process {
  /**
   * Spawns a detached process that outlives the crunes call.
   * Only available in daemon rune exports (start, stop, status).
   */
  function spawn(cmd: string, args?: string[], opts?: {
    cwd?: string
    env?: Record<string, string>
    stdout?: string
    stderr?: string
  }): Promise<{ pid: number }>

  /**
   * Sends a signal to a process. Defaults to SIGTERM.
   */
  function kill(pid: number, signal?: string): Promise<void>

  /**
   * Returns true if the process with the given PID is still running.
   */
  function exists(pid: number): Promise<boolean>
}
```

## What This Does Not Cover

- **Process supervision**: If the daemon crashes, it stays dead. Restart-on-failure is out of scope for v1.
- **In-process daemons**: Runes cannot host a server. `proc.spawn` launches an external executable — the rune itself is never the server.
- **Global daemon registry**: Daemons are project-scoped. Cross-project daemon management is not addressed.
- **Log streaming**: Daemon output goes to a log file. There is no `crunes daemon logs <key> --follow` in v1.
- **Windows process groups**: Detached process trees on Windows behave differently. `spawn` uses `child_process.spawn({ detached: true })` which on Windows starts a new console window. Log-to-file (`stdout`, `stderr` opts) suppresses that. Full Windows process group teardown (killing child processes of the daemon) is out of scope.
- **Port availability checks**: The rune is responsible for verifying the server is ready (e.g. polling via `utils.fetch`) if callers need that guarantee.

## Implementation Groundwork

1. **`utils.process` host module** (`src/rune/api/process.js`) — thin wrapper around `child_process.spawn` with `{ detached: true }` and `child.unref()`. `kill` wraps `process.kill(pid, signal)`. `exists` wraps `process.kill(pid, 0)` inside a try/catch.

2. **Isolate bridge** — Register `$__utils_process_spawn`, `$__utils_process_kill`, `$__utils_process_exists` in `runner.js` following the same bridge pattern as other utils. Guard: check that the current export being executed is `start`, `stop`, or `status` — throw `PermissionError` if called from `use`.

3. **Bootstrap** — Wire `utils.process` in `utils-bootstrap.js`. Add to the `.d.ts` at `src/rune/api/types/process.d.ts`.

4. **Permission class** — Add `process.spawn` to `src/rune/permissions/permissions.js`. The permission is binary (no URL glob needed).

5. **Daemon registry** — `src/rune/daemon/registry.js`. Read/write `.crunes/daemons.json`. Provides `register(key, pid, args)`, `unregister(key)`, `get(key)`, `list()`, `clean()` (removes entries where `proc.exists(pid)` is false).

6. **`crunes daemon` command** — `src/cli/commands/daemon.js` with `start`, `stop`, `status`, `list`, `clean` subcommands. `start` runs the rune's `start()` export via the existing runner, writes the returned PID to the registry. `stop` reads the PID, runs `stop()` export if present, falls back to SIGTERM. `status` runs `status()` export if present, falls back to liveness check.

7. **Runner changes** — `runner.js` needs to accept a `exportName` parameter so the CLI can run `start()` / `stop()` / `status()` instead of `use()`. The timeout for daemon start/stop calls should be shorter (e.g. 5s) since they should return immediately after spawning.
