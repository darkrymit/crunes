# `crypt` Rename + Web Crypto Injection — Design Spec

Brainstormed 2026-06-24.

---

## Goal

Two related changes shipped together:

1. Rename `utils.crypto` → `utils.crypt` to free the `crypto` name for the standard Web Crypto global.
2. Inject `globalThis.crypto` (Web Crypto API) into the isolate so npm packages using `crypto.subtle.*` or `crypto.getRandomValues()` work without modification.

---

## Part 1 — Rename `utils.crypto` → `utils.crypt`

### Files touched

| Action | File |
|--------|------|
| Rename | `src/rune/api/crypto.js` → `src/rune/api/crypt.js` |
| Rename | `src/rune/api/types-utils/crypto.d.ts` → `src/rune/api/types-utils/crypt.d.ts` |
| Modify | `src/rune/api/index.js` — import from `./crypt.js` |
| Modify | `src/rune/isolation/runner.js` — all `$__utils_crypto_*` jail keys → `$__utils_crypt_*` |
| Modify | `src/rune/isolation/utils-bootstrap.js` — `crypto:` block → `crypt:`, all `$__utils_crypto_*` refs → `$__utils_crypt_*`, named export updated |
| Modify | `src/rune/api/types-utils/crypt.d.ts` — `declare namespace crypto` → `declare namespace crypt` |

### What does NOT change

- Internal implementation in `crypt.js` — zero logic changes, pure rename
- Permission tokens — `crypt` has no permission tokens (pure compute)
- Test files — updated to import from `./crypt.js` and reference `utils.crypt`

---

## Part 2 — Inject `globalThis.crypto` (Web Crypto)

### What gets injected

Node's `globalThis.crypto` is a native `Crypto` object available since Node 19. It is bridged into the ivm isolate as `globalThis.crypto` with the following surface:

```
crypto.subtle.encrypt(algorithm, key, data)        → Promise<ArrayBuffer>
crypto.subtle.decrypt(algorithm, key, data)        → Promise<ArrayBuffer>
crypto.subtle.sign(algorithm, key, data)           → Promise<ArrayBuffer>
crypto.subtle.verify(algorithm, key, signature, data) → Promise<boolean>
crypto.subtle.digest(algorithm, data)              → Promise<ArrayBuffer>
crypto.subtle.generateKey(algorithm, extractable, keyUsages) → Promise<CryptoKey | CryptoKeyPair>
crypto.subtle.importKey(format, keyData, algorithm, extractable, keyUsages) → Promise<CryptoKey>
crypto.subtle.exportKey(format, key)               → Promise<ArrayBuffer | JsonWebKey>
crypto.subtle.deriveKey(algorithm, baseKey, derivedKeyAlgorithm, extractable, keyUsages) → Promise<CryptoKey>
crypto.subtle.deriveBits(algorithm, baseKey, length) → Promise<ArrayBuffer>
crypto.subtle.wrapKey(format, key, wrappingKey, wrapAlgorithm) → Promise<ArrayBuffer>
crypto.subtle.unwrapKey(format, wrappedKey, unwrappingKey, unwrapAlgorithm, unwrappedKeyAlgorithm, extractable, keyUsages) → Promise<CryptoKey>
crypto.getRandomValues(typedArray)                 → typedArray (filled in-place)
crypto.randomUUID()                                → string
```

### Architecture

The injection happens in `runner.js` inside `injectUtils`, using a single `ivm.Reference` that wraps `globalThis.crypto` from the Node host. Since ivm cannot copy `CryptoKey` objects across the boundary (they are opaque handles), they are kept on the host side and referenced by an integer ID — a handle map, similar to the existing stream/hash/cipher handle patterns already in `runner.js`.

**Handle map pattern** (already used for streams, hash, cipher):
- `generateKey` / `importKey` / `deriveKey` → store result in `Map<number, CryptoKey>`, return integer handle to isolate
- `exportKey` / `wrapKey` → accept handle ID, return serializable data (ArrayBuffer or JsonWebKey object)
- `encrypt` / `decrypt` / `sign` / `verify` / `digest` / `deriveBits` / `unwrapKey` → accept handle ID for key, pass data as ArrayBuffer copy

**`getRandomValues`**: accepts a typed array from the isolate (copy in), fills it with random bytes on the host, returns the filled ArrayBuffer (copy back). The isolate-side shim reconstructs the typed array from the returned buffer.

**`randomUUID`**: pure sync call, returns a string.

### Isolate-side shim (in `utils-bootstrap.js`)

The shim reconstructs the `globalThis.crypto` object inside the isolate so npm packages see the standard Web Crypto interface:

```js
globalThis.crypto = {
  randomUUID: () => $__webcrypto_random_uuid.applySync(undefined, []),
  getRandomValues(array) {
    const buf = $__webcrypto_get_random_values.applySync(undefined, [array.buffer], { arguments: { copy: true }, result: { copy: true } })
    array.set(new array.constructor(buf))
    return array
  },
  subtle: {
    digest: (alg, data) => $__webcrypto_subtle_digest.apply(undefined, [alg, data instanceof ArrayBuffer ? data : data.buffer], { arguments: { copy: true }, result: { promise: true, copy: true } }),
    sign: (alg, keyHandle, data) => $__webcrypto_subtle_sign.apply(undefined, [alg, keyHandle, data instanceof ArrayBuffer ? data : data.buffer], { arguments: { copy: true }, result: { promise: true, copy: true } }),
    verify: (alg, keyHandle, sig, data) => $__webcrypto_subtle_verify.apply(undefined, [alg, keyHandle, sig instanceof ArrayBuffer ? sig : sig.buffer, data instanceof ArrayBuffer ? data : data.buffer], { arguments: { copy: true }, result: { promise: true, copy: true } }),
    encrypt: (alg, keyHandle, data) => $__webcrypto_subtle_encrypt.apply(undefined, [alg, keyHandle, data instanceof ArrayBuffer ? data : data.buffer], { arguments: { copy: true }, result: { promise: true, copy: true } }),
    decrypt: (alg, keyHandle, data) => $__webcrypto_subtle_decrypt.apply(undefined, [alg, keyHandle, data instanceof ArrayBuffer ? data : data.buffer], { arguments: { copy: true }, result: { promise: true, copy: true } }),
    generateKey: (alg, extractable, usages) => $__webcrypto_subtle_generate_key.apply(undefined, [alg, extractable, usages], { arguments: { copy: true }, result: { promise: true, copy: true } }),
    importKey: (format, keyData, alg, extractable, usages) => $__webcrypto_subtle_import_key.apply(undefined, [format, keyData instanceof ArrayBuffer ? keyData : (keyData?.buffer ?? keyData), alg, extractable, usages], { arguments: { copy: true }, result: { promise: true, copy: true } }),
    exportKey: (format, keyHandle) => $__webcrypto_subtle_export_key.apply(undefined, [format, keyHandle], { arguments: { copy: true }, result: { promise: true, copy: true } }),
    deriveKey: (alg, baseKeyHandle, derivedAlg, extractable, usages) => $__webcrypto_subtle_derive_key.apply(undefined, [alg, baseKeyHandle, derivedAlg, extractable, usages], { arguments: { copy: true }, result: { promise: true, copy: true } }),
    deriveBits: (alg, baseKeyHandle, length) => $__webcrypto_subtle_derive_bits.apply(undefined, [alg, baseKeyHandle, length], { arguments: { copy: true }, result: { promise: true, copy: true } }),
    wrapKey: (format, keyHandle, wrappingKeyHandle, wrapAlg) => $__webcrypto_subtle_wrap_key.apply(undefined, [format, keyHandle, wrappingKeyHandle, wrapAlg], { arguments: { copy: true }, result: { promise: true, copy: true } }),
    unwrapKey: (format, wrappedData, unwrappingKeyHandle, unwrapAlg, unwrappedAlg, extractable, usages) => $__webcrypto_subtle_unwrap_key.apply(undefined, [format, wrappedData instanceof ArrayBuffer ? wrappedData : wrappedData.buffer, unwrappingKeyHandle, unwrapAlg, unwrappedAlg, extractable, usages], { arguments: { copy: true }, result: { promise: true, copy: true } }),
  }
}
```

`CryptoKey` objects never cross the boundary — `generateKey` and `importKey` return an integer handle. The isolate shim wraps handles in a plain object `{ __cryptoKeyHandle: number }` so code that passes a key back into sign/encrypt/etc. works transparently.

### Files touched

| Action | File |
|--------|------|
| Modify | `src/rune/isolation/runner.js` — add `$__webcrypto_*` jail keys, handle map |
| Modify | `src/rune/isolation/utils-bootstrap.js` — add `globalThis.crypto` shim |
| Modify | `src/rune/api/types-globals/globals.d.ts` — add `SubtleCrypto`, `CryptoKey`, `CryptoKeyPair`, `Crypto`, `const crypto: Crypto` |

### No permission token

`globalThis.crypto` is a pure compute API (no I/O, no network, no filesystem). It requires no permission gating — same as `TextEncoder` or `Math`.

---

## Type Declarations

### `crypt.d.ts`

Identical to current `crypto.d.ts` with `declare namespace crypt` instead of `declare namespace crypto`.

### `globals.d.ts` additions

```ts
interface CryptoKey {
  readonly type: 'public' | 'private' | 'secret'
  readonly extractable: boolean
  readonly algorithm: object
  readonly usages: string[]
}

interface CryptoKeyPair {
  readonly privateKey: CryptoKey
  readonly publicKey: CryptoKey
}

type JsonWebKey = Record<string, unknown>

interface SubtleCrypto {
  digest(algorithm: string | object, data: ArrayBuffer | Uint8Array): Promise<ArrayBuffer>
  sign(algorithm: string | object, key: CryptoKey, data: ArrayBuffer | Uint8Array): Promise<ArrayBuffer>
  verify(algorithm: string | object, key: CryptoKey, signature: ArrayBuffer | Uint8Array, data: ArrayBuffer | Uint8Array): Promise<boolean>
  encrypt(algorithm: string | object, key: CryptoKey, data: ArrayBuffer | Uint8Array): Promise<ArrayBuffer>
  decrypt(algorithm: string | object, key: CryptoKey, data: ArrayBuffer | Uint8Array): Promise<ArrayBuffer>
  generateKey(algorithm: object, extractable: boolean, keyUsages: string[]): Promise<CryptoKey | CryptoKeyPair>
  importKey(format: string, keyData: ArrayBuffer | Uint8Array | JsonWebKey, algorithm: string | object, extractable: boolean, keyUsages: string[]): Promise<CryptoKey>
  exportKey(format: 'raw' | 'pkcs8' | 'spki', key: CryptoKey): Promise<ArrayBuffer>
  exportKey(format: 'jwk', key: CryptoKey): Promise<JsonWebKey>
  deriveKey(algorithm: object, baseKey: CryptoKey, derivedKeyAlgorithm: object, extractable: boolean, keyUsages: string[]): Promise<CryptoKey>
  deriveBits(algorithm: object, baseKey: CryptoKey, length: number): Promise<ArrayBuffer>
  wrapKey(format: string, key: CryptoKey, wrappingKey: CryptoKey, wrapAlgorithm: string | object): Promise<ArrayBuffer>
  unwrapKey(format: string, wrappedKey: ArrayBuffer | Uint8Array, unwrappingKey: CryptoKey, unwrapAlgorithm: string | object, unwrappedKeyAlgorithm: string | object, extractable: boolean, keyUsages: string[]): Promise<CryptoKey>
}

interface Crypto {
  readonly subtle: SubtleCrypto
  getRandomValues<T extends ArrayBufferView>(array: T): T
  randomUUID(): string
}

const crypto: Crypto
```

---

## Out of Scope

- `crypto.subtle` stream variants — not part of Web Crypto spec
- Exposing `CryptoKey` internals across the ivm boundary — keys stay opaque on host side
- Permission gating on specific algorithms — pure compute, no gating needed
- Polyfilling missing Node crypto algorithms — use whatever Node supports

---

## Self-Review

**Spec coverage:**
- ✅ Rename `utils.crypto` → `utils.crypt` — all files listed
- ✅ Full SubtleCrypto surface — all 12 methods covered
- ✅ `getRandomValues` + `randomUUID` — both covered
- ✅ `CryptoKey` handle map — opaque handle pattern described
- ✅ Type declarations — both `crypt.d.ts` and `globals.d.ts` additions specified
- ✅ No permission token — justified

**Placeholder scan:** None.

**Internal consistency:** Handle pattern (`{ __cryptoKeyHandle: number }`) used consistently in shim for all key-accepting methods. `generateKey` returns handle(s), `importKey` returns handle, `deriveKey` returns handle, `unwrapKey` returns handle.

**Ambiguity:** `generateKey` for asymmetric algorithms returns a `CryptoKeyPair` — the host returns `{ privateKey: handleA, publicKey: handleB }` as a plain object with two handles. Isolate receives it as a copied object. Covered implicitly by the shim's `{ arguments: { copy: true }, result: { promise: true, copy: true } }` pattern.
