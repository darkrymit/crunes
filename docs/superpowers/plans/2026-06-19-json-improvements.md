# JSON Namespace Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `json` namespace with JSONC/JSON5 multi-format support (auto-detected by extension), comment-preserving round-trips for `.jsonc` files using a `#key` convention, and a new `writePath` method for single-node set/delete mutations.

**Architecture:** All format logic lives in `src/rune/api/json.js` — a `detectFormat` helper picks the parser/serializer based on extension, overridable by `opts.format`. JSONC comment metadata is encoded as `#`-prefixed string keys (e.g. `#head`, `#comment:name`) matching the yaml namespace convention exactly, so comment-bearing objects are plain JS objects that survive ivm copy. `writePath` uses `jsonpath-plus` parent/parentProperty callback mode to mutate, then writes back via the existing `write` method.

**Tech Stack:** Node.js ESM · `comment-json` (JSONC parse/stringify with comment preservation) · `json5` (JSON5 parse/stringify) · `jsonpath-plus` (already in use) · vitest

## Global Constraints

- All files under `src/` are strict ESM — no `require()`
- `crunes-cli/` is an independent git repo — all git commands must run inside it
- Never commit `dist/` — it is gitignored
- Run `npm install` after adding dependencies to sync `package-lock.json`
- Run full test suite with `npm test` before committing; all 1196+ existing tests must keep passing
- `#`-prefixed comment key convention must match yaml namespace exactly: `#head`, `#tail`, `#comment:key`, `#inline:key`
- `format` option values: `'json' | 'jsonc' | 'json5'`
- `writePath` with `value === undefined` deletes the node; missing file treated as `{}`

---

## File Map

| File | Change |
|------|--------|
| `src/rune/api/json.js` | Add `detectFormat`, `parseJsonc`, `stringifyJsonc`, `parseJson5`, `stringifyJson5`, update all methods, add `writePath` |
| `src/rune/api/types-utils/json.d.ts` | Add `format` opt to all methods, add `writePath` declaration |
| `src/rune/isolation/runner.js` | Add `$__utils_json_writePath` global |
| `src/rune/isolation/utils-bootstrap.js` | Add `writePath` to json block |
| `test/rune/api/json.test.js` | Add test suites for JSONC, JSON5, and writePath |
| `package.json` + `package-lock.json` | Add `comment-json` and `json5` dependencies |

---

## Task 1: Install dependencies and add format detection

**Files:**
- Modify: `package.json`
- Modify: `src/rune/api/json.js`
- Test: `test/rune/api/json.test.js`

**Interfaces:**
- Produces: `detectFormat(relPath, optsFormat?) → 'json' | 'jsonc' | 'json5'` — used by all subsequent tasks

- [ ] **Step 1: Install dependencies**

```bash
cd crunes-cli
npm install comment-json json5
```

Expected: both appear in `package.json` dependencies, `package-lock.json` updated.

- [ ] **Step 2: Write the failing test**

Add to `test/rune/api/json.test.js`:

```js
import { detectFormat } from '../../../src/rune/api/json.js'

describe('detectFormat', () => {
  it('returns json for .json extension', () => {
    expect(detectFormat('config.json')).toBe('json')
  })

  it('returns jsonc for .jsonc extension', () => {
    expect(detectFormat('tsconfig.jsonc')).toBe('jsonc')
  })

  it('returns json5 for .json5 extension', () => {
    expect(detectFormat('config.json5')).toBe('json5')
  })

  it('returns json for unknown extension', () => {
    expect(detectFormat('Makefile')).toBe('json')
  })

  it('opts.format overrides extension', () => {
    expect(detectFormat('config.json', 'jsonc')).toBe('jsonc')
    expect(detectFormat('config.jsonc', 'json')).toBe('json')
    expect(detectFormat('config.json', 'json5')).toBe('json5')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd crunes-cli
npm test -- test/rune/api/json.test.js 2>&1 | tail -5
```

Expected: FAIL — `detectFormat is not exported`

- [ ] **Step 4: Implement `detectFormat` and export it**

In `src/rune/api/json.js`, add after the imports:

```js
const EXT_FORMAT = { '.json': 'json', '.jsonc': 'jsonc', '.json5': 'json5' }

export function detectFormat(relPath, override) {
  if (override) return override
  const ext = relPath.slice(relPath.lastIndexOf('.')).toLowerCase()
  return EXT_FORMAT[ext] ?? 'json'
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd crunes-cli
npm test -- test/rune/api/json.test.js 2>&1 | tail -5
```

Expected: all detectFormat tests PASS

- [ ] **Step 6: Commit**

```bash
cd crunes-cli
git add src/rune/api/json.js test/rune/api/json.test.js package.json package-lock.json
git commit -m "feat(json): install comment-json/json5 and add detectFormat helper"
```

---

## Task 2: JSONC parse/stringify with `#key` comment convention

**Files:**
- Modify: `src/rune/api/json.js`
- Test: `test/rune/api/json.test.js`

**Interfaces:**
- Consumes: `comment-json` package (`parse`, `stringify`, `PREFIX_BEFORE`, `PREFIX_AFTER_VALUE`, `PREFIX_BEFORE_ALL`, `PREFIX_AFTER_ALL`)
- Produces:
  - `parseJsonc(text, displayPath) → unknown` — returns plain object with `#head`/`#tail`/`#comment:key`/`#inline:key` string keys encoding comments
  - `stringifyJsonc(data, spaces) → string` — accepts plain object with `#`-prefixed keys, converts to comment-json Symbols, serializes as JSONC

**Symbol key mapping (comment-json internals):**

| Our `#key` | comment-json Symbol |
|------------|-------------------|
| `#head` | `Symbol.for('before-all')` |
| `#tail` | `Symbol.for('after-all')` |
| `#comment:foo` | `Symbol.for('before:foo')` |
| `#inline:foo` | `Symbol.for('after-prop:foo')` |

- [ ] **Step 1: Write the failing tests**

Add to `test/rune/api/json.test.js`:

```js
import { parseJsonc, stringifyJsonc } from '../../../src/rune/api/json.js'

describe('parseJsonc', () => {
  it('parses plain JSONC without comments', () => {
    expect(parseJsonc('{"a":1}', 'test.jsonc')).toEqual({ a: 1 })
  })

  it('encodes top-level comment as #head', () => {
    const result = parseJsonc('// file header\n{"a":1}', 'test.jsonc')
    expect(result['#head']).toBe('file header')
    expect(result.a).toBe(1)
  })

  it('encodes before-key comment as #comment:key', () => {
    const result = parseJsonc('{\n  // the name\n  "name": "test"\n}', 'test.jsonc')
    expect(result['#comment:name']).toBe('the name')
    expect(result.name).toBe('test')
  })

  it('encodes inline comment as #inline:key', () => {
    const result = parseJsonc('{"version":"1.0" // semver\n}', 'test.jsonc')
    expect(result['#inline:version']).toBe('semver')
  })

  it('throws JsonParseError on invalid JSONC', () => {
    expect(() => parseJsonc('{bad}', 'test.jsonc')).toThrow('JsonParseError')
  })
})

describe('stringifyJsonc', () => {
  it('round-trips plain object', () => {
    const out = stringifyJsonc({ a: 1 }, 2)
    expect(JSON.parse(out)).toEqual({ a: 1 })
  })

  it('writes #head as top-level comment', () => {
    const out = stringifyJsonc({ '#head': 'generated', a: 1 }, 2)
    expect(out).toContain('// generated')
    expect(JSON.parse(out.replace(/\/\/[^\n]*/g, '').trim())).toEqual({ a: 1 })
  })

  it('writes #comment:key as before-key comment', () => {
    const out = stringifyJsonc({ '#comment:name': 'the name', name: 'test' }, 2)
    expect(out).toContain('// the name')
    expect(out).toContain('"name"')
  })

  it('writes #inline:key as inline comment', () => {
    const out = stringifyJsonc({ version: '1.0', '#inline:version': 'semver' }, 2)
    expect(out).toContain('// semver')
  })

  it('round-trips comments through parse → stringify', () => {
    const src = '// top\n{\n  // the name\n  "name": "test" // inline\n}'
    const parsed = parseJsonc(src, 'test.jsonc')
    const out = stringifyJsonc(parsed, 2)
    expect(out).toContain('// top')
    expect(out).toContain('// the name')
    expect(out).toContain('// inline')
  })

  it('#-prefixed keys are not written as JSON properties', () => {
    const out = stringifyJsonc({ '#head': 'top', name: 'test' }, 2)
    expect(out).not.toContain('"#head"')
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd crunes-cli
npm test -- test/rune/api/json.test.js 2>&1 | tail -5
```

Expected: FAIL — `parseJsonc is not exported`

- [ ] **Step 3: Implement `parseJsonc` and `stringifyJsonc`**

Add to `src/rune/api/json.js` after the `detectFormat` export:

```js
import { createRequire } from 'node:module'
const _require = createRequire(import.meta.url)
const commentJson = _require('comment-json/src/index.js')

const SYM_HEAD      = Symbol.for('before-all')
const SYM_TAIL      = Symbol.for('after-all')
const symBefore = k => Symbol.for(`before:${k}`)
const symInline = k => Symbol.for(`after-prop:${k}`)

export function parseJsonc(text, displayPath) {
  let parsed
  try {
    parsed = commentJson.parse(text)
  } catch (err) {
    throw new JsonParseError(`Failed to parse ${displayPath}:\n  ${err.message}`, displayPath)
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return parsed

  const result = {}

  // top-level comments
  const head = parsed[SYM_HEAD]
  if (head?.length) result['#head'] = head.map(c => c.value.trim()).join('\n')
  const tail = parsed[SYM_TAIL]
  if (tail?.length) result['#tail'] = tail.map(c => c.value.trim()).join('\n')

  for (const key of Object.keys(parsed)) {
    const before = parsed[symBefore(key)]
    if (before?.length) result[`#comment:${key}`] = before.map(c => c.value.trim()).join('\n')
    const inline = parsed[symInline(key)]
    if (inline?.length) result[`#inline:${key}`] = inline.map(c => c.value.trim()).join('\n')
    result[key] = parsed[key]
  }
  return result
}

export function stringifyJsonc(data, spaces) {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return commentJson.stringify(data, null, spaces) + '\n'
  }

  const obj = commentJson.parse('{}')

  const head = data['#head']
  const tail = data['#tail']

  for (const key of Object.keys(data)) {
    if (key.startsWith('#')) continue
    obj[key] = data[key]
    const before = data[`#comment:${key}`]
    if (before) obj[symBefore(key)] = before.split('\n').map(line => ({ type: 'LineComment', value: ` ${line}` }))
    const inline = data[`#inline:${key}`]
    if (inline) obj[symInline(key)] = [{ type: 'LineComment', value: ` ${inline}` }]
  }

  if (head) obj[SYM_HEAD] = head.split('\n').map(line => ({ type: 'LineComment', value: ` ${line}` }))
  if (tail) obj[SYM_TAIL] = tail.split('\n').map(line => ({ type: 'LineComment', value: ` ${line}` }))

  const out = commentJson.stringify(obj, null, spaces)
  return out.endsWith('\n') ? out : out + '\n'
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd crunes-cli
npm test -- test/rune/api/json.test.js 2>&1 | tail -5
```

Expected: all parseJsonc/stringifyJsonc tests PASS

- [ ] **Step 5: Commit**

```bash
cd crunes-cli
git add src/rune/api/json.js test/rune/api/json.test.js
git commit -m "feat(json): add JSONC parse/stringify with #key comment convention"
```

---

## Task 3: JSON5 parse/stringify

**Files:**
- Modify: `src/rune/api/json.js`
- Test: `test/rune/api/json.test.js`

**Interfaces:**
- Produces:
  - `parseJson5(text, displayPath) → unknown`
  - `stringifyJson5(data, spaces) → string`

- [ ] **Step 1: Write the failing tests**

Add to `test/rune/api/json.test.js`:

```js
import { parseJson5, stringifyJson5 } from '../../../src/rune/api/json.js'

describe('parseJson5', () => {
  it('parses standard JSON', () => {
    expect(parseJson5('{"a":1}', 'test.json5')).toEqual({ a: 1 })
  })

  it('parses unquoted keys', () => {
    expect(parseJson5('{a: 1}', 'test.json5')).toEqual({ a: 1 })
  })

  it('parses single-quoted strings', () => {
    expect(parseJson5("{name: 'test'}", 'test.json5')).toEqual({ name: 'test' })
  })

  it('parses trailing commas', () => {
    expect(parseJson5('{a: 1,}', 'test.json5')).toEqual({ a: 1 })
  })

  it('parses comments (strips them)', () => {
    expect(parseJson5('// comment\n{a: 1}', 'test.json5')).toEqual({ a: 1 })
  })

  it('throws JsonParseError on invalid JSON5', () => {
    expect(() => parseJson5('{bad json5!!!}', 'test.json5')).toThrow('JsonParseError')
  })
})

describe('stringifyJson5', () => {
  it('serializes to JSON5 format', () => {
    const out = stringifyJson5({ a: 1, b: 'hello' }, 2)
    expect(out).toContain('a:')
    expect(parseJson5(out, 'test.json5')).toEqual({ a: 1, b: 'hello' })
  })

  it('always appends trailing newline', () => {
    expect(stringifyJson5({ a: 1 }, 2).endsWith('\n')).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd crunes-cli
npm test -- test/rune/api/json.test.js 2>&1 | tail -5
```

Expected: FAIL — `parseJson5 is not exported`

- [ ] **Step 3: Implement `parseJson5` and `stringifyJson5`**

Add to `src/rune/api/json.js`:

```js
import JSON5 from 'json5'

export function parseJson5(text, displayPath) {
  try {
    return JSON5.parse(text)
  } catch (err) {
    throw new JsonParseError(`Failed to parse ${displayPath}:\n  ${err.message}`, displayPath)
  }
}

export function stringifyJson5(data, spaces) {
  const out = JSON5.stringify(data, null, spaces)
  return out.endsWith('\n') ? out : out + '\n'
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd crunes-cli
npm test -- test/rune/api/json.test.js 2>&1 | tail -5
```

Expected: all parseJson5/stringifyJson5 tests PASS

- [ ] **Step 5: Commit**

```bash
cd crunes-cli
git add src/rune/api/json.js test/rune/api/json.test.js
git commit -m "feat(json): add JSON5 parse/stringify (best-effort, comments not preserved)"
```

---

## Task 4: Wire format detection into all existing methods

**Files:**
- Modify: `src/rune/api/json.js`
- Test: `test/rune/api/json.test.js`

**Interfaces:**
- Consumes: `detectFormat`, `parseJsonc`, `stringifyJsonc`, `parseJson5`, `stringifyJson5` from Tasks 1-3
- Produces: updated `createJsonUtils` — all methods accept `opts.format`, route through format-aware `_parse` / `_stringify` helpers

- [ ] **Step 1: Write the failing tests**

Add to `test/rune/api/json.test.js`:

```js
describe('json.read — multi-format', () => {
  it('reads .jsonc file preserving comment keys', async () => {
    const fs = makeFsUtils({ 'cfg.jsonc': '// top\n{"a":1}' })
    const json = createJsonUtils('/project', fs)
    const result = await json.read('cfg.jsonc')
    expect(result['#head']).toBe('top')
    expect(result.a).toBe(1)
  })

  it('reads .json5 file with unquoted keys', async () => {
    const fs = makeFsUtils({ 'cfg.json5': '{a: 1}' })
    const json = createJsonUtils('/project', fs)
    expect(await json.read('cfg.json5')).toEqual({ a: 1 })
  })

  it('opts.format overrides extension', async () => {
    const fs = makeFsUtils({ 'tsconfig.json': '// comment\n{"strict":true}' })
    const json = createJsonUtils('/project', fs)
    const result = await json.read('tsconfig.json', { format: 'jsonc' })
    expect(result['#head']).toBe('comment')
    expect(result.strict).toBe(true)
  })
})

describe('json.write — multi-format', () => {
  it('writes .jsonc file with comment keys as JSONC comments', async () => {
    const fsUtils = makeFsUtils()
    const json = createJsonUtils('/project', fsUtils)
    await json.write('cfg.jsonc', { '#head': 'generated', name: 'test' })
    const written = fsUtils.write.mock.calls[0][1]
    expect(written).toContain('// generated')
    expect(written).toContain('"name"')
  })

  it('writes .json5 file as JSON5', async () => {
    const fsUtils = makeFsUtils()
    const json = createJsonUtils('/project', fsUtils)
    await json.write('cfg.json5', { a: 1 })
    const written = fsUtils.write.mock.calls[0][1]
    // json5 stringify uses unquoted keys
    expect(parseJson5(written, 'cfg.json5')).toEqual({ a: 1 })
  })

  it('opts.format: jsonc writes JSONC to .json file', async () => {
    const fsUtils = makeFsUtils()
    const json = createJsonUtils('/project', fsUtils)
    await json.write('tsconfig.json', { '#head': 'ts config', strict: true }, { format: 'jsonc' })
    const written = fsUtils.write.mock.calls[0][1]
    expect(written).toContain('// ts config')
  })
})

describe('json.modify — multi-format', () => {
  it('preserves JSONC comments through modify cycle', async () => {
    const fsUtils = makeFsUtils({ 'cfg.jsonc': '// top\n{"version":"1.0"}' })
    const json = createJsonUtils('/project', fsUtils)
    await json.modify('cfg.jsonc', (data) => { data.version = '2.0' })
    const written = fsUtils.write.mock.calls[0][1]
    expect(written).toContain('// top')
    expect(written).toContain('"2.0"')
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd crunes-cli
npm test -- test/rune/api/json.test.js 2>&1 | tail -5
```

Expected: FAIL — `.jsonc` files parsed as plain JSON (comments silently stripped or error)

- [ ] **Step 3: Update `createJsonUtils` to route through format-aware helpers**

Replace the `createJsonUtils` function in `src/rune/api/json.js`:

```js
function _parse(text, format, displayPath) {
  if (format === 'jsonc') return parseJsonc(text, displayPath)
  if (format === 'json5') return parseJson5(text, displayPath)
  return parseJson(text, displayPath)
}

function _stringify(data, format, spaces) {
  if (format === 'jsonc') return stringifyJsonc(data, spaces)
  if (format === 'json5') return stringifyJson5(data, spaces)
  return JSON.stringify(data, null, spaces) + '\n'
}

export function createJsonUtils(dir, fsUtils) {
  return {
    async read(relPath, { throw: shouldThrow = true, format } = {}) {
      const text = await fsUtils.read(relPath, { throw: shouldThrow })
      if (text === null) return null
      const fmt = detectFormat(relPath, format)
      return _parse(text, fmt, path.join(dir, relPath))
    },

    async readPath(relPath, jsonPath, defaultValue = undefined, { format } = {}) {
      const obj = await this.read(relPath, { throw: false, format })
      if (obj === null) return defaultValue
      const results = JSONPath({ path: jsonPath, json: obj, wrap: true })
      return results.length === 0 ? defaultValue : results[0]
    },

    async readPathAll(relPath, jsonPath, defaultValue = [], { format } = {}) {
      const obj = await this.read(relPath, { throw: false, format })
      if (obj === null) return defaultValue
      const results = JSONPath({ path: jsonPath, json: obj, wrap: true })
      return results.length === 0 ? defaultValue : results
    },

    async write(relPath, data, { spaces = 2, format } = {}) {
      const fmt = detectFormat(relPath, format)
      const content = _stringify(data, fmt, spaces)
      await fsUtils.write(relPath, content)
    },

    async modify(relPath, callback, { initial, spaces = 2, format } = {}) {
      const missing = !(await fsUtils.exists(relPath))
      if (missing && initial === undefined) {
        await this.read(relPath, { format })
      }
      const data = missing ? structuredClone(initial) : await this.read(relPath, { format })
      const result = await callback(data, { exists: !missing })
      await this.write(relPath, result !== undefined ? result : data, { spaces, format })
    },
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd crunes-cli
npm test -- test/rune/api/json.test.js 2>&1 | tail -5
```

Expected: all multi-format tests PASS, all prior tests still PASS

- [ ] **Step 5: Run full suite**

```bash
cd crunes-cli
npm test 2>&1 | tail -5
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
cd crunes-cli
git add src/rune/api/json.js test/rune/api/json.test.js
git commit -m "feat(json): wire format detection into read/write/modify/readPath/readPathAll"
```

---

## Task 5: `writePath` method

**Files:**
- Modify: `src/rune/api/json.js`
- Modify: `src/rune/isolation/runner.js`
- Modify: `src/rune/isolation/utils-bootstrap.js`
- Test: `test/rune/api/json.test.js`

**Interfaces:**
- Consumes: `createJsonUtils` from Task 4 (`this.read`, `this.write`)
- Produces: `json.writePath(relPath, jsonPath, value, opts?)` added to `createJsonUtils` return object

**writePath semantics:**
- Reads file (missing → treated as `{}`)
- Uses `JSONPath` callback mode: iterates matching nodes, accesses `parent` + `parentProperty` to set/delete
- If `value === undefined`: deletes by `delete parent[parentProperty]`
- If no match found and `value !== undefined`: creates intermediates by walking segments of `jsonPath`
- Writes back with `this.write`

**Intermediate node creation:** parse `jsonPath` segments (strip `$.`, split on `.` and `[n]`), walk the object creating `{}` at each missing key, set the final value.

- [ ] **Step 1: Write the failing tests**

Add to `test/rune/api/json.test.js`:

```js
describe('json.writePath', () => {
  it('sets an existing top-level key', async () => {
    const fsUtils = makeFsUtils({ 'pkg.json': '{"name":"old"}' })
    const json = createJsonUtils('/project', fsUtils)
    await json.writePath('pkg.json', '$.name', 'new')
    expect(JSON.parse(fsUtils.write.mock.calls[0][1])).toEqual({ name: 'new' })
  })

  it('sets a nested key', async () => {
    const fsUtils = makeFsUtils({ 'pkg.json': '{"scripts":{"build":"tsc"}}' })
    const json = createJsonUtils('/project', fsUtils)
    await json.writePath('pkg.json', '$.scripts.test', 'vitest')
    expect(JSON.parse(fsUtils.write.mock.calls[0][1])).toEqual({ scripts: { build: 'tsc', test: 'vitest' } })
  })

  it('creates intermediate nodes when missing', async () => {
    const fsUtils = makeFsUtils({ 'pkg.json': '{}' })
    const json = createJsonUtils('/project', fsUtils)
    await json.writePath('pkg.json', '$.scripts.build', 'tsc')
    expect(JSON.parse(fsUtils.write.mock.calls[0][1])).toEqual({ scripts: { build: 'tsc' } })
  })

  it('creates file when missing', async () => {
    const fsUtils = makeFsUtils()
    const json = createJsonUtils('/project', fsUtils)
    await json.writePath('pkg.json', '$.version', '1.0.0')
    expect(JSON.parse(fsUtils.write.mock.calls[0][1])).toEqual({ version: '1.0.0' })
  })

  it('deletes a key when value is undefined', async () => {
    const fsUtils = makeFsUtils({ 'pkg.json': '{"name":"test","version":"1.0"}' })
    const json = createJsonUtils('/project', fsUtils)
    await json.writePath('pkg.json', '$.version', undefined)
    expect(JSON.parse(fsUtils.write.mock.calls[0][1])).toEqual({ name: 'test' })
  })

  it('no-op when deleting from missing file', async () => {
    const fsUtils = makeFsUtils()
    const json = createJsonUtils('/project', fsUtils)
    await json.writePath('missing.json', '$.version', undefined)
    expect(fsUtils.write).not.toHaveBeenCalled()
  })

  it('preserves JSONC comments through writePath', async () => {
    const fsUtils = makeFsUtils({ 'cfg.jsonc': '// top\n{"version":"1.0"}' })
    const json = createJsonUtils('/project', fsUtils)
    await json.writePath('cfg.jsonc', '$.version', '2.0')
    const written = fsUtils.write.mock.calls[0][1]
    expect(written).toContain('// top')
    expect(written).toContain('"2.0"')
  })

  it('passes format opt through to read/write', async () => {
    const fsUtils = makeFsUtils({ 'tsconfig.json': '// comment\n{"strict":true}' })
    const json = createJsonUtils('/project', fsUtils)
    await json.writePath('tsconfig.json', '$.strict', false, { format: 'jsonc' })
    const written = fsUtils.write.mock.calls[0][1]
    expect(written).toContain('// comment')
    expect(written).toContain('false')
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd crunes-cli
npm test -- test/rune/api/json.test.js 2>&1 | tail -5
```

Expected: FAIL — `json.writePath is not a function`

- [ ] **Step 3: Implement `writePath` in `createJsonUtils`**

Add `writePath` to the object returned by `createJsonUtils` in `src/rune/api/json.js`:

```js
async writePath(relPath, jsonPath, value, { spaces = 2, format } = {}) {
  const missing = !(await fsUtils.exists(relPath))
  if (missing && value === undefined) return  // no-op: delete from missing file

  const data = missing ? {} : await this.read(relPath, { format })

  // Try JSONPath mutation on existing node
  let matched = false
  JSONPath({
    path: jsonPath,
    json: data,
    wrap: false,
    callback(_, __, payload) {
      if (value === undefined) {
        delete payload.parent[payload.parentProperty]
      } else {
        payload.parent[payload.parentProperty] = value
      }
      matched = true
    },
    resultType: 'all',
  })

  // If no match and we have a value to set, create intermediates
  if (!matched && value !== undefined) {
    // parse simple dot-notation segments from jsonPath (e.g. $.a.b.c or $.a[0].b)
    const segments = jsonPath
      .replace(/^\$\.?/, '')
      .split(/\.|\[(\d+)\]/)
      .filter(s => s != null && s !== '')
    let node = data
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i]
      if (node[seg] == null || typeof node[seg] !== 'object') node[seg] = {}
      node = node[seg]
    }
    node[segments[segments.length - 1]] = value
  }

  await this.write(relPath, data, { spaces, format })
},
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd crunes-cli
npm test -- test/rune/api/json.test.js 2>&1 | tail -5
```

Expected: all writePath tests PASS

- [ ] **Step 5: Wire `writePath` into runner.js**

In `src/rune/isolation/runner.js`, after the `$__utils_json_write` block (around line 569):

```js
await jail.set('$__utils_json_writePath', new ivm.Reference(async (relPath, jsonPath, value, opts) => {
  await utils.json.writePath(relPath, jsonPath, value, opts)
}))
```

- [ ] **Step 6: Wire `writePath` into utils-bootstrap.js**

In `src/rune/isolation/utils-bootstrap.js`, in the `json:` block after `write:`:

```js
writePath: (p, q, v, o) => $__utils_json_writePath.apply(undefined, [p, q, v, o], { arguments: { copy: true }, result: { promise: true } }),
```

- [ ] **Step 7: Run full test suite**

```bash
cd crunes-cli
npm test 2>&1 | tail -5
```

Expected: all tests PASS

- [ ] **Step 8: Commit**

```bash
cd crunes-cli
git add src/rune/api/json.js src/rune/isolation/runner.js src/rune/isolation/utils-bootstrap.js test/rune/api/json.test.js
git commit -m "feat(json): add writePath — set/delete single JSONPath node with intermediate creation"
```

---

## Task 6: Update types and build verification

**Files:**
- Modify: `src/rune/api/types-utils/json.d.ts`

- [ ] **Step 1: Update `json.d.ts`**

Replace the contents of `src/rune/api/types-utils/json.d.ts`:

```ts
/** Read, write, and query JSON, JSONC, and JSON5 files with JSONPath support */
declare namespace json {
  /**
   * Format override. Auto-detected from extension by default:
   * `.json` → json, `.jsonc` → jsonc, `.json5` → json5, unknown → json
   */
  type Format = 'json' | 'jsonc' | 'json5'

  /**
   * Reads and parses a JSON/JSONC/JSON5 file.
   * JSONC files return comment metadata as `#head`, `#tail`, `#comment:key`, `#inline:key` string keys.
   * Requires `fs.read:<path>` permission.
   */
  function read(path: string, opts?: { throw?: boolean; format?: Format }): Promise<unknown>

  /**
   * Returns the first value matching a JSONPath query.
   * Requires `fs.read:<path>` permission.
   */
  function readPath(path: string, jsonPath: string, defaultValue?: unknown, opts?: { format?: Format }): Promise<unknown>

  /**
   * Returns all values matching a JSONPath query.
   * Requires `fs.read:<path>` permission.
   */
  function readPathAll(path: string, jsonPath: string, defaultValue?: unknown, opts?: { format?: Format }): Promise<unknown[]>

  /**
   * Serializes and writes a value to a JSON/JSONC/JSON5 file.
   * JSONC: `#head`, `#tail`, `#comment:key`, `#inline:key` keys are written as comments.
   * Requires `fs.write:<path>` permission.
   */
  function write(path: string, data: unknown, opts?: { spaces?: number; format?: Format }): Promise<void>

  /**
   * Reads a file, passes parsed data to callback, writes the result back.
   * JSONC comment keys survive the round-trip.
   * Requires `fs.read:<path>` and `fs.write:<path>` permissions.
   */
  function modify(path: string, callback: (data: unknown, meta: { exists: boolean }) => unknown, opts?: { initial?: unknown; spaces?: number; format?: Format }): Promise<void>

  /**
   * Sets or deletes a single JSONPath node. Missing intermediates are created automatically.
   * `value === undefined` deletes the node. Missing file is treated as `{}`.
   * JSONC comment keys survive the round-trip.
   * Requires `fs.read:<path>` and `fs.write:<path>` permissions.
   */
  function writePath(path: string, jsonPath: string, value: unknown, opts?: { spaces?: number; format?: Format }): Promise<void>
}
```

- [ ] **Step 2: Build and verify**

```bash
cd crunes-cli
npm run build 2>&1 | grep -i error | grep -v warning
```

Expected: no errors

- [ ] **Step 3: Run full suite one final time**

```bash
cd crunes-cli
npm test 2>&1 | tail -5
```

Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
cd crunes-cli
git add src/rune/api/types-utils/json.d.ts
git commit -m "docs(json): update types for multi-format support and writePath"
```

---

## Self-Review

**Spec coverage:**
- ✅ Auto-detect format by extension → Task 1 `detectFormat`
- ✅ `format` override opt on all methods → Task 4
- ✅ JSONC comment-preserving round-trip → Tasks 2 + 4
- ✅ `#head`/`#tail`/`#comment:key`/`#inline:key` convention → Task 2
- ✅ JSON5 parse/stringify (best-effort) → Task 3
- ✅ `writePath` set/delete + intermediate creation → Task 5
- ✅ `writePath` respects format → Task 5 test + implementation
- ✅ Missing file on `writePath` delete → no-op → Task 5
- ✅ Types updated → Task 6
- ✅ Dependencies installed → Task 1

**Placeholder scan:** None found.

**Type consistency:** `detectFormat`, `parseJsonc`, `stringifyJsonc`, `parseJson5`, `stringifyJson5` all exported and referenced consistently across tasks. `writePath` signature matches between json.js, runner.js, bootstrap, and d.ts.
