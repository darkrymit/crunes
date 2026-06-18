# Binary API Unification Design

**Date:** 2026-06-18  
**Scope:** `crunes-cli` — `fs` and `shell` namespaces, type definitions only (no implementation detail changes)

---

## Problem

The current API has two inconsistent conventions for binary I/O:

1. `fs` uses an `AsBytes` suffix — `readAsBytes`, `writeAsBytes`, `appendAsBytes`, `readStreamAsBytes`, `writeStreamAsBytes`
2. `shell` uses a `binary: true` flag on `exec` and `spawn` — collapsing binary and text modes into one method with a union return type (`stdout: string | Uint8Array`)

The flag-based approach breaks TypeScript inference: callers cannot narrow `ShellResult.stdout` without a type assertion or `instanceof` check, even though the mode is known at the call site.

---

## Convention

Two semantic patterns, each used where it fits:

- **`fs` methods** use `Bytes` as a noun suffix — the suffix names *what you get or write* (the data type).
- **`shell` methods** use `Binary` as a mode suffix — the suffix names *how the command behaves* (a mode).
- **Stream methods** follow `<verb>BytesStream` word order — `Bytes` modifies `Stream`, not the other way around.

No `binary: true` flag remains anywhere. Old `AsBytes` names are removed with no deprecation aliases.

---

## `fs` Renames

| Removed | Replacement | Notes |
|---|---|---|
| `fs.readAsBytes` | `fs.readBytes` | |
| `fs.writeAsBytes` | `fs.writeBytes` | |
| `fs.appendAsBytes` | `fs.appendBytes` | |
| `fs.readStreamAsBytes` | `fs.readBytesStream` | |
| `fs.writeStreamAsBytes` | `fs.writeBytesStream` | |
| *(missing)* | `fs.appendBytesStream` | New addition — closes the gap with `fs.appendBytes` |

`fs.appendBytesStream` returns `WritableStream<Uint8Array>`, mirrors `fs.writeBytesStream`.

---

## `shell` Renames

| Removed | Replacement |
|---|---|
| `shell.exec` + `binary: true` | `shell.execBinary` |
| `shell.spawn` + `binary: true` | `shell.spawnBinary` |

`shell.exec` and `shell.spawn` remain unchanged except the `binary` option is removed from their signatures. `ShellResult.stdout` becomes `string` (no more `string | Uint8Array` union).

`shell.execBinary` returns `Promise<ShellResult<Uint8Array>>` where `stdout` is `Uint8Array`.

---

## `ShellSession<T>` Generic

`ShellSessionReadableStream` becomes generic. `stderr` is pinned to `string` — it is never binary regardless of mode.

```ts
interface ShellSessionReadableStream<T extends string | Uint8Array = string> extends ReadableStream<T> {
  on(event: 'data', callback: (chunk: T) => void): void
  on(event: 'end', callback: () => void): void
}

interface ShellSession<T extends string | Uint8Array = string> {
  readonly stdin: ShellSessionWritableStream        // unchanged — accepts string | Uint8Array
  readonly stdout: ShellSessionReadableStream<T>
  readonly stderr: ShellSessionReadableStream<string>  // always string, never binary
  open(): void
  kill(signal?: string): void
  on(event: 'exit', callback: (code: number) => void): void
  on(event: 'error', callback: (err: string) => void): void
}
```

`ShellSessionWritableStream` is unchanged — `write(text: string | Uint8Array)` already accepts both.

`spawn` and `spawnBinary` signatures:

```ts
function spawn(cmd: string, opts?: { env?: Record<string, string>; signal?: AbortSignal }): ShellSession<string>
function spawnBinary(cmd: string, opts?: { env?: Record<string, string>; signal?: AbortSignal }): ShellSession<Uint8Array>
```

---

## `ShellResult<T>` Generic

```ts
interface ShellResult<T extends string | Uint8Array = string> {
  stdout: T
  stderr: string   // always string
  exitCode: number
  ok: boolean
}
```

`exec` returns `Promise<ShellResult<string>>`.  
`execBinary` returns `Promise<ShellResult<Uint8Array>>`.

---

## Out of Scope

The following issues identified in the API review are explicitly excluded from this migration:

- `ws.sendBinary` `ArrayBuffer` inconsistency
- `cache` binary value corruption via JSON round-trip
- `crypto` string key/IV encoding ambiguity
- `http.Response.bytes()` missing method
