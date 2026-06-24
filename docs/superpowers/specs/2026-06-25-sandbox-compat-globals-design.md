# Sandbox Compat Globals Pass — Design Spec

## Goal

Maximize npm library compatibility inside the crunes-cli isolated-vm sandbox by adding missing web-standard globals and minimal Node-compat shims to `utils-bootstrap.js`.

## Background

The ivm isolate is a bare V8 context. An audit (`scratch/isolate-globals-test.mjs`) confirmed that only JS language primitives are available natively — `Promise`, `Error`, typed arrays, `WeakRef`, `FinalizationRegistry`. Every web-standard global (`TextEncoder`, `AbortController`, `fetch`, streams, etc.) must be explicitly injected. The current bootstrap already provides many of these, but several high-value globals are missing entirely.

## Scope

### Add (new globals)

| Global | Source | Notes |
|--------|--------|-------|
| `URL` | `whatwg-url` npm (devDep, bundled) | Spec-complete. `instanceof URL` and subclassing work. |
| `URLSearchParams` | `whatwg-url` npm (replaces hand-roll) | Migrate from existing 40-line hand-roll to spec-complete export. |
| `Buffer` | `buffer` npm (feross, devDep, bundled) | `Uint8Array`-backed. `from`, `alloc`, `concat`, `isBuffer`, `.toString('hex'/'base64'/'utf8')` all work. |
| `Event` | Inline | `type`, `bubbles`, `cancelable`, `defaultPrevented`, `preventDefault()`. |
| `EventTarget` | Inline | `addEventListener`, `removeEventListener`, `dispatchEvent`. |
| `CustomEvent` | Inline | Extends `Event`, adds `detail`. |
| `structuredClone` | Inline | JSON round-trip. Handles plain objects, arrays, primitives. Does not clone `Date`, `Map`, `Set`, `RegExp`, functions — acceptable for target use cases. |
| `queueMicrotask` | Inline | `Promise.resolve().then(fn)` — spec-correct scheduling. |
| `atob` / `btoa` | Inline (via `Buffer`) | Delegates to `Buffer.from(str, 'binary').toString('base64')` and inverse. |
| `performance` | Inline + host bridge | `{ now() }` via `$__performance_now` ivm Reference injected from `runner.js`. |

### Upgrade (existing globals)

| Global | Change |
|--------|--------|
| `AbortSignal` | Extend `EventTarget`. Add `_abort(reason)` that fires `abort` event. Add `AbortSignal.abort(reason)` static. Add `throwIfAborted()` instance method. Add `reason` property. |

### Keep as-is

| Global | Reason |
|--------|--------|
| `fast-text-encoding` → `TextEncoder`/`TextDecoder` | No better alternative; `whatwg-encoding` is deprecated. |
| `web-streams-polyfill` → streams | Must stay isolate-side; host streams cannot cross ivm boundary. |
| Hand-rolled `Blob` | `fetch-blob` depends on Node streams — not suitable. |
| Hand-rolled `FormData` | `formdata-polyfill` has Node deps. |
| Hand-rolled `AbortController` | Sufficient; only `AbortSignal` needs upgrading. |
| Hand-rolled `Request` / `Response` / `fetch` | Custom ivm bridge — cannot be replaced by any npm fetch lib. |

### Explicitly out of scope

- `process` — Node-specific, no web-standard equivalent.
- Full `Buffer` Node.js semantics (`pipe`, `readableStream`, etc.).
- `EventEmitter` — Node-specific.
- IDN / internationalized hostname support in `URL`.

## New npm Dependencies

Both go in `devDependencies` — they are bundled by esbuild into the isolate bootstrap at build time and are not needed at runtime.

```json
"devDependencies": {
  "buffer": "^6.0.3",
  "whatwg-url": "^16.0.0"
}
```

`build.mjs` requires no changes — both packages bundle cleanly through esbuild (no CJS internal requires, no native bindings, no dynamic imports).

## Files Changed

| File | Change |
|------|--------|
| `src/rune/isolation/utils-bootstrap.js` | Add imports, remove hand-rolled `URLSearchParams`, add new globals |
| `src/rune/isolation/runner.js` | Add `$__performance_now` jail injection |
| `package.json` | Add `buffer` and `whatwg-url` to `devDependencies` |
| `package-lock.json` | Regenerated after `npm install` |

## Implementation Detail

### `runner.js` — new jail injection

Add alongside existing `$__utils_*` injections:

```js
jail.setSync('$__performance_now', new ivm.Reference(() => performance.now()))
```

### `utils-bootstrap.js` — import block changes

Replace:
```js
// before (top of file, imports section)
import { TextEncoder, TextDecoder } from 'fast-text-encoding'
import { ReadableStream, ... } from 'web-streams-polyfill'
```

Add after existing imports:
```js
import { URL, URLSearchParams } from 'whatwg-url'
import { Buffer } from 'buffer'
```

### `utils-bootstrap.js` — remove hand-rolled `URLSearchParams`

Delete the existing `class URLSearchParams { ... }` block (~40 lines) and its `globalThis.URLSearchParams = URLSearchParams` assignment. The imported `URLSearchParams` from `whatwg-url` is assigned to `globalThis` in the new globals block instead.

### `utils-bootstrap.js` — new `Event` / `EventTarget` / `CustomEvent` (inline, before `AbortSignal`)

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
```

### `utils-bootstrap.js` — upgrade `AbortSignal`

Change `class AbortSignal` to `class AbortSignal extends EventTarget`.

Replace the internal `_abort()` logic with:
```js
_abort(reason) {
  if (this.aborted) return
  this.aborted = true
  this.reason = reason ?? new Error('AbortError')
  this.dispatchEvent(new Event('abort'))
}
throwIfAborted() {
  if (this.aborted) throw this.reason
}
```

Add static after the class definition:
```js
AbortSignal.abort = (reason) => {
  const s = new AbortSignal()
  s._abort(reason)
  return s
}
```

### `utils-bootstrap.js` — new compat globals block (after streams/encoding section)

Add a clearly delineated block:

```js
// — Compat globals —
globalThis.structuredClone = (val) => JSON.parse(JSON.stringify(val))
globalThis.queueMicrotask = (fn) => Promise.resolve().then(fn)
globalThis.btoa = (str) => Buffer.from(str, 'binary').toString('base64')
globalThis.atob = (b64) => Buffer.from(b64, 'base64').toString('binary')
globalThis.performance = { now: () => $__performance_now.applySync(undefined, []) }
globalThis.Buffer = Buffer
globalThis.URL = URL
globalThis.URLSearchParams = URLSearchParams
```

## Testing

Existing test suite (`npm test`) must pass without modification — no existing globals are removed, only added or upgraded.

Manual verification in `scratch/` after build:

```js
// scratch/compat-test.js (rune)
import { section } from '@utils'
const u = new URL('https://example.com/path?foo=bar')
const buf = Buffer.from('hello')
const cloned = structuredClone({ a: 1, b: [2, 3] })
let microtaskFired = false
queueMicrotask(() => { microtaskFired = true })
await Promise.resolve() // let microtask queue drain
const et = new EventTarget()
let eventFired = false
et.addEventListener('test', () => { eventFired = true })
et.dispatchEvent(new Event('test'))
const sig = AbortSignal.abort()
export default section.create('compat-test', {
  type: 'markdown',
  content: [
    `URL host: ${u.hostname}`,
    `URL search: ${u.searchParams.get('foo')}`,
    `Buffer hex: ${buf.toString('hex')}`,
    `structuredClone: ${JSON.stringify(cloned)}`,
    `queueMicrotask: ${microtaskFired}`,
    `btoa: ${btoa('hello')}`,
    `atob: ${atob('aGVsbG8=')}`,
    `EventTarget: ${eventFired}`,
    `AbortSignal.abort: ${sig.aborted}`,
    `performance.now: ${performance.now() > 0}`,
  ].join('\n'),
})
```

Expected output — all assertions true/matching expected values.

## Ordering Constraint

`EventTarget` / `Event` / `CustomEvent` must be defined **before** `AbortSignal` in the file, since the upgraded `AbortSignal extends EventTarget`.
