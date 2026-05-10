---
tags:
  - proposed
---

# Proposal: XML Utilities (`utils.xml`)

## Overview

This proposal introduces `utils.xml` as a companion to `utils.json` and `utils.yaml`, providing read and write access to XML files inside Rune execution. It follows the same structure and permission model: host-side parsing and stringification, isolate-side write composition, no new permission scopes.

## Motivation

XML remains the dominant format for Maven POMs, Android manifests, `.csproj` files, Spring configuration, SOAP responses, and many enterprise toolchain configs. Runes that scaffold or modify these files have no first-class XML support today — authors must parse raw strings manually or avoid XML-heavy ecosystems entirely.

By mirroring the `utils.json` design, `utils.xml` gives rune authors a consistent API for XML with no additional permission overhead.

## API

```js
// Read and parse an XML file — returns a JS object
const manifest = await utils.xml.read('AndroidManifest.xml');
const pom      = await utils.xml.read('pom.xml', { throw: false }); // null if missing

// Overwrite a file with serialized XML
await utils.xml.write('pom.xml', updatedPom);

// Read, mutate in-place, write back
await utils.xml.update('pom.xml', async (pom) => {
  pom.project.version = '2.0.0';
});
```

- **`utils.xml.read(path, { throw: true })`** — Reads and parses the file into a JS object. Attributes are accessible under an `@_` key prefix (e.g., `node['@_id']`). With `{ throw: false }`, returns `null` if the file does not exist.
- **`utils.xml.write(path, data)`** — Serializes `data` back to XML and overwrites the file. Produces indented, human-readable output with a standard XML declaration header.
- **`utils.xml.update(path, callback)`** — Reads the file, passes the parsed object to the async callback for in-place mutation, then writes it back. Throws if the file does not exist.

## Security Constraints

`utils.xml` relies entirely on the existing `fs.read` and `fs.write` permissions — no new scope is introduced. A rune lacking `fs.write` permission for a path cannot call `xml.write` or `xml.update` on it; the underlying `fs.write` call will throw a `PermissionError`.

## Implementation Details (Isolate Boundary)

Host-side parsing and stringification are exposed as two `ivm.Reference` callbacks. `write` and `update` are implemented inside `utils-bootstrap.js` composing those callbacks with `utils.fs.write` — no callbacks cross the boundary:

```js
// utils-bootstrap.js
xml: {
  read:   (p, o) => $__utils_xml_read.apply(undefined, [p, o ? JSON.stringify(o) : undefined], { result: { promise: true } }).then(JSON.parse),
  write: async (p, data) => {
    const content = await $__utils_xml_stringify.apply(undefined, [JSON.stringify(data)], { result: { promise: true } });
    await globalThis.utils.fs.write(p, content);
  },
  update: async (p, callback) => {
    const data = await globalThis.utils.xml.read(p);
    if (!data) throw new Error(`Cannot update missing XML file: ${p}`);
    await callback(data);
    await globalThis.utils.xml.write(p, data);
  },
}
```

This guarantees:
1. Callbacks never cross the `isolated-vm` boundary.
2. The host API requires only two new methods — `read` and `stringify`.
3. Permissions are automatically enforced by the underlying `fs.write` call.

## Implementation Groundwork

1. **Host implementation**: Add `src/rune/api/utils/xml.js` using `fast-xml-parser`. Use `XMLParser` for `read` (with `ignoreAttributes: false`, `attributeNamePrefix: '@_'`) and `XMLBuilder` for `stringify` (with `indentBy: '  '`, `format: true`).
2. **Isolate bridge**: Register `$__utils_xml_read` and `$__utils_xml_stringify` as `ivm.Reference` callbacks in `runner.js`. Data crosses the boundary as JSON strings.
3. **Bootstrap wiring**: Add the `xml` namespace to `utils-bootstrap.js` as shown above.
4. **Error messages**: On parse failure, include the file path and character offset in the error message, matching the quality of `JsonParseError` in `src/rune/api/json.js`.
