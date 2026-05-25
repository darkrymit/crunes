# Release Readiness Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all case-sensitivity, batching, SQLite type, documentation, and WebSocket defects in the crunes monorepo to prepare for a clean, stable release.

**Architecture:** Programmatic batch flag support in hook-wrapper, regex-based lowercase boundary filters, async Promise-returning type specifications for VM SQLite operations, full native host-to-sandbox Error instantiation, and host-level closedPromise socket lifecycle management.

**Tech Stack:** Node.js, isolated-vm, ws, Vitest.

---

### Task 1: ACI Hook Wrapper Improvements

**Files:**
- Modify: [hook-wrapper.js](file:///c:/Users/DarkRymit/Playground/crunes/crunes-aci/scripts/hook-wrapper.js)
- Modify: [hook-wrapper.test.js](file:///c:/Users/DarkRymit/Playground/crunes/crunes-aci/scripts/hook-wrapper.test.js)

- [ ] **Step 1: Implement case sensitivity and batching in `hook-wrapper.js`**
  Modify [hook-wrapper.js](file:///c:/Users/DarkRymit/Playground/crunes/crunes-aci/scripts/hook-wrapper.js#L9-L38):
  *   Update the `TOKEN_REGEX` to require the key starts with a lowercase letter `[a-z]`.
  *   Update `buildCliArgs` to push `'-b'` to `cliArgs` when `tokens.length > 1`.
  
  ```javascript
  // Line 9:
  const TOKEN_REGEX = /\$([a-z][\w@-]*(?::(?!:)[\w@-]+)*)(?:\(([^)]*)\))?(?:::([^$\s]*))?/g
  
  // Line 25-38:
  function buildCliArgs(tokens) {
    const cliArgs = ['use', '--format', 'json']
    if (tokens.length > 1) {
      cliArgs.push('-b')
    }
    for (let i = 0; i < tokens.length; i++) {
      if (i > 0) cliArgs.push('+')
      const { key, rawArgs, rawSections } = tokens[i]
      if (rawSections) cliArgs.push('--section', rawSections)
      cliArgs.push(key)
      if (rawArgs) {
        const args = rawArgs.split(',').map(a => a.trim()).filter(Boolean)
        cliArgs.push(...args)
      }
    }
    return cliArgs
  }
  ```

- [ ] **Step 2: Update assertions in `hook-wrapper.test.js`**
  Modify [hook-wrapper.test.js](file:///c:/Users/DarkRymit/Playground/crunes/crunes-aci/scripts/hook-wrapper.test.js#L8-L88):
  *   Ensure test assertions expect that uppercase variable tokens (like `$PATH` or `$100`) return empty results (they do not match lowercase regex).
  *   Ensure the two-tokens batch test expects `'-b'` to be generated in `buildCliArgs`.
  
  ```javascript
  // Add uppercase/numeric regex checks around line 9:
  assert.deepEqual(parseTokens('$PATH'), [], 'uppercase env variable ignored')
  assert.deepEqual(parseTokens('$100'), [], 'price/numeric ignored')

  // Update line 81-88:
  assert.deepEqual(
    buildCliArgs([
      { key: 'docs', rawArgs: '', rawSections: '' },
      { key: 'api', rawArgs: 'v2', rawSections: 'endpoints' },
    ]),
    ['use', '--format', 'json', '-b', 'docs', '+', '--section', 'endpoints', 'api', 'v2'],
    'two tokens joined with + and programmatically batched'
  )
  ```

- [ ] **Step 3: Run hook-wrapper tests and verify they pass**
  Run:
  ```bash
  node crunes-aci/scripts/hook-wrapper.test.js
  ```
  Expected Output: `All tests passed.`

- [ ] **Step 4: Commit ACI Hook Wrapper changes**
  Run:
  ```bash
  git add crunes-aci/scripts/hook-wrapper.js crunes-aci/scripts/hook-wrapper.test.js
  git commit -m "feat(aci): restrict token key to lowercase and implement programmatic batch flag"
  ```

---

### Task 2: API Type Definitions Alignment

**Files:**
- Modify: [sqlite.d.ts](file:///c:/Users/DarkRymit/Playground/crunes/crunes-cli/src/rune/api/types/sqlite.d.ts)
- Modify: [http.d.ts](file:///c:/Users/DarkRymit/Playground/crunes/crunes-cli/src/rune/api/types/http.d.ts)
- Modify: [crunes-help/SKILL.md](file:///c:/Users/DarkRymit/Playground/crunes/crunes-aci/skills/crunes-help/SKILL.md)

- [ ] **Step 1: Make SQLite types asynchronous in `sqlite.d.ts`**
  Modify [sqlite.d.ts](file:///c:/Users/DarkRymit/Playground/crunes/crunes-cli/src/rune/api/types/sqlite.d.ts#L10-L21) to wrap returns in `Promise`:
  ```typescript
  interface SqliteHandle {
    /** Run a SELECT and return all rows */
    query(sql: string, params?: unknown[]): Promise<unknown[]>
    /** Run a SELECT and return the first row, or null */
    get(sql: string, params?: unknown[]): Promise<unknown | null>
    /** Run INSERT/UPDATE/DELETE. Returns { changes, lastInsertRowid } */
    exec(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowid: number }>
    /** Wrap multiple exec calls in a transaction. Rolls back on error. */
    transaction(fn: () => Promise<void>): Promise<void>
    /** Close the database connection */
    close(): Promise<void>
  }
  ```

- [ ] **Step 2: Correct documentation namespace to `http` in `http.d.ts`**
  Modify [http.d.ts](file:///c:/Users/DarkRymit/Playground/crunes/crunes-cli/src/rune/api/types/http.d.ts#L1-L26) to rename `namespace fetch` to `namespace http` and correct JSDoc comments:
  ```typescript
  /** HTTP fetch with permission-gated URL access. Called as utils.http.fetch(url, opts). */
  declare namespace http {
    /**
     * Makes an HTTP request. Requires fetch:<METHOD>:<url> permission.
     * @param url Request URL
     * @param opts Request options
     */
    function fetch(url: string, opts?: {
      method?: string
      headers?: Record<string, string>
      body?: string
      timeout?: number
    }): Promise<FetchResponse>
    // ... leave FetchResponse interface unchanged
  }
  ```

- [ ] **Step 3: Update `crunes-help/SKILL.md` to list `http`**
  Modify [SKILL.md](file:///c:/Users/DarkRymit/Playground/crunes/crunes-aci/skills/crunes-help/SKILL.md#L35):
  *   Change `fetch` to `http` in the available namespaces list:
  ```markdown
  Available namespaces: `archive` `cache` `crypto` `env` `fs` `http` `json` `md` `rune` `shell` `sqlite` `time` `tree` `vars` `ws` `xml` `yaml`
  ```

- [ ] **Step 4: Commit type alignment changes**
  Run:
  ```bash
  git add crunes-cli/src/rune/api/types/sqlite.d.ts crunes-cli/src/rune/api/types/http.d.ts crunes-aci/skills/crunes-help/SKILL.md
  git commit -m "docs: align sqlite.d.ts as asynchronous and rename namespace fetch to http"
  ```

---

### Task 3: WebSocket Error and `.closed()` Integration

**Files:**
- Modify: [ws.js](file:///c:/Users/DarkRymit/Playground/crunes/crunes-cli/src/rune/api/ws.js)
- Modify: [runner.js](file:///c:/Users/DarkRymit/Playground/crunes/crunes-cli/src/rune/isolation/runner.js)
- Modify: [utils-bootstrap.js](file:///c:/Users/DarkRymit/Playground/crunes/crunes-cli/src/rune/isolation/utils-bootstrap.js)
- Modify: [ws.d.ts](file:///c:/Users/DarkRymit/Playground/crunes/crunes-cli/src/rune/api/types/ws.d.ts)

- [ ] **Step 1: Implement `closedPromise` and serialize full errors in `ws.js`**
  Modify [ws.js](file:///c:/Users/DarkRymit/Playground/crunes/crunes-cli/src/rune/api/ws.js#L3-L78):
  *   Create `this.closedPromise` in constructor.
  *   Update `socket.on('error', ...)` to pass a serialized JSON string containing `{ message, code, stack }`.
  *   Update `socket.on('close', ...)` to receive `(code, reason)` and resolve `this.closedResolve`.
  *   Update `close()` to return `this.closedPromise` directly.
  
  ```javascript
  class WsSession {
    constructor(url, options) {
      this.url = url
      this.options = options ?? {}
      this.state = 'CREATED'
      this.socket = null
      this.handlers = new Map()
      this.closedPromise = new Promise((resolve) => {
        this.closedResolve = resolve
      })
    }

    setHandler(event, callbackRef) {
      this.handlers.set(event, callbackRef)
    }

    open() {
      if (this.state !== 'CREATED') throw new Error(`Cannot open socket in state ${this.state}`)
      return new Promise((resolve, reject) => {
        const wsOpts = this.options.headers ? { headers: this.options.headers } : undefined
        const socket = new WebSocket(this.url, wsOpts)
        this.socket = socket
        let opened = false

        socket.on('open', async () => {
          opened = true
          this.state = 'OPEN'
          const h = this.handlers.get('open')
          if (h) await h.apply(undefined, [], { result: { promise: true } }).catch(() => {})
          resolve()
        })

        socket.on('error', (err) => {
          if (!opened) reject(err)
          const h = this.handlers.get('error')
          if (h) {
            const errData = JSON.stringify({
              message: err.message,
              code: err.code ?? null,
              stack: err.stack ?? null
            })
            h.apply(undefined, [errData], { result: { promise: true } }).catch(() => {})
          }
        })

        socket.on('message', async (data) => {
          const h = this.handlers.get('message')
          if (h) await h.apply(undefined, [String(data)], { result: { promise: true } })
        })

        socket.on('close', async (code, reason) => {
          this.state = 'CLOSED'
          const reasonStr = reason ? String(reason) : ''
          this.closedResolve({ code, reason: reasonStr })
          const h = this.handlers.get('close')
          if (h) await h.apply(undefined, [code, reasonStr], { result: { promise: true } }).catch(() => {})
        })
      })
    }

    send(message) {
      if (this.state !== 'OPEN') throw new Error(`Cannot send in state ${this.state}`)
      return new Promise((resolve, reject) => {
        this.socket.send(message, (err) => (err ? reject(err) : resolve()))
      })
    }

    close() {
      if (this.state === 'CLOSED') return this.closedPromise
      if (this.state === 'CREATED') throw new Error('Cannot close socket before opening')
      this.socket.close()
      return this.closedPromise
    }

    terminate() {
      if (this.state !== 'CLOSED') {
        this.handlers.clear()
        if (this.socket) this.socket.terminate()
        this.state = 'CLOSED'
        this.closedResolve({ code: 1006, reason: 'Abnormal closure via termination' })
      }
    }
  }
  ```

- [ ] **Step 2: Expose `$__utils_ws_closed` in `runner.js`**
  Modify [runner.js](file:///c:/Users/DarkRymit/Playground/crunes/crunes-cli/src/rune/isolation/runner.js#L269-L286):
  *   Inject `$__utils_ws_closed` so the VM sandbox can await the host session's closure.
  
  ```javascript
    await jail.set('$__utils_ws_client', new ivm.Reference((url, options) => {
      return utils.ws.client(url, options)
    }))
    await jail.set('$__utils_ws_on', new ivm.Reference((sessionIdRef, eventRef, callbackRef) => {
      const sessionId = sessionIdRef.copySync()
      const event = eventRef.copySync()
      utils.ws._getSession(sessionId).setHandler(event, callbackRef)
    }))
    await jail.set('$__utils_ws_open', new ivm.Reference(async (sessionId) => {
      await utils.ws._getSession(sessionId).open()
    }))
    await jail.set('$__utils_ws_send', new ivm.Reference(async (sessionId, message) => {
      await utils.ws._getSession(sessionId).send(message)
    }))
    await jail.set('$__utils_ws_close', new ivm.Reference(async (sessionId) => {
      return utils.ws._getSession(sessionId).close()
    }))
    await jail.set('$__utils_ws_closed', new ivm.Reference(async (sessionId) => {
      return utils.ws._getSession(sessionId).closedPromise
    }))
  ```

- [ ] **Step 3: Reconstruct Error objects and expose `.closed()` in `utils-bootstrap.js`**
  Modify [utils-bootstrap.js](file:///c:/Users/DarkRymit/Playground/crunes/crunes-cli/src/rune/isolation/utils-bootstrap.js#L172-L193):
  *   Expose `.closed()` returning the awaited `$__utils_ws_closed` host promise.
  *   Intercept `'error'` event and construct a native sandbox `Error` with `code` and `stack` properties.
  
  ```javascript
    ws: {
      client(url, opts) {
        const id = $__utils_ws_client.applySync(
          undefined,
          [url, opts],
          { arguments: { copy: true } },
        )
        return {
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
              : handler
            $__utils_ws_on.applySync(undefined, [id, event, isolateHandler], {
              arguments: { reference: true },
            })
          },
          open:   () => $__utils_ws_open.apply(undefined,  [id],      { result: { promise: true } }),
          send:   (msg) => $__utils_ws_send.apply(undefined,  [id, msg], { result: { promise: true } }),
          close:  () => $__utils_ws_close.apply(undefined, [id],      { result: { promise: true, copy: true } }),
          closed: () => $__utils_ws_closed.apply(undefined, [id],     { result: { promise: true, copy: true } }),
        }
      },
    },
  ```

- [ ] **Step 4: Update type declarations in `ws.d.ts`**
  Modify [ws.d.ts](file:///c:/Users/DarkRymit/Playground/crunes/crunes-cli/src/rune/api/types/ws.d.ts#L10-L22):
  *   Declare `WebSocketError` interface.
  *   Add `.closed()` to `WsHandle` interface.
  
  ```typescript
    /** Live WebSocket connection handle returned by client() */
    interface WsHandle {
      /** Register an event handler. Call before open(). */
      on(event: 'message', fn: (msg: string) => void): void
      on(event: 'open', fn: () => void): void
      on(event: 'close', fn: (closeInfo: { code: number; reason: string }) => void): void
      on(event: 'error', fn: (err: WebSocketError) => void): void
      /** Connect and resolve when socket is open */
      open(): Promise<void>
      /** Send a message string. Socket must be open first. */
      send(msg: string): Promise<void>
      /** Close the connection gracefully. Idempotent. Returns code and reason when closed. */
      close(): Promise<{ code: number; reason: string }>
      /** Await connection closure (from client or server disconnect). Returns code and reason. */
      closed(): Promise<{ code: number; reason: string }>
    }

    interface WebSocketError extends Error {
      code?: string
    }
  ```

- [ ] **Step 5: Run tests to verify the suite and update snapshots**
  Run:
  ```bash
  npm test
  ```
  Expected: All 733 tests pass successfully.
  
  If there are any Vitest test updates needed due to the change in `.close()`'s signature:
  Run:
  ```bash
  npx vitest -u
  ```

- [ ] **Step 6: Commit WebSocket enhancements**
  Run:
  ```bash
  git add crunes-cli/src/rune/api/ws.js crunes-cli/src/rune/isolation/runner.js crunes-cli/src/rune/isolation/utils-bootstrap.js crunes-cli/src/rune/api/types/ws.d.ts
  git commit -m "feat(ws): implement fully-featured Error replication and awaitable closed promise"
  ```

---

### Task 4: Documentation Alignment & Verification

**Files:**
- Modify: [README.md](file:///c:/Users/DarkRymit/Playground/crunes/crunes-aci/README.md)

- [ ] **Step 1: Align token syntax in ACI `README.md`**
  Modify [README.md](file:///c:/Users/DarkRymit/Playground/crunes/crunes-aci/README.md#L54):
  *   Change `$key[=args]` to `$key(args)` at line 54 and line 90.
  
  ```markdown
  The `UserPromptSubmit` hook automatically resolves `$key(args)` tokens and injects rune output as XML context before Claude sees your prompt:
  ```

- [ ] **Step 2: Perform build and full doctor validation**
  Run:
  ```bash
  npm run build
  node dist/cli.js doctor
  ```
  Expected Output:
  ```
  ✓ Node.js v20.x.x
  ✓ crunes 0.4.6 in PATH
  ✓ Config valid — 3 runes registered
  ```

- [ ] **Step 3: Run local WebSocket validation against echo.js**
  Run:
  ```bash
  # In terminal 1 (start echo server):
  node ../examples/ws/echo-server.mjs
  
  # In terminal 2 (run echo rune inside examples/ws):
  node ../../crunes-cli/dist/cli.js use echo
  ```
  Verify that the echo replies are output successfully in plain Markdown.

- [ ] **Step 4: Final commit and cleanup**
  Run:
  ```bash
  git add crunes-aci/README.md
  git commit -m "docs(aci): correct token argument syntax to parentheses in README"
  ```
