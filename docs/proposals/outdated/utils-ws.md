---
tags:
  - completed
---

# Proposal: WebSocket Client (`utils.ws`)

## Overview

This proposal introduces `utils.ws`, a permission-gated WebSocket client that lets runes open persistent, bidirectional connections to external WebSocket servers. The API is designed around explicit lifecycle management — create, open, use, close — with event-driven message handling that supports both simple request-response and complex concurrent protocols.

`utils.ws` is scoped to client connections. A future `utils.ws.server()` API for hosting a WebSocket server is planned but not in scope here.

## Motivation

Runes that interact with streaming APIs, real-time backends, or services using WebSocket-based protocols (chat servers, dev servers, LSP transports, event buses) currently have no path inside the sandbox — `utils.fetch` covers HTTP but not persistent connections. The only workaround is a standalone Node.js script outside the rune system entirely, which loses all the rune benefits (composition, section output, permission gating, caching).

A concrete example: a rune that sends a message to an AI chat backend and streams the response back as a section. This requires opening a WS connection, sending one message, receiving a stream of `TEXT_DELTA` events until `COMPLETE`, and returning the accumulated text as a markdown section. `utils.ws` makes this natural.

## API

### `ws.client(url, options?)`

Creates a socket handle — no connection is made yet.

```js
const socket = ws.client('ws://localhost:3000')
const socket = ws.client('wss://api.example.com/stream', {
  headers: { Authorization: 'Bearer token' },
})
```

Options:

| Option | Type | Description |
|---|---|---|
| `headers` | `Record<string, string>` | HTTP headers sent during the WebSocket handshake |

### Lifecycle

```js
// 1. Register event handlers — before open(), guaranteed no missed events
socket.on('open',    ()           => { /* connection established */ })
socket.on('message', async (msg) => { /* msg is a string */ })
socket.on('error',   (err)        => { /* err.message describes the failure */ })
socket.on('close',   ()           => { /* connection ended */ })

// 2. Open — resolves when the handshake completes, throws on failure
await socket.open()

// 3. Send — callable at any time after open
await socket.send(JSON.stringify({ type: 'ping' }))

// 4. Close — idempotent, always-awaitable
//    First call initiates a graceful close; subsequent calls return the same settling promise.
//    Call from inside a handler (fire-and-forget) or from the outer scope (await) — both work.
await socket.close()
```

**State machine:** `CREATED → OPEN → CLOSED`. Calling `send()` before `open()` or after `close()` throws. Calling `open()` on an already-open or closed socket throws. Calling `close()` on an already-closing or closed socket is a no-op that returns the same promise.

### Patterns

**Event streaming — receive until server signals done:**

```js
const socket = ws.client(`${wsBase}/ws/chat/${chatId}`)
let output = ''

socket.on('message', async (raw) => {
  const event = JSON.parse(raw)
  if (event.type === 'TEXT_DELTA')               output += event.textContent ?? ''
  if (event.type === 'ERROR')                    throw new Error(event.errorCode)
  if (event.type === 'COMPLETE' || event.type === 'STOPPED') socket.close()
})

await socket.open()
await socket.send(JSON.stringify({ type: 'MESSAGE', text: args._[0] }))
await socket.close()   // waits for close, whether triggered by handler or here

return section.create('response', { type: 'markdown', content: output })
```

**Bidirectional protocol — ping-pong, negotiation, concurrent sends:**

```js
const socket = ws.client('ws://localhost:9229/json')

socket.on('message', async (raw) => {
  const msg = JSON.parse(raw)
  if (msg.method === 'ping') await socket.send(JSON.stringify({ method: 'pong' }))
  if (msg.type === 'result') socket.close()
})

await socket.open()
await socket.send(JSON.stringify({ id: 1, method: 'subscribe', params: {} }))
await socket.close()
```

**Simple request-response:**

```js
const socket = ws.client('ws://localhost:3000')
socket.on('message', async (raw) => {
  // handle reply
  socket.close()
})
await socket.open()
await socket.send(JSON.stringify({ type: 'query', q: args._[0] }))
await socket.close()
```

### Notes

- Messages are strings. Binary frames are out of scope for v1.
- `on('message', handler)` may be async — the host awaits each handler before processing the next message to preserve ordering.
- Auto-close on rune exit: if the rune finishes without calling `close()`, the framework terminates any open connections before disposing the isolate.

## Permissions

`ws` permissions are URL-scoped using micromatch glob patterns — matching the same format as `fetch` permissions. Each `ws:<url-glob>` entry grants access to connect to URLs matching that pattern.

```json
{
  "runes": {
    "chat": {
      "permissions": {
        "use": {
          "allow": [
            "ws:ws://localhost:3000/**",
            "fetch:POST:http://localhost:3000/graphql",
            "env.get",
            "cache"
          ]
        }
      }
    }
  }
}
```

When `ws.client(url)` is called, the runtime checks the URL against all `ws:` patterns in the allow list using micromatch. If none match, a `PermissionError` is thrown.

Examples:

| Permission | Grants access to |
|---|---|
| `ws:ws://localhost:3000/**` | Any path on `ws://localhost:3000` |
| `ws:wss://api.example.com/**` | Any path on `wss://api.example.com` |
| `ws:**` | Any WebSocket URL (use with caution) |

The standard isolate timeout applies — runes using `ws` are subject to the same wall-clock limit as all other runes. Long-running or daemon-style socket connections are out of scope for v1.

## Implementation Groundwork

1. **Host** — Add `src/rune/api/utils/ws.js`. Maintain a session registry (`Map<number, WsSession>`) scoped to each `createUtils` call. Each `WsSession` owns a `ws.WebSocket` instance, event handler references, and a `closed` promise with its resolver. `open()` starts the connection and resolves when the `open` event fires. `close()` sends a clean close frame and resolves when the `close` event fires.

2. **Callback bridge** — `socket.on(event, handler)` in the isolate passes an `ivm.Reference` to the host via `$__utils_ws_on`. The host stores the reference per session per event type and calls `ref.apply(undefined, [payload], { result: { promise: true } })` when the event fires. This pattern follows `utils.prompt`'s host→isolate callback model.

3. **Isolate bridge** — Register the following `ivm.Reference` callbacks in `runner.js`:
   - `$__utils_ws_client(url, optionsJson)` → returns integer session ID
   - `$__utils_ws_on(sessionId, event, callbackRef)` → registers handler reference
   - `$__utils_ws_open(sessionId)` → connects; resolves on open, rejects on error
   - `$__utils_ws_send(sessionId, message)` → sends string frame
   - `$__utils_ws_close(sessionId)` → idempotent; initiates graceful close on first call, resolves when the connection ends; subsequent calls return the same settling promise

4. **Bootstrap** — Wire `utils.ws.client(url, opts)` in `utils-bootstrap.js`. Returns a plain object `{ on, open, send, close }` closing over the session ID. Follows the same handle pattern as `utils.lsp.connect()` and `utils.sqlite.open()`.

5. **Permission wiring** — Add `src/rune/permissions/permissions-ws.js` with a `matchWsPermission(url, pattern)` function using micromatch, following the same structure as `permissions-http.js`. Register it in `src/rune/permissions/permissions.js`. The value checked is the full WebSocket URL; the pattern body (after stripping `ws:`) is the glob.

6. **Cleanup** — Extend `createUtils`'s `dispose()` hook to iterate the WS session registry and call `socket.terminate()` on any sessions still in the `OPEN` state, consistent with how `utils.lsp` and `utils.sqlite` handle their cleanup.
