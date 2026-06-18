# YAML & XML Namespace Improvements — Design Spec

Brainstormed 2026-06-19.

---

## Goal

Bring `yaml` and `xml` to parity with `json` by adding `parse`/`stringify` (standalone text ↔ object), `readPath`/`readPathAll` (JSONPath queries), and `writePath` (targeted single-node mutation). Also exposes `parse`/`stringify` on `json` for consistency. All three namespaces gain proper test coverage and fully documented types.

**Already done:** `json.readPath`/`readPathAll` `opts.fallback` migration (separate fix, not part of this spec).

---

## `parse` / `stringify`

Standalone text ↔ object with no file I/O — for content from shell output, fetch responses, template strings.

### json

```ts
json.parse(text: string, opts?: { format?: Format }): unknown
json.stringify(data: unknown, opts?: { spaces?: number; format?: Format }): string
```

- `format` defaults to `'json'` (no extension to auto-detect from)
- JSONC comment conventions apply when `format: 'jsonc'`
- Implementation: thin wrappers over internal `_parse`/`_stringify`; exported as `parseJsonText`/`stringifyJsonText` (avoids clash with internal `parseJson`); wired via `$__utils_json_parse` / `$__utils_json_stringify`

### yaml

```ts
yaml.parse(text: string): unknown
yaml.stringify(data: unknown, opts?: { indent?: number }): string
```

- Same comment round-trip as `yaml.read`/`yaml.write`: `#head`, `#tail`, `#comment:key`, `#inline:key`, `#style:key`, `#flow:key`, `#comment:key[i]`
- Implementation: extract `parseWithComments` → export as `parseYaml`; extract `buildDoc` → export as `stringifyYaml`; wire via `$__utils_yaml_parse` / `$__utils_yaml_stringify`

### xml

```ts
xml.parse(text: string): unknown
xml.stringify(data: unknown, opts?: { indent?: number }): string
```

- Same `@_` attribute, `#comment` array, `#cdata` conventions as `xml.read`/`xml.write`
- Implementation: `parseXml` already exists — export it; extract builder logic → export as `stringifyXml`; wire via `$__utils_xml_parse` / `$__utils_xml_stringify`

---

## `readPath` / `readPathAll`

JSONPath queries on file content. Uses `jsonpath-plus` (already a dependency).

### yaml

```ts
yaml.readPath(path: string, jsonPath: string, fallback?: unknown, opts?: {}): Promise<unknown>
yaml.readPathAll(path: string, jsonPath: string, fallback?: unknown[], opts?: {}): Promise<unknown[]>
```

### xml

```ts
xml.readPath(path: string, jsonPath: string, fallback?: unknown, opts?: {}): Promise<unknown>
xml.readPathAll(path: string, jsonPath: string, fallback?: unknown[], opts?: {}): Promise<unknown[]>
```

**Semantics (both):**
- File missing → returns `fallback` (or `undefined` / `[]`)
- No match → returns `fallback` (or `undefined` / `[]`)

---

## `writePath`

Targeted single-node mutation. Read → mutate at JSONPath → write back.

### yaml

```ts
yaml.writePath(path: string, jsonPath: string, value: unknown, opts?: { indent?: number }): Promise<void>
```

- `value === undefined` → deletes the node
- File missing + value provided → treated as `{}`, creates file
- File missing + `value === undefined` → no-op
- Missing intermediate nodes created as `{}`
- YAML comment metadata survives the operation

### xml

```ts
xml.writePath(path: string, jsonPath: string, value: unknown, opts?: { indent?: number }): Promise<void>
```

- `value === undefined` → deletes the node
- **File missing → always throws** (use `modify` + `initial` to create XML from scratch)
- Missing intermediate nodes created as `{}`
- `#comment` arrays survive (plain array properties)

---

## Updated Types

### json.d.ts additions

```ts
// New — standalone parse/stringify without file I/O
function parse(text: string, opts?: { format?: Format }): unknown
function stringify(data: unknown, opts?: { spaces?: number; format?: Format }): string
```

### yaml.d.ts (full)

```ts
/** Read and write YAML files with comment preservation and JSONPath support */
declare namespace yaml {
  // Comment keys on plain objects:
  //   #head           — comment before the root mapping
  //   #tail           — comment after the root mapping
  //   #comment:key    — comment on the line before `key`
  //   #inline:key     — inline comment after the value of `key`
  //   #style:key      — scalar style: 'literal' | 'folded' | 'single' | 'double'
  //   #flow:key       — true if the sequence value of `key` uses flow style
  //   #comment:key[i] — comment before array item i of `key`

  function parse(text: string): unknown
  function stringify(data: unknown, opts?: { indent?: number }): string

  function read(path: string, opts?: { throw?: boolean }): Promise<unknown>
  function write(path: string, data: unknown, opts?: { indent?: number }): Promise<void>
  function modify(path: string, callback: (data: unknown, meta: { exists: boolean }) => unknown, opts?: { initial?: unknown; indent?: number }): Promise<void>

  function readPath(path: string, jsonPath: string, fallback?: unknown, opts?: {}): Promise<unknown>
  function readPathAll(path: string, jsonPath: string, fallback?: unknown[], opts?: {}): Promise<unknown[]>
  function writePath(path: string, jsonPath: string, value: unknown, opts?: { indent?: number }): Promise<void>
}
```

### xml.d.ts (full)

```ts
/** Read and write XML files with JSONPath support */
declare namespace xml {
  // Parsed object conventions:
  //   @_name   — XML attribute `name`
  //   #comment — array of comment strings at this node
  //   #cdata   — CDATA content

  function parse(text: string): unknown
  function stringify(data: unknown, opts?: { indent?: number }): string

  function read(path: string, opts?: { throw?: boolean }): Promise<object | null>
  function write(path: string, data: object, opts?: { indent?: number }): Promise<void>
  function modify(path: string, callback: (data: unknown, meta: { exists: boolean }) => unknown, opts?: { initial?: object; indent?: number }): Promise<void>

  function readPath(path: string, jsonPath: string, fallback?: unknown, opts?: {}): Promise<unknown>
  function readPathAll(path: string, jsonPath: string, fallback?: unknown[], opts?: {}): Promise<unknown[]>
  /** Throws if the file is missing. Use modify+initial to create XML files from scratch. */
  function writePath(path: string, jsonPath: string, value: unknown, opts?: { indent?: number }): Promise<void>
}
```

---

## Test Coverage

### `test/rune/api/json.test.js` (append)

- `json.parse` — plain JSON, JSONC with `#head`, JSON5 with unquoted keys, invalid throws
- `json.stringify` — plain JSON, JSONC writes comments, JSON5 round-trips

### `test/rune/api/yaml.test.js` (new file)

- `parseYaml` / `stringifyYaml` — round-trip, `#head`, `#comment:key`, `#inline:key`, `#style:key`, invalid throws
- `yaml.read` / `yaml.write` / `yaml.modify`
- `yaml.readPath` / `yaml.readPathAll` — match, no match, missing file, fallback
- `yaml.writePath` — set, create intermediates, create file, delete, no-op on missing+undefined, comments preserved

### `test/rune/api/xml.test.js` (new file)

- `parseXml` / `stringifyXml` — round-trip, `@_` attributes, `#comment` array, invalid throws
- `xml.read` / `xml.write` / `xml.modify`
- `xml.readPath` / `xml.readPathAll` — match, no match, missing file, fallback
- `xml.writePath` — set, create intermediates, delete, throws on missing file

---

## Out of Scope

- XPath — JSONPath on parsed JS object is sufficient
- yaml multi-document support
- xml namespace handling beyond `@_xmlns:ns` passthrough
