# Binary API Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename `AsBytes` → `Bytes`/`BytesStream` in `fs`, replace `binary: true` flag on `shell.exec`/`shell.spawn` with `execBinary`/`spawnBinary` methods, and make `ShellSession` and `ShellSessionReadableStream` generic.

**Architecture:** Three files change — the type declarations (`types-utils/fs.d.ts`, `types-utils/shell.d.ts`), the bootstrap wiring (`isolation/utils-bootstrap.js`), and the host-side implementation (`api/shell.js`). No host-side `fs.js` changes are needed — method names are only used in the bootstrap and type declarations. Tests in `test/rune/api/fs.test.js` and `test/rune/api/shell.test.js` must be updated to call the new names.

**Tech Stack:** Node.js ESM, isolated-vm sandbox, Vitest

## Global Constraints

- All files under `src/` are strict ESM — no `require()`
- Run all tests from inside `crunes-cli/`: `npm test`
- Build with `npm run build` — never commit `dist/`
- `appendBytesStream` is a new addition — it did not previously exist
- Old names (`readAsBytes`, `writeAsBytes`, `appendAsBytes`, `readStreamAsBytes`, `writeStreamAsBytes`, `binary: true`) are removed with no aliases
- `ShellSessionReadableStream<T>` generic: `stdout` typed as `T`, `stderr` pinned to `string`
- `ShellResult<T>` generic: `stdout` typed as `T`, `stderr` pinned to `string`

---

### Task 1: Rename `fs` type declarations

**Files:**
- Modify: `src/rune/api/types-utils/fs.d.ts`

**Interfaces:**
- Produces: `fs.readBytes`, `fs.writeBytes`, `fs.appendBytes`, `fs.readBytesStream`, `fs.writeBytesStream`, `fs.appendBytesStream` (new)

- [ ] **Step 1: Replace `readAsBytes` with `readBytes`**

In `src/rune/api/types-utils/fs.d.ts`, replace:

```ts
  /**
   * Reads a file as raw binary bytes.
   * Requires `fs.read:<path>` permission.
   * @param path Relative file path
   * @param opts Options
   */
  function readAsBytes(path: string, opts?: { throw?: boolean }): Promise<Uint8Array | null>
```

With:

```ts
  /**
   * Reads a file as raw binary bytes.
   * Requires `fs.read:<path>` permission.
   * @param path Relative file path
   * @param opts Options
   */
  function readBytes(path: string, opts?: { throw?: boolean }): Promise<Uint8Array | null>
```

- [ ] **Step 2: Replace `writeAsBytes` with `writeBytes`**

Replace:

```ts
  /**
   * Writes raw binary bytes to a file, creating parent directories as needed.
   * Requires `fs.write:<path>` permission.
   * @param path Relative file path
   * @param content Raw binary Uint8Array bytes
   */
  function writeAsBytes(path: string, content: Uint8Array): Promise<void>
```

With:

```ts
  /**
   * Writes raw binary bytes to a file, creating parent directories as needed.
   * Requires `fs.write:<path>` permission.
   * @param path Relative file path
   * @param content Raw binary Uint8Array bytes
   */
  function writeBytes(path: string, content: Uint8Array): Promise<void>
```

- [ ] **Step 3: Replace `appendAsBytes` with `appendBytes`**

Replace:

```ts
  /**
   * Appends raw binary bytes to a file, creating parent directories if needed.
   * Requires `fs.write:<path>` permission.
   * @param path Relative file path
   * @param content Raw binary Uint8Array bytes to append
   */
  function appendAsBytes(path: string, content: Uint8Array): Promise<void>
```

With:

```ts
  /**
   * Appends raw binary bytes to a file, creating parent directories if needed.
   * Requires `fs.write:<path>` permission.
   * @param path Relative file path
   * @param content Raw binary Uint8Array bytes to append
   */
  function appendBytes(path: string, content: Uint8Array): Promise<void>
```

- [ ] **Step 4: Replace stream methods and add `appendBytesStream`**

Replace:

```ts
  /**
   * Reads a file chunk-by-chunk as a raw binary byte stream.
   * Requires `fs.read:<path>` permission.
   * @param path Relative file path
   */
  function readStreamAsBytes(path: string): ReadableStream<Uint8Array>

  /**
   * Writes to a file chunk-by-chunk using a raw binary byte stream.
   * Requires `fs.write:<path>` permission.
   * @param path Relative file path
   */
  function writeStreamAsBytes(path: string): WritableStream<Uint8Array>
```

With:

```ts
  /**
   * Reads a file chunk-by-chunk as a raw binary byte stream.
   * Requires `fs.read:<path>` permission.
   * @param path Relative file path
   */
  function readBytesStream(path: string): ReadableStream<Uint8Array>

  /**
   * Writes to a file chunk-by-chunk using a raw binary byte stream.
   * Requires `fs.write:<path>` permission.
   * @param path Relative file path
   */
  function writeBytesStream(path: string): WritableStream<Uint8Array>

  /**
   * Appends raw binary bytes to a file chunk-by-chunk using a writable byte stream.
   * Requires `fs.write:<path>` permission.
   * @param path Relative file path
   */
  function appendBytesStream(path: string): WritableStream<Uint8Array>
```

- [ ] **Step 5: Commit**

```bash
git -C crunes-cli add src/rune/api/types-utils/fs.d.ts
git -C crunes-cli commit -m "refactor(api): rename fs AsBytes methods to Bytes/BytesStream, add appendBytesStream"
```

---

### Task 2: Rename `shell` type declarations and add `ShellSession<T>` generic

**Files:**
- Modify: `src/rune/api/types-utils/shell.d.ts`

**Interfaces:**
- Produces:
  - `shell.execBinary(cmd, opts?): Promise<ShellResult<Uint8Array>>`
  - `shell.spawnBinary(cmd, opts?): ShellSession<Uint8Array>`
  - `ShellResult<T extends string | Uint8Array = string>` with `stdout: T`, `stderr: string`
  - `ShellSession<T extends string | Uint8Array = string>` with `stdout: ShellSessionReadableStream<T>`, `stderr: ShellSessionReadableStream<string>`, `stdin: ShellSessionWritableStream`
  - `ShellSessionReadableStream<T extends string | Uint8Array = string>` extending `ReadableStream<T>`

- [ ] **Step 1: Update `ShellResult` to be generic and remove `binary` option from `exec`**

Replace the entire `exec` signature and `ShellResult` interface:

```ts
  /**
   * Runs a shell command asynchronously and returns its output.
   * Requires `shell.run:<command>` permission. `*` matches any characters (e.g. `shell.run:bash *`).
   *
   * @param cmd Shell command to execute
   * @param opts Option object to configure shell execution
   * @param opts.throw Throw a ShellError on non-zero exit codes (default: true). If false, returns the result object.
   * @param opts.trim Trim leading/trailing whitespace from stdout (default: true).
   * @param opts.timeout Timeout in milliseconds (default: 30000).
   * @param opts.env Key-value pairs of environment variables to inject.
   * @param opts.stdin Input string, buffer, or ReadableStream piped to stdin.
   */
  export function exec(
    cmd: string,
    opts?: {
      throw?: boolean
      trim?: boolean
      timeout?: number
      env?: Record<string, string>
      stdin?: ReadableStream<Uint8Array | string> | Uint8Array | string
    }
  ): Promise<ShellResult<string>>

  /**
   * Runs a shell command and returns stdout as raw Uint8Array bytes.
   * Requires `shell.run:<command>` permission. `*` matches any characters (e.g. `shell.run:bash *`).
   *
   * @param cmd Shell command to execute
   * @param opts Option object to configure shell execution
   * @param opts.throw Throw a ShellError on non-zero exit codes (default: true).
   * @param opts.timeout Timeout in milliseconds (default: 30000).
   * @param opts.env Key-value pairs of environment variables to inject.
   * @param opts.stdin Input string, buffer, or ReadableStream piped to stdin.
   */
  export function execBinary(
    cmd: string,
    opts?: {
      throw?: boolean
      timeout?: number
      env?: Record<string, string>
      stdin?: ReadableStream<Uint8Array | string> | Uint8Array | string
    }
  ): Promise<ShellResult<Uint8Array>>

  interface ShellResult<T extends string | Uint8Array = string> {
    /**
     * The standard output (stdout) of the process.
     * For `exec` this is a string; for `execBinary` this is a `Uint8Array`.
     */
    stdout: T
    /** The standard error (stderr) of the process (always a string). */
    stderr: string
    /** The exit status code of the process. */
    exitCode: number
    /** Helper property: true if exitCode is 0, false otherwise. */
    ok: boolean
  }
```

- [ ] **Step 2: Update `ShellSession<T>`, `ShellSessionReadableStream<T>`, and spawn signatures**

Replace the entire `spawn`, `ShellSession`, `ShellSessionWritableStream`, `ShellSessionReadableStream` block:

```ts
  /**
   * Spawns an interactive shell session, yielding text chunks on stdout and stderr.
   * Requires `shell.run:<command>` permission. `*` matches any characters (e.g. `shell.run:npm *`).
   *
   * @param cmd Shell command to spawn
   * @param opts Option object to configure interactive execution
   * @param opts.env Key-value pairs of environment variables to inject.
   * @param opts.signal AbortSignal to kill the session and its child process tree.
   */
  export function spawn(
    cmd: string,
    opts?: {
      env?: Record<string, string>
      signal?: AbortSignal
    }
  ): ShellSession<string>

  /**
   * Spawns an interactive shell session, yielding raw Uint8Array chunks on stdout.
   * stderr always yields string chunks regardless of binary mode.
   * Requires `shell.run:<command>` permission. `*` matches any characters (e.g. `shell.run:npm *`).
   *
   * @param cmd Shell command to spawn
   * @param opts Option object to configure interactive execution
   * @param opts.env Key-value pairs of environment variables to inject.
   * @param opts.signal AbortSignal to kill the session and its child process tree.
   */
  export function spawnBinary(
    cmd: string,
    opts?: {
      env?: Record<string, string>
      signal?: AbortSignal
    }
  ): ShellSession<Uint8Array>

  interface ShellSession<T extends string | Uint8Array = string> {
    readonly stdin: ShellSessionWritableStream
    readonly stdout: ShellSessionReadableStream<T>
    readonly stderr: ShellSessionReadableStream<string>

    on(event: 'exit', callback: (code: number) => void): void
    on(event: 'error', callback: (err: string) => void): void

    /** Start the subprocess. Handlers registered before open() are guaranteed to receive all output. */
    open(): void
    kill(signal?: string): void
  }

  interface ShellSessionWritableStream extends WritableStream<Uint8Array | string> {
    write(text: string | Uint8Array): void
    end(): void
  }

  interface ShellSessionReadableStream<T extends string | Uint8Array = string> extends ReadableStream<T> {
    on(event: 'data', callback: (chunk: T) => void): void
    on(event: 'end', callback: () => void): void
  }
```

- [ ] **Step 3: Commit**

```bash
git -C crunes-cli add src/rune/api/types-utils/shell.d.ts
git -C crunes-cli commit -m "refactor(api): replace shell binary flag with execBinary/spawnBinary, make ShellSession generic"
```

---

### Task 3: Add `appendStreamRef` to `fs.js` and wire host reference in `runner.js`

**Files:**
- Modify: `src/rune/api/fs.js`
- Modify: `src/rune/isolation/runner.js`

**Interfaces:**
- Produces: `$__utils_fs_appendStream` host reference — opens a file in append mode and returns a stream id usable with existing `$__utils_fs_writeStream_write` / `$__utils_fs_writeStream_close`

- [ ] **Step 1: Add `appendStreamRef` to `createFsUtils` in `fs.js`**

In `src/rune/api/fs.js`, after the `writeStreamRef` method, add:

```js
    async appendStreamRef(relPath) {
      const abs   = resolvePath(relPath, ctx())
      if (checkPermission) checkPermission('fs.write', relPath)

      await fsPromises.mkdir(path.dirname(abs), { recursive: true })
      const stream = createWriteStream(abs, { flags: 'a' })
      return {
        write(chunk) {
          return new Promise((resolve, reject) => {
            const onDrain = () => {
              stream.removeListener('error', onError)
              resolve()
            }
            const onError = (err) => {
              stream.removeListener('drain', onDrain)
              reject(err)
            }

            if (!stream.write(chunk)) {
              stream.once('drain', onDrain)
              stream.once('error', onError)
            } else {
              resolve()
            }
          })
        },
        close() {
          return new Promise((resolve, reject) => {
            const onError = (err) => reject(err)
            stream.once('error', onError)
            stream.end(() => {
              stream.removeListener('error', onError)
              resolve()
            })
          })
        }
      }
    },
```

- [ ] **Step 2: Wire `$__utils_fs_appendStream` in `runner.js`**

In `src/rune/isolation/runner.js`, find the block that sets `$__utils_fs_writeStream`:

```js
  await jail.set('$__utils_fs_writeStream', new ivm.Reference(async (relPath) => {
    const ref = await utils.fs.writeStreamRef(relPath)
    const id = nextStreamId++
    streams.set(id, ref)
    return id
  }))
```

After that block, add:

```js
  await jail.set('$__utils_fs_appendStream', new ivm.Reference(async (relPath) => {
    const ref = await utils.fs.appendStreamRef(relPath)
    const id = nextStreamId++
    streams.set(id, ref)
    return id
  }))
```

- [ ] **Step 3: Run tests**

```bash
cd crunes-cli && npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git -C crunes-cli add src/rune/api/fs.js src/rune/isolation/runner.js
git -C crunes-cli commit -m "feat(fs): add appendStreamRef and wire \$__utils_fs_appendStream host reference"
```

---

### Task 4: Update `utils-bootstrap.js` — `fs` renames

**Depends on:** Task 3 (needs `$__utils_fs_appendStream` to exist)

**Files:**
- Modify: `src/rune/isolation/utils-bootstrap.js`

**Interfaces:**
- Consumes: existing `$__utils_fs_*` host references (unchanged)
- Produces: `globalThis.utils.fs` exposes `readBytes`, `writeBytes`, `appendBytes`, `readBytesStream`, `writeBytesStream`, `appendBytesStream` instead of old names

- [ ] **Step 1: Rename `readAsBytes` → `readBytes` in bootstrap**

In `src/rune/isolation/utils-bootstrap.js`, inside `globalThis.utils.fs`, replace:

```js
    readAsBytes: async (path, opts) => {
      const ab = await $__utils_fs_read_bytes.apply(undefined, [path, opts], { arguments: { copy: true }, result: { promise: true, copy: true } })
      return ab ? new Uint8Array(ab) : null
    },
```

With:

```js
    readBytes: async (path, opts) => {
      const ab = await $__utils_fs_read_bytes.apply(undefined, [path, opts], { arguments: { copy: true }, result: { promise: true, copy: true } })
      return ab ? new Uint8Array(ab) : null
    },
```

- [ ] **Step 2: Rename `readStreamAsBytes` → `readBytesStream` and `writeStreamAsBytes` → `writeBytesStream`**

Replace:

```js
    readStreamAsBytes: (path) => {
      let streamId = null
      return new ReadableStream({
        async start() {
          streamId = await $__utils_fs_readStream.apply(undefined, [path], { result: { promise: true } })
        },
        async pull(controller) {
          const ab = await $__utils_fs_readStream_next.apply(undefined, [streamId], { result: { promise: true, copy: true } })
          if (ab === null) controller.close()
          else controller.enqueue(new Uint8Array(ab))
        }
      })
    },
    readStream: (path) => {
      return globalThis.utils.fs.readStreamAsBytes(path).pipeThrough(new TextDecoderStream())
    },
    writeStreamAsBytes: (path) => {
```

With:

```js
    readBytesStream: (path) => {
      let streamId = null
      return new ReadableStream({
        async start() {
          streamId = await $__utils_fs_readStream.apply(undefined, [path], { result: { promise: true } })
        },
        async pull(controller) {
          const ab = await $__utils_fs_readStream_next.apply(undefined, [streamId], { result: { promise: true, copy: true } })
          if (ab === null) controller.close()
          else controller.enqueue(new Uint8Array(ab))
        }
      })
    },
    readStream: (path) => {
      return globalThis.utils.fs.readBytesStream(path).pipeThrough(new TextDecoderStream())
    },
    writeBytesStream: (path) => {
```

- [ ] **Step 3: Update `writeStream` internal reference and rename `writeAsBytes` → `writeBytes`**

Replace:

```js
    writeStream: (path) => {
      const wsBytes = globalThis.utils.fs.writeStreamAsBytes(path)
```

With:

```js
    writeStream: (path) => {
      const wsBytes = globalThis.utils.fs.writeBytesStream(path)
```

Then replace:

```js
    writeAsBytes: (path, content) => {
      if (!(content instanceof Uint8Array)) throw new TypeError('writeAsBytes requires a Uint8Array')
      return $__utils_fs_write_bytes.apply(undefined, [path, content.buffer, content.byteOffset, content.byteLength], { arguments: { copy: true }, result: { promise: true } })
    },
```

With:

```js
    writeBytes: (path, content) => {
      if (!(content instanceof Uint8Array)) throw new TypeError('writeBytes requires a Uint8Array')
      return $__utils_fs_write_bytes.apply(undefined, [path, content.buffer, content.byteOffset, content.byteLength], { arguments: { copy: true }, result: { promise: true } })
    },
```

- [ ] **Step 4: Rename `appendAsBytes` → `appendBytes` and add `appendBytesStream`**

Replace:

```js
    append: (p, c) => $__utils_fs_append.apply(undefined, [p, c], { arguments: { copy: true }, result: { promise: true } }),
    appendAsBytes: async (p, content) => {
      if (!(content instanceof Uint8Array)) throw new TypeError('appendAsBytes requires a Uint8Array')
      return $__utils_fs_append_bytes.apply(undefined, [p, content.buffer, content.byteOffset, content.byteLength], { arguments: { copy: true }, result: { promise: true } })
    },
```

With:

```js
    append: (p, c) => $__utils_fs_append.apply(undefined, [p, c], { arguments: { copy: true }, result: { promise: true } }),
    appendBytes: async (p, content) => {
      if (!(content instanceof Uint8Array)) throw new TypeError('appendBytes requires a Uint8Array')
      return $__utils_fs_append_bytes.apply(undefined, [p, content.buffer, content.byteOffset, content.byteLength], { arguments: { copy: true }, result: { promise: true } })
    },
    appendBytesStream: (path) => {
      let streamId = null
      return new WritableStream({
        async start() {
          streamId = await $__utils_fs_appendStream.apply(undefined, [path], { result: { promise: true } })
        },
        async write(chunk) {
          if (!(chunk instanceof Uint8Array)) throw new TypeError('appendBytesStream requires Uint8Array chunks')
          await $__utils_fs_writeStream_write.apply(undefined, [streamId, chunk.buffer, chunk.byteOffset, chunk.byteLength], { arguments: { copy: true }, result: { promise: true } })
        },
        async close() {
          if (streamId !== null) {
            await $__utils_fs_writeStream_close.apply(undefined, [streamId], { result: { promise: true } })
          }
        },
        async abort() {
          if (streamId !== null) {
            await $__utils_fs_writeStream_close.apply(undefined, [streamId], { result: { promise: true } })
          }
        }
      })
    },
```

- [ ] **Step 5: Run tests**

```bash
cd crunes-cli && npm test
```

Expected: all tests pass (fs renames not yet tested — bootstrap is validated by runner integration tests).

- [ ] **Step 6: Commit**

```bash
git -C crunes-cli add src/rune/isolation/utils-bootstrap.js
git -C crunes-cli commit -m "refactor(bootstrap): rename fs AsBytes to Bytes/BytesStream, add appendBytesStream"
```

---

### Task 4: Update `utils-bootstrap.js` — `shell` renames

**Files:**
- Modify: `src/rune/isolation/utils-bootstrap.js`

**Interfaces:**
- Consumes: `ShellSession` class from `api/shell.js` via `$__utils_shell_spawn_*` host references
- Produces: `globalThis.utils.shell.execBinary`, `globalThis.utils.shell.spawnBinary`; `binary` option removed from `exec` and `spawn`

- [ ] **Step 1: Remove `binary` handling from `exec` in bootstrap**

In `utils-bootstrap.js`, the `shell.exec` handler currently passes `opts` (which may contain `binary: true`) directly to the host. Remove the binary stdout unwrapping:

Replace the end of `shell.exec` (the part after `const res = await promise`):

```js
      const res = await promise
      if (res && res.stdout instanceof ArrayBuffer) {
        return { ...res, stdout: new Uint8Array(res.stdout) }
      }
      return res
```

With:

```js
      return await promise
```

- [ ] **Step 2: Add `execBinary` to bootstrap `shell` object**

After the `exec` function definition in `globalThis.utils.shell`, add:

```js
    execBinary: async (cmd, o) => {
      let stdinStreamId = null
      let opts = { ...o, binary: true }
      const hasStdinStream = o && o.stdin && typeof o.stdin.getReader === 'function'

      if (hasStdinStream) {
        stdinStreamId = 'shell_stdin_' + Math.random().toString(36).slice(2)
        delete opts.stdin
      } else if (o && o.stdin instanceof Uint8Array) {
        opts.stdin = { type: 'Buffer', data: Array.from(o.stdin) }
      } else if (o && o.stdin && typeof o.stdin === 'object' && o.stdin.buffer) {
        opts.stdin = { type: 'Buffer', data: Array.from(new Uint8Array(o.stdin.buffer)) }
      }

      const promise = $__utils_shell_exec.apply(
        undefined,
        [cmd, opts, stdinStreamId],
        { arguments: { copy: true }, result: { promise: true, copy: true } }
      )

      if (hasStdinStream) {
        const reader = o.stdin.getReader()
        const pump = async () => {
          try {
            while (true) {
              const { value, done } = await reader.read()
              if (done) break
              let chunk = value
              if (typeof chunk === 'string') chunk = new TextEncoder().encode(chunk)
              if (!(chunk instanceof Uint8Array)) throw new TypeError('stdin stream must yield string or Uint8Array chunks')
              await $__utils_fs_writeStream_write.apply(
                undefined,
                [stdinStreamId, chunk.buffer, chunk.byteOffset, chunk.byteLength],
                { arguments: { copy: true }, result: { promise: true } }
              )
            }
          } finally {
            await $__utils_fs_writeStream_close.apply(undefined, [stdinStreamId], { result: { promise: true } })
          }
        }
        pump()
      }

      const res = await promise
      if (res && res.stdout instanceof ArrayBuffer) {
        return { ...res, stdout: new Uint8Array(res.stdout) }
      }
      return res
    },
```

- [ ] **Step 3: Remove `binary` option from `spawn` and extract helper**

In `utils-bootstrap.js` the `shell.spawn` function reads `const binaryMode = !!(o && o.binary)`. Replace the entire `spawn` function body to extract the shared session-building logic into a private helper `_makeShellSession(cmd, o, binaryMode)`, then expose `spawn` (binaryMode=false) and `spawnBinary` (binaryMode=true):

Replace the `spawn: (cmd, o) => {` block (from `spawn: (cmd, o) => {` to its closing `},`) with:

```js
    spawn: (cmd, o) => {
      return _makeShellSession(cmd, o, false)
    },
    spawnBinary: (cmd, o) => {
      return _makeShellSession(cmd, o, true)
    },
```

And add the helper function **before** the `globalThis.utils = {` line:

```js
function _makeShellSession(cmd, o, binaryMode) {
  const id = $__utils_shell_spawn_open.applySync(undefined, [cmd, o], { arguments: { copy: true } })

  const createHybridReadable = (streamType, binary) => {
    let controller
    const listeners = []

    const stream = new ReadableStream({
      start(c) { controller = c }
    })

    stream.on = (event, callback) => {
      listeners.push({ event, callback })
    }

    const handleData = (ab) => {
      const chunk = binary ? new Uint8Array(ab) : new TextDecoder().decode(ab)
      if (controller) { try { controller.enqueue(chunk) } catch (e) {} }
      for (const l of listeners) { if (l.event === 'data') l.callback(chunk) }
    }

    const handleEnd = () => {
      if (controller) { try { controller.close() } catch (e) {} }
      for (const l of listeners) { if (l.event === 'end') l.callback() }
    }

    $__utils_shell_spawn_on.applySync(undefined, [id, streamType, 'data', handleData], { arguments: { reference: true } })
    $__utils_shell_spawn_on.applySync(undefined, [id, streamType, 'end', handleEnd], { arguments: { reference: true } })

    return stream
  }

  const stdoutStream = createHybridReadable('stdout', binaryMode)
  const stderrStream = createHybridReadable('stderr', false)  // stderr always string

  const stdinStream = new WritableStream({
    async write(chunk) {
      let rawChunk = chunk
      if (rawChunk instanceof Uint8Array) rawChunk = rawChunk.buffer
      await $__utils_shell_spawn_write.apply(undefined, [id, rawChunk], { arguments: { copy: true }, result: { promise: true } })
    },
    async close() {
      await $__utils_shell_spawn_end.apply(undefined, [id], { result: { promise: true } })
    }
  })

  stdinStream.write = (text) => {
    let rawChunk = text
    if (rawChunk instanceof Uint8Array) rawChunk = rawChunk.buffer
    $__utils_shell_spawn_write.applySync(undefined, [id, rawChunk], { arguments: { copy: true } })
  }
  stdinStream.end = () => {
    $__utils_shell_spawn_end.applySync(undefined, [id])
  }

  const session = {
    stdin: stdinStream,
    stdout: stdoutStream,
    stderr: stderrStream,
    on(event, callback) {
      $__utils_shell_spawn_on.applySync(undefined, [id, 'session', event, callback], { arguments: { reference: true } })
    },
    open: () => $__utils_shell_spawn_start.applySync(undefined, [id]),
    kill: (signal) => $__utils_shell_spawn_kill.applySync(undefined, [id, signal ?? null])
  }

  if (o && o.signal) {
    o.signal.addEventListener('abort', () => session.kill('SIGTERM'))
  }
  return session
}
```

- [ ] **Step 4: Run tests**

```bash
cd crunes-cli && npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git -C crunes-cli add src/rune/isolation/utils-bootstrap.js
git -C crunes-cli commit -m "refactor(bootstrap): add execBinary/spawnBinary, remove binary flag from exec/spawn"
```

---

### Task 5: Update `shell.js` host — expose `execBinary` method

**Files:**
- Modify: `src/rune/api/shell.js`

**Interfaces:**
- Produces: `createShellUtils` returns object with `execBinary` method (same as `exec` but `binary: true` forced)

- [ ] **Step 1: Add `execBinary` to `createShellUtils` return value**

In `src/rune/api/shell.js`, the `exec` function already supports `binary` internally. Add `execBinary` as a thin wrapper. In the `return { exec, spawn, createShellJob, dispose() { ... } }` block, add `execBinary`:

Replace:

```js
  return {
    exec,
    spawn: execInSession,
    createShellJob,
    dispose() {
```

With:

```js
  return {
    exec,
    execBinary: (cmd, opts = {}) => exec(cmd, { ...opts, binary: true }),
    spawn: execInSession,
    spawnBinary: (cmd, opts = {}) => execInSession(cmd, { ...opts, binary: true }),
    createShellJob,
    dispose() {
```

- [ ] **Step 2: Run tests**

```bash
cd crunes-cli && npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git -C crunes-cli add src/rune/api/shell.js
git -C crunes-cli commit -m "refactor(shell): expose execBinary and spawnBinary from createShellUtils"
```

---

### Task 6: Update tests

**Files:**
- Modify: `test/rune/api/fs.test.js`
- Modify: `test/rune/api/shell.test.js`

**Interfaces:**
- Consumes: `readBytes`, `writeBytes`, `appendBytes`, `readBytesStream`, `writeBytesStream` from `createFsUtils`; `execBinary`, `spawnBinary` from `createShellUtils`

- [ ] **Step 1: Find all old `AsBytes` usages in tests**

```bash
cd crunes-cli && grep -n "AsBytes\|binary.*true\|binary: true" test/rune/api/fs.test.js test/rune/api/shell.test.js
```

Expected: lines using `readAsBytes`, `writeAsBytes`, `appendAsBytes`, `readStreamAsBytes`, `writeStreamAsBytes`, `binary: true`.

- [ ] **Step 2: Update `fs.test.js` — rename `AsBytes` calls**

For every occurrence in `test/rune/api/fs.test.js`:
- `readAsBytes(` → `readBytes(`
- `writeAsBytes(` → `writeBytes(`
- `appendAsBytes(` → `appendBytes(`
- `readStreamAsBytes(` → `readBytesStream(`
- `writeStreamAsBytes(` → `writeBytesStream(`

- [ ] **Step 3: Update `shell.test.js` — replace `binary: true` with `execBinary`/`spawnBinary`**

For every occurrence in `test/rune/api/shell.test.js`:
- `shellUtils.exec(cmd, { binary: true, ... })` → `shellUtils.execBinary(cmd, { ... })`
- `shellUtils.spawn(cmd, { binary: true, ... })` → `shellUtils.spawnBinary(cmd, { ... })`

- [ ] **Step 4: Run tests and confirm all pass**

```bash
cd crunes-cli && npm test
```

Expected: all tests pass with zero references to old names.

- [ ] **Step 5: Confirm no old names remain**

```bash
cd crunes-cli && grep -rn "readAsBytes\|writeAsBytes\|appendAsBytes\|readStreamAsBytes\|writeStreamAsBytes" src/ test/
```

Expected: no output.

```bash
cd crunes-cli && grep -rn "binary.*true\|binary: true" src/rune/isolation/utils-bootstrap.js src/rune/api/types-utils/shell.d.ts
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git -C crunes-cli add test/rune/api/fs.test.js test/rune/api/shell.test.js
git -C crunes-cli commit -m "test: update fs and shell tests for renamed binary API methods"
```

---

### Task 7: Build and verify

**Files:** none (verification only)

- [ ] **Step 1: Build**

```bash
cd crunes-cli && npm run build
```

Expected: exits 0, no errors.

- [ ] **Step 2: Smoke-test `readBytes` via CLI**

Create `scratch/test-read-bytes.mjs`:

```js
import { fs } from '@utils'
export async function run() {
  const bytes = await fs.readBytes('package.json')
  console.log('readBytes ok, length:', bytes.length)
}
```

Run:

```bash
cd crunes-cli && node dist/cli.js -p run scratch/test-read-bytes.mjs
```

Expected: `readBytes ok, length: <number>`

- [ ] **Step 3: Smoke-test `execBinary` via CLI**

Create `scratch/test-exec-binary.mjs`:

```js
import { shell } from '@utils'
export async function run() {
  const { stdout } = await shell.execBinary('node -e "process.stdout.write(Buffer.from([0x68,0x69]))"')
  console.log('execBinary ok, type:', stdout instanceof Uint8Array, 'bytes:', stdout)
}
```

Run:

```bash
cd crunes-cli && node dist/cli.js -p run scratch/test-exec-binary.mjs
```

Expected: `execBinary ok, type: true bytes: Uint8Array(2) [ 104, 105 ]`

- [ ] **Step 4: Commit scratch cleanup**

```bash
cd crunes-cli && git status
```

Scratch files are gitignored — no commit needed. If they appear in status, verify `.gitignore` covers `scratch/`.
