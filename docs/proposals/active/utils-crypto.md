---
tags:
  - proposed
---

# Proposal: Crypto Utilities (`utils.crypto`)

## Overview

This proposal introduces `utils.crypto`, a lightweight bridge to Node's native `node:crypto` module. It gives Runes access to hardware-accelerated hashing, secure random generation, and UUID creation without bundling any JS-based cryptography library in the sandbox.

## Motivation

Automation workflows regularly need to hash file content for change detection, generate unique identifiers for scaffolded artifacts, or produce random tokens for configuration. Without `utils.crypto`, rune authors resort to implementing their own hashing logic or importing third-party libraries — neither of which is practical inside an isolated-vm sandbox.

By bridging directly to `node:crypto` on the host, all operations inherit Node's native performance and security without adding any dependency weight to the sandbox.

## API

```js
// Hash any string or Buffer — returns a hex string
const checksum = utils.crypto.hash('sha256', content);
const md5      = utils.crypto.hash('md5', content);

// Generate a random UUID (v4)
const id = utils.crypto.uuid();

// Generate cryptographically secure random bytes — returns a hex string
const token = utils.crypto.randomBytes(32);
```

- **`utils.crypto.hash(algorithm, data)`** — Computes a hash of `data` (string or Buffer) using the given algorithm. Returns a lowercase hex string. Supported algorithms are those exposed by `node:crypto` (`sha256`, `sha512`, `md5`, etc.). Throws on an unrecognized algorithm name.
- **`utils.crypto.uuid()`** — Returns a RFC 4122 v4 UUID string using `crypto.randomUUID()`.
- **`utils.crypto.randomBytes(size)`** — Returns `size` cryptographically random bytes encoded as a lowercase hex string.

## Permissions

`utils.crypto` is always available to all runes without any permission declaration. All operations are pure computations or local random generation with no I/O or side effects.

## Implementation Groundwork

1. **Host implementation**: Add `src/rune/api/utils/crypto.js`. Implement `hash`, `uuid`, and `randomBytes` using `node:crypto` — `createHash`, `randomUUID`, and `randomBytes` respectively.
2. **Isolate bridge**: Register `utils.crypto` in `src/rune/isolation/builtins.js`, exposing all three methods as `ivm.Reference` callbacks. Inputs and outputs are plain strings — no complex boundary serialization required.
3. **Algorithm validation**: On the host side, catch the error thrown by `createHash` for unknown algorithm names and re-throw a clear `Error` with the algorithm name in the message before it crosses the isolate boundary.
