# High-Performance WebSocket Binary Support Design

This specification defines the architecture, API, and implementation plan for introducing high-performance, sandboxed WebSocket binary transmission and reception in `crunes`.

## Overview & User Review Required

We are introducing raw binary support for runes using WebSocket connections. To ensure the API remains clean, performant, and developer-friendly, we are making the following decisions:
- **Symmetric Method Renaming (Breaking Change)**: The existing `.send(msg)` is renamed to `.sendText(msg)` for parity with `.sendBinary(data)`.
- **Separate Dedicated Events**: Instead of poly-typed arguments, incoming text frames will trigger `'message'` (providing a `string`), and binary frames will trigger `'binary'` (providing a `Uint8Array`).

## Proposed Changes

### 1. API Type Definitions
We will update [ws.d.ts](file:///c:/Users/DarkRymit/Playground/crunes/crunes-cli/src/rune/api/types/ws.d.ts) to define the new methods and event listeners:

```typescript
declare namespace ws {
  function client(url: string, opts?: { headers?: Record<string, string> }): WsHandle

  interface WsHandle {
    /** Register a text frame event handler. Call before open(). */
    on(event: 'message', fn: (msg: string) => void): void
    /** Register a binary frame event handler. Call before open(). */
    on(event: 'binary', fn: (data: Uint8Array) => void): void
    on(event: 'open', fn: () => void): void
    on(event: 'close', fn: (closeInfo: { code: number; reason: string }) => void): void
    on(event: 'error', fn: (err: WebSocketError) => void): void

    open(): Promise<void>
    
    /** Send a message string. Socket must be open first. */
    sendText(msg: string): Promise<void>
    
    /** Send binary data (ArrayBuffer or Uint8Array). Socket must be open first. */
    sendBinary(data: ArrayBuffer | Uint8Array): Promise<void>
    
    close(): Promise<{ code: number; reason: string }>
    closed(): Promise<{ code: number; reason: string }>
  }
}
```

---

### 2. Host-Side WebSocket Session: `crunes-cli/src/rune/api/ws.js`
We will:
- Update the native `message` event handler to check the second argument `isBinary` (provided by the `ws` package).
- For binary messages, slice the underlying buffer cleanly and pass the `ArrayBuffer` copy to the sandboxed VM using `arguments: { copy: true }` in `apply()`.
- Implement `sendText(msg)` and `sendBinary(arrayBuffer, byteOffset, byteLength)`. The latter utilizes Node.js's `Buffer.from(arrayBuffer, byteOffset, byteLength)` to wrap V8 memory with zero-copy.

---

### 3. Sandbox Isolate Bridge: `crunes-cli/src/rune/isolation/runner.js`
We will expose:
- `$__utils_ws_send_text` -> maps to `session.sendText(message)`
- `$__utils_ws_send_binary` -> maps to `session.sendBinary(arrayBuffer, byteOffset, byteLength)`

---

### 4. Sandbox Bootstrap: `crunes-cli/src/rune/isolation/utils-bootstrap.js`
We will:
- Map `.sendText()` and `.sendBinary()` into the returned client handle.
- Expose the `'binary'` event in the event dispatcher, converting the transferred raw `ArrayBuffer` back to a `Uint8Array` before invoking the user's callback.

---

## Verification Plan

### Automated Tests
1. **API/Unit Tests**: Write unit tests in `test/rune/api/ws.test.js` to cover:
   - Successful binary send and receive.
   - Text send and receive (verifying `.sendText()` works).
   - Type verification inside sandbox (asserting `Uint8Array` is received for binary frames).
   - Error handling for invalid parameters on `.sendBinary()`.

### Manual Verification
1. **Echo Binary Rune**: Write a test rune that connects to `wss://echo.websocket.org` (or a local test server), sends a binary frame containing sequential bytes, receives it, asserts the bytes are unchanged, and prints success.
