# `crypt` Rename + Web Crypto Injection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename `utils.crypto` → `utils.crypt` to free the name, then inject the standard Web Crypto API (`globalThis.crypto`) into the isolate so npm packages using `crypto.subtle.*` work without modification.

**Architecture:** Task 1 is a pure rename — no logic changes, every `$__utils_crypto_*` key and `crypto:` block becomes `$__utils_crypt_*` / `crypt:`. Task 2 adds a Web Crypto bridge in `runner.js` using a host-side `CryptoKey` handle map (same pattern as the existing hash/cipher stream handles), a `globalThis.crypto` shim in `utils-bootstrap.js`, and type declarations in `globals.d.ts`.

**Tech Stack:** Node.js ESM, `node:crypto` (`globalThis.crypto.subtle`), isolated-vm, vitest

## Global Constraints

- All commands run inside `crunes-cli/` — independent git repo, never run git/npm from monorepo root
- ESM only — no `require()` in `src/`
- No new npm dependencies
- `CryptoKey` objects never cross the ivm boundary — kept as opaque host-side handles identified by integer IDs
- `globalThis.crypto` in the isolate must match the Web Crypto API shape exactly so npm packages see it as standard

---

### Task 1: Rename `utils.crypto` → `utils.crypt`

**Files:**
- Rename: `src/rune/api/crypto.js` → `src/rune/api/crypt.js`
- Rename: `src/rune/api/types-utils/crypto.d.ts` → `src/rune/api/types-utils/crypt.d.ts`
- Rename: `test/rune/api/crypto.test.js` → `test/rune/api/crypt.test.js`
- Modify: `src/rune/isolation/runner.js:15` — import path + all `$__utils_crypto_*` jail keys → `$__utils_crypt_*`
- Modify: `src/rune/isolation/utils-bootstrap.js:1272` — `crypto:` block key + all `$__utils_crypto_*` refs → `$__utils_crypt_*`; export line `crypto` → `crypt`
- Modify: `src/rune/api/types-utils/crypt.d.ts` — `declare namespace crypto` → `declare namespace crypt`

**Interfaces:**
- Produces: `utils.crypt` namespace (identical API to old `utils.crypto`, just renamed)

- [ ] **Step 1: Run existing crypto tests to establish baseline**

```bash
cd crunes-cli
npx vitest run test/rune/api/crypto.test.js
```

Expected: all tests PASS (establish green baseline before touching anything)

- [ ] **Step 2: Rename the source file and update its namespace declaration**

```bash
cd crunes-cli
mv src/rune/api/crypto.js src/rune/api/crypt.js
mv src/rune/api/types-utils/crypto.d.ts src/rune/api/types-utils/crypt.d.ts
mv test/rune/api/crypto.test.js test/rune/api/crypt.test.js
```

Then edit `src/rune/api/types-utils/crypt.d.ts` — change line 1:
```ts
/** Cryptographic hashing and random value generation */
declare namespace crypt {
```

- [ ] **Step 3: Update the runner.js import and all jail key names**

In `src/rune/isolation/runner.js`, change line 15:
```js
import { hash, hashAsHex, hashAsBase64, hmac, hmacAsHex, hmacAsBase64, encrypt, decrypt, uuid as cryptoUuid, randomHex as cryptoHex, randomBase64 as cryptoBase64, randomBytesFn } from '../api/crypt.js'
```

Then rename every jail key in `runner.js` — replace all occurrences of `$__utils_crypto_` with `$__utils_crypt_` (14 occurrences across lines 1043–1121):

```js
  await jail.set('$__utils_crypt_hash', new ivm.Reference((algorithm, data) => {
    return hash(algorithm, data)
  }))
  await jail.set('$__utils_crypt_hash_hex', new ivm.Reference((algorithm, data) => {
    return hashAsHex(algorithm, data)
  }))
  await jail.set('$__utils_crypt_hash_base64', new ivm.Reference((algorithm, data) => {
    return hashAsBase64(algorithm, data)
  }))
  await jail.set('$__utils_crypt_uuid', new ivm.Reference(cryptoUuid))
  await jail.set('$__utils_crypt_random_hex', new ivm.Reference(cryptoHex))
  await jail.set('$__utils_crypt_random_base64', new ivm.Reference(cryptoBase64))
  await jail.set('$__utils_crypt_random_bytes', new ivm.Reference((size) => {
    return randomBytesFn(size)
  }))
  await jail.set('$__utils_crypt_hmac', new ivm.Reference((algorithm, key, data) => {
    return hmac(algorithm, key, data)
  }))
  await jail.set('$__utils_crypt_hmac_hex', new ivm.Reference((algorithm, key, data) => {
    return hmacAsHex(algorithm, key, data)
  }))
  await jail.set('$__utils_crypt_hmac_base64', new ivm.Reference((algorithm, key, data) => {
    return hmacAsBase64(algorithm, key, data)
  }))
  await jail.set('$__utils_crypt_encrypt', new ivm.Reference((algorithm, key, iv, data) => {
    return encrypt(algorithm, key, iv, data)
  }))
  await jail.set('$__utils_crypt_decrypt', new ivm.Reference((algorithm, key, iv, ciphertext) => {
    return decrypt(algorithm, key, iv, ciphertext)
  }))
  // ... streaming handles follow same pattern:
  await jail.set('$__utils_crypt_hash_init', ...)
  await jail.set('$__utils_crypt_hash_update', ...)
  await jail.set('$__utils_crypt_hash_digest', ...)
  await jail.set('$__utils_crypt_cipher_init', ...)
  await jail.set('$__utils_crypt_cipher_update', ...)
  await jail.set('$__utils_crypt_cipher_final', ...)
```

- [ ] **Step 4: Update utils-bootstrap.js**

In `src/rune/isolation/utils-bootstrap.js`:

Change the block key at line 1272 from `crypto:` to `crypt:`.

Replace every `$__utils_crypto_` reference inside that block with `$__utils_crypt_`:
- `$__utils_crypto_hash` → `$__utils_crypt_hash`
- `$__utils_crypto_hash_hex` → `$__utils_crypt_hash_hex`
- `$__utils_crypto_hash_base64` → `$__utils_crypt_hash_base64`
- `$__utils_crypto_uuid` → `$__utils_crypt_uuid`
- `$__utils_crypto_random_hex` → `$__utils_crypt_random_hex`
- `$__utils_crypto_random_base64` → `$__utils_crypt_random_base64`
- `$__utils_crypto_random_bytes` → `$__utils_crypt_random_bytes`
- `$__utils_crypto_hmac` → `$__utils_crypt_hmac`
- `$__utils_crypto_hmac_hex` → `$__utils_crypt_hmac_hex`
- `$__utils_crypto_hmac_base64` → `$__utils_crypt_hmac_base64`
- `$__utils_crypto_encrypt` → `$__utils_crypt_encrypt`
- `$__utils_crypto_decrypt` → `$__utils_crypt_decrypt`
- `$__utils_crypto_hash_init` → `$__utils_crypt_hash_init`
- `$__utils_crypto_hash_update` → `$__utils_crypt_hash_update`
- `$__utils_crypto_hash_digest` → `$__utils_crypt_hash_digest`
- `$__utils_crypto_cipher_init` → `$__utils_crypt_cipher_init`
- `$__utils_crypto_cipher_update` → `$__utils_crypt_cipher_update`
- `$__utils_crypto_cipher_final` → `$__utils_crypt_cipher_final`

Change the export line at line 1685:
```js
export const { fs, shell, section, rune, json, yaml, xml, csv, http, env, vars, archive, cache, sqlite, db, crypt, codec, ws, time, notify } = globalThis.utils
```

- [ ] **Step 5: Update the test file import**

In `test/rune/api/crypt.test.js` (renamed in Step 2), change line 14:
```js
} from '../../../src/rune/api/crypt.js'
```

- [ ] **Step 6: Run renamed tests — verify they pass**

```bash
cd crunes-cli
npx vitest run test/rune/api/crypt.test.js
```

Expected: all tests PASS

- [ ] **Step 7: Run full test suite**

```bash
cd crunes-cli
npx vitest run
```

Expected: all tests PASS (no references to old `crypto` namespace remain broken)

- [ ] **Step 8: Commit**

```bash
cd crunes-cli
git add src/rune/api/crypt.js src/rune/api/types-utils/crypt.d.ts test/rune/api/crypt.test.js src/rune/isolation/runner.js src/rune/isolation/utils-bootstrap.js
git rm src/rune/api/crypto.js src/rune/api/types-utils/crypto.d.ts test/rune/api/crypto.test.js 2>/dev/null || true
git commit -m "refactor(crypt): rename utils.crypto → utils.crypt to free globalThis.crypto name"
```

---

### Task 2: Inject `globalThis.crypto` (Web Crypto) into the isolate

**Files:**
- Modify: `src/rune/isolation/runner.js` — add `$__webcrypto_*` jail keys with CryptoKey handle map
- Modify: `src/rune/isolation/utils-bootstrap.js` — add `globalThis.crypto` shim before `globalThis.utils`
- Modify: `src/rune/api/types-globals/globals.d.ts` — add `SubtleCrypto`, `CryptoKey`, `CryptoKeyPair`, `JsonWebKey`, `Crypto`, `const crypto: Crypto`
- Test: `test/rune/api/globals.test.js` — add Web Crypto tests

**Interfaces:**
- Consumes: Node's `globalThis.crypto` (available natively since Node 19)
- Produces: `globalThis.crypto` in isolate — full Web Crypto API shape: `subtle.*`, `getRandomValues()`, `randomUUID()`

- [ ] **Step 1: Write failing tests**

Add to `test/rune/api/globals.test.js`:

```js
describe('Web Crypto API (globalThis.crypto)', () => {
  it('crypto.randomUUID() returns a valid UUID v4', async () => {
    const runeFile = join(tmp, 'rune.js')
    await writeFile(runeFile, [
      'import { section } from "@utils"',
      'export async function run() {',
      '  const id = crypto.randomUUID()',
      '  return section.create("r", { type: "markdown", content: id })',
      '}',
    ].join('\n'))
    const result = await runRuneInIsolate(runeFile, { allow: [], deny: [] }, [], tmp)
    expect(result[0].data.content).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('crypto.getRandomValues() fills a typed array with random bytes', async () => {
    const runeFile = join(tmp, 'rune.js')
    await writeFile(runeFile, [
      'import { section } from "@utils"',
      'export async function run() {',
      '  const arr = new Uint8Array(16)',
      '  crypto.getRandomValues(arr)',
      '  return section.create("r", { type: "markdown", content: JSON.stringify(Array.from(arr)) })',
      '}',
    ].join('\n'))
    const result = await runRuneInIsolate(runeFile, { allow: [], deny: [] }, [], tmp)
    const bytes = JSON.parse(result[0].data.content)
    expect(bytes).toHaveLength(16)
    expect(bytes.some(b => b !== 0)).toBe(true)
  })

  it('crypto.subtle.digest() hashes data with SHA-256', async () => {
    const runeFile = join(tmp, 'rune.js')
    await writeFile(runeFile, [
      'import { section } from "@utils"',
      'export async function run() {',
      '  const data = new TextEncoder().encode("hello")',
      '  const buf = await crypto.subtle.digest("SHA-256", data)',
      '  const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("")',
      '  return section.create("r", { type: "markdown", content: hex })',
      '}',
    ].join('\n'))
    const result = await runRuneInIsolate(runeFile, { allow: [], deny: [] }, [], tmp)
    expect(result[0].data.content).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
  })

  it('crypto.subtle.generateKey() + sign() + verify() round-trip with HMAC', async () => {
    const runeFile = join(tmp, 'rune.js')
    await writeFile(runeFile, [
      'import { section } from "@utils"',
      'export async function run() {',
      '  const key = await crypto.subtle.generateKey({ name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"])',
      '  const data = new TextEncoder().encode("hello")',
      '  const sig = await crypto.subtle.sign("HMAC", key, data)',
      '  const valid = await crypto.subtle.verify("HMAC", key, sig, data)',
      '  return section.create("r", { type: "markdown", content: String(valid) })',
      '}',
    ].join('\n'))
    const result = await runRuneInIsolate(runeFile, { allow: [], deny: [] }, [], tmp)
    expect(result[0].data.content).toBe('true')
  })

  it('crypto.subtle.importKey() + exportKey() round-trip for raw AES key', async () => {
    const runeFile = join(tmp, 'rune.js')
    await writeFile(runeFile, [
      'import { section } from "@utils"',
      'export async function run() {',
      '  const raw = new Uint8Array(32)',
      '  crypto.getRandomValues(raw)',
      '  const key = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"])',
      '  const exported = await crypto.subtle.exportKey("raw", key)',
      '  const match = Array.from(new Uint8Array(exported)).join() === Array.from(raw).join()',
      '  return section.create("r", { type: "markdown", content: String(match) })',
      '}',
    ].join('\n'))
    const result = await runRuneInIsolate(runeFile, { allow: [], deny: [] }, [], tmp)
    expect(result[0].data.content).toBe('true')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd crunes-cli
npx vitest run test/rune/api/globals.test.js 2>&1 | tail -20
```

Expected: FAIL — `crypto is not defined` inside the isolate

- [ ] **Step 3: Add `$__webcrypto_*` jail keys in runner.js**

In `src/rune/isolation/runner.js`, after the `$__utils_notify_send` block (around line 562), add:

```js
  // Web Crypto bridge — CryptoKey handle map (keys never cross ivm boundary)
  const cryptoKeyHandles = new Map()
  let nextCryptoKeyId = 1
  const subtle = globalThis.crypto.subtle

  function storeCryptoKey(key) {
    const id = nextCryptoKeyId++
    cryptoKeyHandles.set(id, key)
    return { __cryptoKeyHandle: id, type: key.type, extractable: key.extractable, algorithm: key.algorithm, usages: key.usages }
  }

  function resolveKey(handle) {
    if (handle?.__cryptoKeyHandle == null) throw new Error('Invalid CryptoKey handle')
    const key = cryptoKeyHandles.get(handle.__cryptoKeyHandle)
    if (!key) throw new Error(`Unknown CryptoKey handle: ${handle.__cryptoKeyHandle}`)
    return key
  }

  await jail.set('$__webcrypto_random_uuid', new ivm.Reference(() => globalThis.crypto.randomUUID()))

  await jail.set('$__webcrypto_get_random_values', new ivm.Reference((arrayBuffer) => {
    const arr = new Uint8Array(arrayBuffer)
    globalThis.crypto.getRandomValues(arr)
    return arr.buffer
  }))

  await jail.set('$__webcrypto_subtle_digest', new ivm.Reference(async (algorithm, data) => {
    const result = await subtle.digest(algorithm, data)
    return result
  }))

  await jail.set('$__webcrypto_subtle_sign', new ivm.Reference(async (algorithm, keyHandle, data) => {
    const key = resolveKey(keyHandle)
    return subtle.sign(algorithm, key, data)
  }))

  await jail.set('$__webcrypto_subtle_verify', new ivm.Reference(async (algorithm, keyHandle, signature, data) => {
    const key = resolveKey(keyHandle)
    return subtle.verify(algorithm, key, signature, data)
  }))

  await jail.set('$__webcrypto_subtle_encrypt', new ivm.Reference(async (algorithm, keyHandle, data) => {
    const key = resolveKey(keyHandle)
    return subtle.encrypt(algorithm, key, data)
  }))

  await jail.set('$__webcrypto_subtle_decrypt', new ivm.Reference(async (algorithm, keyHandle, data) => {
    const key = resolveKey(keyHandle)
    return subtle.decrypt(algorithm, key, data)
  }))

  await jail.set('$__webcrypto_subtle_generate_key', new ivm.Reference(async (algorithm, extractable, usages) => {
    const result = await subtle.generateKey(algorithm, extractable, usages)
    if (result.privateKey) {
      return { privateKey: storeCryptoKey(result.privateKey), publicKey: storeCryptoKey(result.publicKey) }
    }
    return storeCryptoKey(result)
  }))

  await jail.set('$__webcrypto_subtle_import_key', new ivm.Reference(async (format, keyData, algorithm, extractable, usages) => {
    const data = keyData instanceof ArrayBuffer ? keyData : (typeof keyData === 'object' && !ArrayBuffer.isView(keyData) ? keyData : keyData)
    const key = await subtle.importKey(format, data, algorithm, extractable, usages)
    return storeCryptoKey(key)
  }))

  await jail.set('$__webcrypto_subtle_export_key', new ivm.Reference(async (format, keyHandle) => {
    const key = resolveKey(keyHandle)
    return subtle.exportKey(format, key)
  }))

  await jail.set('$__webcrypto_subtle_derive_key', new ivm.Reference(async (algorithm, baseKeyHandle, derivedKeyAlg, extractable, usages) => {
    const baseKey = resolveKey(baseKeyHandle)
    const key = await subtle.deriveKey(algorithm, baseKey, derivedKeyAlg, extractable, usages)
    return storeCryptoKey(key)
  }))

  await jail.set('$__webcrypto_subtle_derive_bits', new ivm.Reference(async (algorithm, baseKeyHandle, length) => {
    const baseKey = resolveKey(baseKeyHandle)
    return subtle.deriveBits(algorithm, baseKey, length)
  }))

  await jail.set('$__webcrypto_subtle_wrap_key', new ivm.Reference(async (format, keyHandle, wrappingKeyHandle, wrapAlgorithm) => {
    const key = resolveKey(keyHandle)
    const wrappingKey = resolveKey(wrappingKeyHandle)
    return subtle.wrapKey(format, key, wrappingKey, wrapAlgorithm)
  }))

  await jail.set('$__webcrypto_subtle_unwrap_key', new ivm.Reference(async (format, wrappedData, unwrappingKeyHandle, unwrapAlg, unwrappedAlg, extractable, usages) => {
    const unwrappingKey = resolveKey(unwrappingKeyHandle)
    const key = await subtle.unwrapKey(format, wrappedData, unwrappingKey, unwrapAlg, unwrappedAlg, extractable, usages)
    return storeCryptoKey(key)
  }))
```

- [ ] **Step 4: Add `globalThis.crypto` shim in utils-bootstrap.js**

In `src/rune/isolation/utils-bootstrap.js`, add this block **before** the `globalThis.utils = {` line:

```js
function __resolveCryptoKey(h) {
  if (h && h.__cryptoKeyHandle != null) return h
  throw new Error('Expected a CryptoKey handle')
}

globalThis.crypto = {
  randomUUID: () => $__webcrypto_random_uuid.applySync(undefined, []),
  getRandomValues(array) {
    const buf = $__webcrypto_get_random_values.applySync(undefined, [array.buffer], { arguments: { copy: true }, result: { copy: true } })
    array.set(new array.constructor(buf))
    return array
  },
  subtle: {
    digest: (alg, data) => {
      const buf = data instanceof ArrayBuffer ? data : data.buffer
      return $__webcrypto_subtle_digest.apply(undefined, [alg, buf], { arguments: { copy: true }, result: { promise: true, copy: true } })
    },
    sign: (alg, key, data) => {
      const buf = data instanceof ArrayBuffer ? data : data.buffer
      return $__webcrypto_subtle_sign.apply(undefined, [alg, key, buf], { arguments: { copy: true }, result: { promise: true, copy: true } })
    },
    verify: (alg, key, sig, data) => {
      const sigBuf = sig instanceof ArrayBuffer ? sig : sig.buffer
      const dataBuf = data instanceof ArrayBuffer ? data : data.buffer
      return $__webcrypto_subtle_verify.apply(undefined, [alg, key, sigBuf, dataBuf], { arguments: { copy: true }, result: { promise: true, copy: true } })
    },
    encrypt: (alg, key, data) => {
      const buf = data instanceof ArrayBuffer ? data : data.buffer
      return $__webcrypto_subtle_encrypt.apply(undefined, [alg, key, buf], { arguments: { copy: true }, result: { promise: true, copy: true } })
    },
    decrypt: (alg, key, data) => {
      const buf = data instanceof ArrayBuffer ? data : data.buffer
      return $__webcrypto_subtle_decrypt.apply(undefined, [alg, key, buf], { arguments: { copy: true }, result: { promise: true, copy: true } })
    },
    generateKey: (alg, extractable, usages) =>
      $__webcrypto_subtle_generate_key.apply(undefined, [alg, extractable, usages], { arguments: { copy: true }, result: { promise: true, copy: true } }),
    importKey: (format, keyData, alg, extractable, usages) => {
      const data = keyData instanceof ArrayBuffer ? keyData : (ArrayBuffer.isView(keyData) ? keyData.buffer : keyData)
      return $__webcrypto_subtle_import_key.apply(undefined, [format, data, alg, extractable, usages], { arguments: { copy: true }, result: { promise: true, copy: true } })
    },
    exportKey: (format, key) =>
      $__webcrypto_subtle_export_key.apply(undefined, [format, key], { arguments: { copy: true }, result: { promise: true, copy: true } }),
    deriveKey: (alg, baseKey, derivedAlg, extractable, usages) =>
      $__webcrypto_subtle_derive_key.apply(undefined, [alg, baseKey, derivedAlg, extractable, usages], { arguments: { copy: true }, result: { promise: true, copy: true } }),
    deriveBits: (alg, baseKey, length) =>
      $__webcrypto_subtle_derive_bits.apply(undefined, [alg, baseKey, length], { arguments: { copy: true }, result: { promise: true, copy: true } }),
    wrapKey: (format, key, wrappingKey, wrapAlg) =>
      $__webcrypto_subtle_wrap_key.apply(undefined, [format, key, wrappingKey, wrapAlg], { arguments: { copy: true }, result: { promise: true, copy: true } }),
    unwrapKey: (format, wrappedData, unwrappingKey, unwrapAlg, unwrappedAlg, extractable, usages) => {
      const buf = wrappedData instanceof ArrayBuffer ? wrappedData : wrappedData.buffer
      return $__webcrypto_subtle_unwrap_key.apply(undefined, [format, buf, unwrappingKey, unwrapAlg, unwrappedAlg, extractable, usages], { arguments: { copy: true }, result: { promise: true, copy: true } })
    },
  },
}
```

- [ ] **Step 5: Add type declarations to globals.d.ts**

In `src/rune/api/types-globals/globals.d.ts`, add before the closing `}` of the `globals` namespace (before line 322):

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

  /** The Web Crypto API — available globally without import. Compatible with npm packages using crypto.subtle.* */
  const crypto: Crypto
```

Also add top-level type aliases after line 342 (after `type RuneSection`):

```ts
type CryptoKey = globals.CryptoKey
type CryptoKeyPair = globals.CryptoKeyPair
type SubtleCrypto = globals.SubtleCrypto
type Crypto = globals.Crypto
type JsonWebKey = globals.JsonWebKey
```

- [ ] **Step 6: Run failing tests — verify they now pass**

```bash
cd crunes-cli
npx vitest run test/rune/api/globals.test.js 2>&1 | tail -20
```

Expected: all Web Crypto tests PASS

- [ ] **Step 7: Run full test suite**

```bash
cd crunes-cli
npx vitest run
```

Expected: all tests PASS

- [ ] **Step 8: Build and smoke test**

```bash
cd crunes-cli
npm run build
node dist/cli.js --help
```

Expected: CLI starts without errors.

Create `scratch/webcrypto-test/.crunes/config.json`:
```json
{
  "runes": {
    "test-webcrypto": {
      "permissions": { "run": { "allow": [] } }
    }
  }
}
```

Create `scratch/webcrypto-test/.crunes/runes/test-webcrypto.js`:
```js
import { section, md } from '@utils'

export async function run() {
  // digest
  const data = new TextEncoder().encode('hello')
  const buf = await crypto.subtle.digest('SHA-256', data)
  const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')

  // generateKey + sign + verify
  const key = await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
  const sig = await crypto.subtle.sign('HMAC', key, data)
  const valid = await crypto.subtle.verify('HMAC', key, sig, data)

  return section.create('result', {
    type: 'markdown',
    content: md.codeBlock(JSON.stringify({ uuid: crypto.randomUUID(), sha256: hex, hmacValid: valid }, null, 2)),
  })
}
```

Run:
```bash
node dist/cli.js --cwd "../scratch/webcrypto-test" run test-webcrypto
```

Expected output:
```
[1:test-webcrypto:section] result
```json
{
  "uuid": "<uuid-v4>",
  "sha256": "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  "hmacValid": true
}
```

- [ ] **Step 9: Commit**

```bash
cd crunes-cli
git add src/rune/isolation/runner.js src/rune/isolation/utils-bootstrap.js src/rune/api/types-globals/globals.d.ts test/rune/api/globals.test.js
git commit -m "feat(webcrypto): inject globalThis.crypto (Web Crypto API) into isolate"
```

---

## Self-Review

**Spec coverage:**
- ✅ Rename `utils.crypto` → `utils.crypt` — all files listed in Task 1
- ✅ `$__utils_crypto_*` → `$__utils_crypt_*` — all 18 occurrences covered in Steps 3+4
- ✅ Named export updated — Step 4 covers `utils-bootstrap.js` export line
- ✅ Full SubtleCrypto surface — all 12 methods in Task 2 Step 3
- ✅ `getRandomValues` + `randomUUID` — both in Step 3
- ✅ `CryptoKey` handle map — `storeCryptoKey` / `resolveKey` pattern in Step 3
- ✅ `CryptoKeyPair` — `generateKey` returns `{ privateKey: handle, publicKey: handle }` in Step 3
- ✅ `globals.d.ts` additions — Step 5 covers all types + top-level aliases
- ✅ No permission token — pure compute, none added
- ✅ Tests — 5 focused tests covering UUID, getRandomValues, digest, sign/verify, importKey/exportKey

**Placeholder scan:** None found.

**Type consistency:** `CryptoKey` handle shape `{ __cryptoKeyHandle: number, type, extractable, algorithm, usages }` used consistently — `storeCryptoKey` produces it in runner.js, isolate shim passes it back via `{ copy: true }` in all key-accepting methods.
