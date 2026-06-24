# Sandbox Compat Globals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add missing web-standard globals and minimal Node-compat shims to the crunes-cli isolated-vm bootstrap so that pure-JS npm libraries work inside runes without modifications.

**Architecture:** All changes go inline in `utils-bootstrap.js` (the script bundled by esbuild and executed inside the V8 isolate) following existing patterns. Two npm packages (`whatwg-url`, `buffer`) are added as devDependencies — esbuild bundles them into the isolate bootstrap at build time. One new jail injection is added in `runner.js` for `performance.now()`.

**Tech Stack:** Node.js ≥22, isolated-vm, esbuild, vitest, `whatwg-url@^16`, `buffer@^6`

## Global Constraints

- All commands run from `crunes-cli/` — it is an independent git repository
- `dist/` is never committed — built locally for testing only
- All source files are strict ESM (`import`/`export`, no `require`)
- After any `package.json` change, run `npm install` to regenerate `package-lock.json`
- Run `npm test && npm run build` before committing to verify nothing is broken
- `build.mjs` is NOT changed — `whatwg-url` and `buffer` bundle cleanly through esbuild

---

### Task 1: Install deps + inject `$__performance_now` into runner.js

**Files:**
- Modify: `crunes-cli/package.json`
- Modify: `crunes-cli/src/rune/isolation/runner.js:1303`
- Regenerate: `crunes-cli/package-lock.json`

**Interfaces:**
- Produces: `$__performance_now` — an ivm Reference available as a global inside the isolate bootstrap. Called with `$__performance_now.applySync(undefined, [])` to get a `number`.

- [ ] **Step 1: Install the two new devDeps**

```bash
cd crunes-cli
npm install --save-dev whatwg-url@^16 buffer@^6
```

Expected: `package.json` devDependencies now includes `"whatwg-url": "^16.x.x"` and `"buffer": "^6.x.x"`. `package-lock.json` is updated.

- [ ] **Step 2: Add the `$__performance_now` jail injection to runner.js**

In `src/rune/isolation/runner.js`, find line 1303 (the `$__vars` injection):

```js
  await jail.set('$__vars', JSON.stringify(vars))
```

Add the new injection immediately before it:

```js
  await jail.set('$__performance_now', new ivm.Reference(() => performance.now()))
  await jail.set('$__vars', JSON.stringify(vars))
```

- [ ] **Step 3: Run the test suite**

```bash
cd crunes-cli
npm test
```

Expected: all tests pass. (No bootstrap change yet — this just verifies the injection compiles and doesn't break anything.)

- [ ] **Step 4: Commit**

```bash
cd crunes-cli
git add package.json package-lock.json src/rune/isolation/runner.js
git commit -m "feat(sandbox): add whatwg-url + buffer deps, inject performance.now bridge"
```

---

### Task 2: Add `Event` / `EventTarget` / `CustomEvent` and upgrade `AbortSignal`

**Files:**
- Modify: `crunes-cli/src/rune/isolation/utils-bootstrap.js:19-59`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces:
  - `EventTarget` class — `addEventListener(type, fn)`, `removeEventListener(type, fn)`, `dispatchEvent(event)`
  - `Event` class — `constructor(type, init?)`, `.type`, `.bubbles`, `.cancelable`, `.defaultPrevented`, `.preventDefault()`
  - `CustomEvent extends Event` — adds `.detail`
  - `AbortSignal extends EventTarget` — `.aborted`, `.reason`, `._abort(reason?)`, `.throwIfAborted()`, `AbortSignal.abort(reason?)`, `AbortSignal.timeout(ms)` (existing)
  - `AbortController` — unchanged

- [ ] **Step 1: Replace the `AbortSignal` + `AbortController` block**

The current block spans lines 19–59 of `src/rune/isolation/utils-bootstrap.js`. Replace the entire block (from `class AbortSignal {` through the `AbortSignal.timeout` assignment at line 59) with the following:

```js
class EventTarget {
  constructor() { this._listeners = {} }
  addEventListener(type, fn) { (this._listeners[type] ??= []).push(fn) }
  removeEventListener(type, fn) {
    this._listeners[type] = (this._listeners[type] ?? []).filter(f => f !== fn)
  }
  dispatchEvent(event) {
    for (const fn of (this._listeners[event.type] ?? [])) fn.call(this, event)
    return true
  }
}
class Event {
  constructor(type, init = {}) {
    this.type = type
    this.bubbles = !!init.bubbles
    this.cancelable = !!init.cancelable
    this.defaultPrevented = false
  }
  preventDefault() { if (this.cancelable) this.defaultPrevented = true }
}
class CustomEvent extends Event {
  constructor(type, init = {}) { super(type, init); this.detail = init.detail ?? null }
}
globalThis.EventTarget = EventTarget
globalThis.Event = Event
globalThis.CustomEvent = CustomEvent

class AbortSignal extends EventTarget {
  constructor() {
    super()
    this.aborted = false
    this.reason = undefined
  }
  _abort(reason) {
    if (this.aborted) return
    this.aborted = true
    this.reason = reason ?? new Error('AbortError')
    this.dispatchEvent(new Event('abort'))
  }
  throwIfAborted() {
    if (this.aborted) throw this.reason
  }
}
class AbortController {
  constructor() {
    this.signal = new AbortSignal()
  }
  abort(reason) {
    this.signal._abort(reason)
  }
}
AbortSignal.abort = (reason) => {
  const s = new AbortSignal()
  s._abort(reason)
  return s
}
AbortSignal.timeout = (ms) => {
  const ctrl = new AbortController()
  setTimeout(() => ctrl.abort(), ms)
  return ctrl.signal
}

globalThis.AbortController = AbortController
globalThis.AbortSignal = AbortSignal
```

Note: `AbortController.abort(reason)` is upgraded here too — the old impl called `signal.dispatchEvent({ type: 'abort' })` directly, bypassing the new `_abort` logic.

- [ ] **Step 2: Build and run tests**

```bash
cd crunes-cli
npm run build && npm test
```

Expected: build succeeds, all tests pass.

- [ ] **Step 3: Quick manual smoke test**

```bash
cd crunes-cli
node -e "
import('./dist/cli.js').then(async () => {
  console.log('build ok')
}).catch(e => console.error(e))
" 2>&1 | head -5
```

Expected: `build ok` (or the normal CLI help output — no errors).

- [ ] **Step 4: Commit**

```bash
cd crunes-cli
git add src/rune/isolation/utils-bootstrap.js
git commit -m "feat(sandbox): add EventTarget/Event/CustomEvent, upgrade AbortSignal"
```

---

### Task 3: Add npm-backed `URL`, `Buffer` and remove hand-rolled `URLSearchParams`

**Files:**
- Modify: `crunes-cli/src/rune/isolation/utils-bootstrap.js:1-12` (imports)
- Modify: `crunes-cli/src/rune/isolation/utils-bootstrap.js:156-195` (remove URLSearchParams hand-roll)

**Interfaces:**
- Consumes: `whatwg-url` and `buffer` devDeps installed in Task 1
- Produces:
  - `URL` — full WHATWG URL class, `instanceof` and subclassing work
  - `URLSearchParams` — full WHATWG spec impl (replaces hand-roll)
  - `Buffer` — feross Buffer, `from`, `alloc`, `concat`, `isBuffer`, `.toString('hex'/'base64'/'utf8')`

- [ ] **Step 1: Add imports at the top of utils-bootstrap.js**

After line 11 (the `web-streams-polyfill` import), add:

```js
import { URL, URLSearchParams } from 'whatwg-url'
import { Buffer } from 'buffer'
```

The top of the file should now look like:

```js
import * as md from 'crunes:md'
import * as tree from 'crunes:tree'

const __vars = JSON.parse($__vars)

import { TextEncoder, TextDecoder } from 'fast-text-encoding'
import { ReadableStream, WritableStream, TransformStream, ByteLengthQueuingStrategy, CountQueuingStrategy } from 'web-streams-polyfill'
import { URL, URLSearchParams } from 'whatwg-url'
import { Buffer } from 'buffer'
```

- [ ] **Step 2: Remove the hand-rolled `URLSearchParams` block**

Delete lines 156–195 (the entire `class URLSearchParams { ... }` block and its `globalThis.URLSearchParams = URLSearchParams` assignment on line 195). These are fully replaced by the `whatwg-url` import.

- [ ] **Step 3: Build and run tests**

```bash
cd crunes-cli
npm run build && npm test
```

Expected: build succeeds, all tests pass. The esbuild inner bundle (for the isolate) will now include `whatwg-url` and `buffer`.

- [ ] **Step 4: Commit**

```bash
cd crunes-cli
git add src/rune/isolation/utils-bootstrap.js
git commit -m "feat(sandbox): add URL/Buffer from npm, remove hand-rolled URLSearchParams"
```

---

### Task 4: Add inline compat globals (`structuredClone`, `queueMicrotask`, `atob/btoa`, `performance`, `Buffer`, `URL`, `URLSearchParams` assignments)

**Files:**
- Modify: `crunes-cli/src/rune/isolation/utils-bootstrap.js` — add compat block after `TextDecoderStream` assignments (currently around line 228 after Task 2/3 edits)

**Interfaces:**
- Consumes: `Buffer` (from Task 3 import), `$__performance_now` (from Task 1 runner injection), `URL`/`URLSearchParams` (from Task 3 import)
- Produces:
  - `globalThis.structuredClone` — JSON round-trip clone
  - `globalThis.queueMicrotask` — microtask scheduling via Promise
  - `globalThis.btoa(str)` — base64 encode string
  - `globalThis.atob(b64)` — base64 decode to string
  - `globalThis.performance` — `{ now(): number }`
  - `globalThis.Buffer` — feross Buffer class
  - `globalThis.URL` — WHATWG URL class
  - `globalThis.URLSearchParams` — WHATWG URLSearchParams class

- [ ] **Step 1: Add the compat globals block**

After the `globalThis.TextEncoderStream` / `globalThis.TextDecoderStream` assignments (which follow the `TextDecoderStream` class definition), add:

```js
globalThis.structuredClone = (val) => JSON.parse(JSON.stringify(val))
globalThis.queueMicrotask = (fn) => Promise.resolve().then(fn)
globalThis.btoa = (str) => Buffer.from(str, 'binary').toString('base64')
globalThis.atob = (b64) => Buffer.from(b64, 'base64').toString('binary')
globalThis.performance = { now: () => $__performance_now.applySync(undefined, []) }
globalThis.Buffer = Buffer
globalThis.URL = URL
globalThis.URLSearchParams = URLSearchParams
```

- [ ] **Step 2: Build and run tests**

```bash
cd crunes-cli
npm run build && npm test
```

Expected: build succeeds, all tests pass.

- [ ] **Step 3: Commit**

```bash
cd crunes-cli
git add src/rune/isolation/utils-bootstrap.js
git commit -m "feat(sandbox): add structuredClone, queueMicrotask, atob/btoa, performance, Buffer, URL globals"
```

---

### Task 5: Write and run scratch verification rune

**Files:**
- Create: `crunes-cli/scratch/compat-test.js` (gitignored, for manual verification only)

**Interfaces:**
- Consumes: all globals added in Tasks 1–4

- [ ] **Step 1: Create the scratch verification rune**

Create `scratch/compat-test.js` (this directory is gitignored):

```js
import { section } from '@utils'

const u = new URL('https://example.com/path?foo=bar')

const buf = Buffer.from('hello')

const cloned = structuredClone({ a: 1, b: [2, 3] })

let microtaskFired = false
queueMicrotask(() => { microtaskFired = true })
await Promise.resolve()

const et = new EventTarget()
let eventFired = false
et.addEventListener('test', () => { eventFired = true })
et.dispatchEvent(new Event('test'))

const ce = new CustomEvent('myevent', { detail: { x: 42 } })
const ceDetail = ce.detail.x

const sig = AbortSignal.abort()
let abortListenerFired = false
const sig2 = new AbortController()
sig2.signal.addEventListener('abort', () => { abortListenerFired = true })
sig2.abort()

const perfNow = performance.now()

export default section.create('compat-test', {
  type: 'markdown',
  content: [
    `URL hostname: ${u.hostname}`,
    `URL searchParams.get: ${u.searchParams.get('foo')}`,
    `Buffer hex: ${buf.toString('hex')}`,
    `Buffer base64: ${buf.toString('base64')}`,
    `structuredClone: ${JSON.stringify(cloned)}`,
    `queueMicrotask fired: ${microtaskFired}`,
    `btoa: ${btoa('hello')}`,
    `atob: ${atob('aGVsbG8=')}`,
    `EventTarget fired: ${eventFired}`,
    `CustomEvent detail: ${ceDetail}`,
    `AbortSignal.abort().aborted: ${sig.aborted}`,
    `AbortController abort listener: ${abortListenerFired}`,
    `performance.now > 0: ${perfNow > 0}`,
  ].join('\n'),
})
```

- [ ] **Step 2: Build and run**

```bash
cd crunes-cli
npm run build
node dist/cli.js -p run ../scratch/compat-test.js
```

Expected output (each line should show the correct value):
```
URL hostname: example.com
URL searchParams.get: bar
Buffer hex: 68656c6c6f
Buffer base64: aGVsbG8=
structuredClone: {"a":1,"b":[2,3]}
queueMicrotask fired: true
btoa: aGVsbG8=
atob: hello
EventTarget fired: true
CustomEvent detail: 42
AbortSignal.abort().aborted: true
AbortController abort listener: true
performance.now > 0: true
```

- [ ] **Step 3: Run full test suite one final time**

```bash
cd crunes-cli
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Final release commit — use release rune**

```bash
cd crunes-cli
crunes run release bump patch -a "**Sandbox Compat Globals**: Added URL, Buffer, EventTarget, Event, CustomEvent, structuredClone, queueMicrotask, atob/btoa, performance.now to the isolated-vm sandbox. Upgraded AbortSignal to extend EventTarget with reason, throwIfAborted(), and AbortSignal.abort() static. Replaced hand-rolled URLSearchParams with spec-complete whatwg-url implementation."
crunes run release git
```
