# WebSocket Binary Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement high-performance, sandboxed WebSocket binary transmission and reception via separate `.sendText()`/`.sendBinary()` methods and distinct `'message'`/`'binary'` events.

**Architecture:** Extend the `isolated-vm` bridge. Binary frames are received as Node `Buffer` objects, sliced to exact bounds, copied as `ArrayBuffer` values using `arguments: { copy: true }`, and wrapped in standard `Uint8Array` views in the sandbox. Outgoing binary frames are copied to the host and converted back to Node `Buffer` views with zero-copy.

**Tech Stack:** Node.js (v20+), `ws` npm library, `isolated-vm`, `vitest`

---

### Task 1: Update API TypeScript Definitions

**Files:**
- Modify: [ws.d.ts](file:///c:/Users/DarkRymit/Playground/crunes/crunes-cli/src/rune/api/types/ws.d.ts)

- [ ] **Step 1: Update types in ws.d.ts**
  Replace `.send` with `.sendText` and `.sendBinary`, and add `'binary'` event overload to `on`.
  Code change to apply:
  ```typescript
  /** WebSocket client for connecting to ws:// endpoints */
  declare namespace ws {
    /**
     * Creates a WebSocket client handle. Call open() before sending.
     * @param url WebSocket URL to connect to
     * @param opts Connection options
     */
    function client(url: string, opts?: { headers?: Record<string, string> }): WsHandle

    /** Live WebSocket connection handle returned by client() */
    interface WsHandle {
      /** Register a text frame event handler. Call before open(). */
      on(event: 'message', fn: (msg: string) => void): void
      /** Register a binary frame event handler. Call before open(). */
      on(event: 'binary', fn: (data: Uint8Array) => void): void
      on(event: 'open', fn: () => void): void
      on(event: 'close', fn: (closeInfo: { code: number; reason: string }) => void): void
      on(event: 'error', fn: (err: WebSocketError) => void): void
      /** Connect and resolve when socket is open */
      open(): Promise<void>
      /** Send a message string. Socket must be open first. */
      sendText(msg: string): Promise<void>
      /** Send binary data. Socket must be open first. */
      sendBinary(data: ArrayBuffer | Uint8Array): Promise<void>
      /** Close the connection gracefully. Idempotent. Returns code and reason when closed. */
      close(): Promise<{ code: number; reason: string }>
      /** Await connection closure (from client or server disconnect). Returns code and reason. */
      closed(): Promise<{ code: number; reason: string }>
    }

    interface WebSocketError extends Error {
      code?: string
    }
  }
  ```

- [ ] **Step 2: Commit type definition changes**
  Run:
  ```bash
  git add crunes-cli/src/rune/api/types/ws.d.ts
  git commit -m "feat(ws): update ws.d.ts to define sendText, sendBinary and binary event"
  ```

---

### Task 2: Update Host-Side Session Implementation

**Files:**
- Modify: [ws.js](file:///c:/Users/DarkRymit/Playground/crunes/crunes-cli/src/rune/api/ws.js)

- [ ] **Step 1: Modify WsSession message handling and implement sending methods**
  Update `open()` `'message'` event to check `isBinary` and cleanly slice incoming buffers. Add `sendText()` and `sendBinary()`. Remove the old `.send()`.
  Code changes:
  ```javascript
  // Inside open():
        socket.on('message', async (data, isBinary) => {
          if (isBinary) {
            const h = this.handlers.get('binary')
            if (h) {
              const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
              await h.apply(undefined, [arrayBuffer], { arguments: { copy: true }, result: { promise: true } }).catch(() => {})
            }
          } else {
            const h = this.handlers.get('message')
            if (h) await h.apply(undefined, [String(data)], { result: { promise: true } })
          }
        })
  ```
  And methods:
  ```javascript
    sendText(message) {
      if (this.state !== 'OPEN') throw new Error(`Cannot send in state ${this.state}`)
      return new Promise((resolve, reject) => {
        this.socket.send(message, (err) => (err ? reject(err) : resolve()))
      })
    }

    sendBinary(arrayBuffer, byteOffset, byteLength) {
      if (this.state !== 'OPEN') throw new Error(`Cannot send in state ${this.state}`)
      return new Promise((resolve, reject) => {
        const buffer = Buffer.from(arrayBuffer, byteOffset, byteLength)
        this.socket.send(buffer, (err) => (err ? reject(err) : resolve()))
      })
    }
  ```

- [ ] **Step 2: Commit host session changes**
  Run:
  ```bash
  git add crunes-cli/src/rune/api/ws.js
  git commit -m "feat(ws): implement message/binary bifurcation in WsSession, sendText, and sendBinary"
  ```

---

### Task 3: Update Sandbox Isolate Bridge

**Files:**
- Modify: [runner.js](file:///c:/Users/DarkRymit/Playground/crunes/crunes-cli/src/rune/isolation/runner.js)

- [ ] **Step 1: Bind sandboxed $__utils_ws_send_text and $__utils_ws_send_binary**
  In `runner.js`, replace the old `$__utils_ws_send` reference binding with separate text and binary functions.
  Code changes in `runner.js` around line 280:
  ```javascript
    await jail.set('$__utils_ws_send_text', new ivm.Reference(async (sessionId, message) => {
      await utils.ws._getSession(sessionId).sendText(message)
    }))
    await jail.set('$__utils_ws_send_binary', new ivm.Reference(async (sessionId, arrayBuffer, byteOffset, byteLength) => {
      await utils.ws._getSession(sessionId).sendBinary(arrayBuffer, byteOffset, byteLength)
    }))
  ```

- [ ] **Step 2: Commit bridge changes**
  Run:
  ```bash
  git add crunes-cli/src/rune/isolation/runner.js
  git commit -m "feat(ws): expose $__utils_ws_send_text and $__utils_ws_send_binary references to the isolate"
  ```

---

### Task 4: Update Sandbox Bootstrap

**Files:**
- Modify: [utils-bootstrap.js](file:///c:/Users/DarkRymit/Playground/crunes/crunes-cli/src/rune/isolation/utils-bootstrap.js)

- [ ] **Step 1: Wire sendText, sendBinary and binary event wrapping**
  Update the `ws` object returned by `globalThis.utils.ws.client()`. Add `'binary'` event translation to instantiate `new Uint8Array(arrayBuffer)`. Add `.sendText()` and `.sendBinary()` mappings. Remove old `.send()`.
  Code changes in `utils-bootstrap.js` around line 180:
  ```javascript
        on(event, handler) {
          const isolateHandler = event === 'error'
            ? async (errJson) => {
                let d
                try { d = JSON.parse(errJson) }
                catch { d = { message: errJson } }
                const errorObj = new Error(d.message)
                errorObj.name = 'WebSocketError'
                if (d.code) errorObj.code = d.code
                if (d.stack) errorObj.stack = d.stack
                handler(errorObj)
              }
            : event === 'binary'
            ? async (arrayBuffer) => {
                handler(new Uint8Array(arrayBuffer))
              }
            : handler
          $__utils_ws_on.applySync(undefined, [id, event, isolateHandler], {
            arguments: { reference: true },
          })
        },
        open:  () => $__utils_ws_open.apply(undefined,  [id], { result: { promise: true } }),
        
        sendText: (msg) => $__utils_ws_send_text.apply(undefined, [id, msg], { result: { promise: true } }),
        
        sendBinary: (data) => {
          if (data instanceof Uint8Array) {
            return $__utils_ws_send_binary.apply(undefined, [id, data.buffer, data.byteOffset, data.byteLength], {
              arguments: { copy: true },
              result: { promise: true }
            })
          } else if (data instanceof ArrayBuffer) {
            return $__utils_ws_send_binary.apply(undefined, [id, data, 0, data.byteLength], {
              arguments: { copy: true },
              result: { promise: true }
            })
          } else {
            throw new TypeError('sendBinary requires an ArrayBuffer or Uint8Array')
          }
        },
  ```

- [ ] **Step 2: Commit sandbox bootstrap changes**
  Run:
  ```bash
  git add crunes-cli/src/rune/isolation/utils-bootstrap.js
  git commit -m "feat(ws): wire sendText, sendBinary and binary event conversion in sandbox bootstrap"
  ```

---

### Task 5: Implement and Verify Unit Tests

**Files:**
- Modify: [ws.test.js](file:///c:/Users/DarkRymit/Playground/crunes/crunes-cli/test/rune/api/ws.test.js)

- [ ] **Step 1: Write text & binary tests in ws.test.js**
  We will update `ws.test.js` to assert both `.sendText()` and `.sendBinary()` functionality, as well as separate receive handlers.
  Let's replace the existing tests or add new ones validating the new signatures.
  Code/Tests to write in `test/rune/api/ws.test.js`:
  ```javascript
  import { describe, it, expect, beforeAll, afterAll } from 'vitest'
  import { WebSocketServer } from 'ws'
  import { runRuneInIsolate } from '../../../src/rune/isolation/runner.js'
  import fs from 'node:fs/promises'
  import path from 'node:path'
  import { fileURLToPath } from 'node:url'

  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const testRuneFile = path.join(__dirname, 'test-ws-binary.js')

  describe('WebSocket Binary API inside Isolate', () => {
    let wss
    let port

    beforeAll(() => {
      wss = new WebSocketServer({ port: 0 })
      port = wss.address().port

      wss.on('connection', (ws) => {
        ws.on('message', (message, isBinary) => {
          if (isBinary) {
            // Echo binary directly back
            ws.send(message, { binary: true })
          } else {
            // Echo text back as upper case
            ws.send(String(message).toUpperCase())
          }
        })
      })
    })

    afterAll(async () => {
      await fs.unlink(testRuneFile).catch(() => {})
      wss.close()
    })

    it('successfully sends/receives text and high-performance binary arrays', async () => {
      const runeSrc = `
        import { ws } from '@utils'
        export async function use() {
          const client = ws.client('ws://localhost:${port}')
          const textPromise = new Promise(resolve => {
            client.on('message', (msg) => resolve(msg))
          })
          const binaryPromise = new Promise(resolve => {
            client.on('binary', (data) => resolve(data))
          })

          await client.open()
          
          await client.sendText('hello')
          const textResult = await textPromise

          const sendArr = new Uint8Array([10, 20, 30])
          await client.sendBinary(sendArr)
          const binaryResult = await binaryPromise

          await client.close()
          
          return {
            textResult,
            binaryIsUint8: binaryResult instanceof Uint8Array,
            binaryBytes: Array.from(binaryResult)
          }
        }
      `
      await fs.writeFile(testRuneFile, runeSrc)
      const res = await runRuneInIsolate(testRuneFile, { allow: ['*'], deny: [] }, [], __dirname)
      expect(res).toEqual({
        textResult: 'HELLO',
        binaryIsUint8: true,
        binaryBytes: [10, 20, 30]
      })
    })
  })
  ```

- [ ] **Step 2: Run test suite to verify implementation**
  Run: `npm test` or `npx vitest test/rune/api/ws.test.js --run`
  Expected: All tests pass!

- [ ] **Step 3: Commit tests**
  Run:
  ```bash
  git add crunes-cli/test/rune/api/ws.test.js
  git commit -m "test(ws): add comprehensive tests for sandboxed WebSocket binary transmission"
  ```

---

### Task 6: Documentation and Clean Up

**Files:**
- Modify: [SKILL.md](file:///c:/Users/DarkRymit/Playground/crunes/crunes-aci/skills/crunes-help/SKILL.md)
- Modify: [echo.js](file:///c:/Users/DarkRymit/Playground/crunes/examples/ws/.crunes/runes/echo.js)

- [ ] **Step 1: Update API documentation references in crunes-help/SKILL.md**
  Update the documented signatures for `ws` helper inside `crunes-aci/skills/crunes-help/SKILL.md`.
  Replace mentions of `.send()` with `.sendText()` and `.sendBinary()`, and `'message'` / `'binary'` events.

- [ ] **Step 2: Update example rune echo.js**
  Modify [echo.js](file:///c:/Users/DarkRymit/Playground/crunes/examples/ws/.crunes/runes/echo.js) to use the new `.sendText()` API instead of the old `.send()`.

- [ ] **Step 3: Run full monorepo CI validation**
  Run:
  ```bash
  npm run build
  npm test
  ```

- [ ] **Step 4: Commit documentation and example updates**
  Run:
  ```bash
  git add crunes-aci/skills/crunes-help/SKILL.md examples/ws/.crunes/runes/echo.js
  git commit -m "docs(ws): update ws documentation and example to use sendText"
  ```
