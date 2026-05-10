---
tags:
  - proposed
---

# Proposal: YAML Utilities (`utils.yaml`)

## Overview

This proposal introduces `utils.yaml` as a companion to `utils.json`, providing read and write access to YAML files inside Rune execution. It follows the same structure and permission model as `utils.json`: host-side parsing, isolate-side write composition, and no new permission scopes.

## Motivation

YAML is the dominant format for configuration in most modern toolchains — CI pipelines, Kubernetes manifests, OpenAPI specs, Helm charts, GitHub Actions workflows. Runes that scaffold, lint, or modify these files currently have no first-class way to parse or produce YAML; authors must either read raw strings and use a regex-based approach or bundle a YAML library inside the sandbox.

By mirroring the `utils.json` design, `utils.yaml` gives rune authors a familiar API for YAML with zero additional permission overhead.

## API

```js
// Read and parse a YAML file — returns a JS object or null
const workflow = await utils.yaml.read('.github/workflows/ci.yml');
const workflow = await utils.yaml.read('.github/workflows/ci.yml', { throw: false });

// Overwrite a file with serialized YAML
await utils.yaml.write('helm/values.yaml', { replicas: 3, image: 'app:latest' });

// Read, mutate in-place, write back
await utils.yaml.update('helm/values.yaml', async (values) => {
  values.replicas = 5;
});
```

- **`utils.yaml.read(path, { throw: true })`** — Reads and parses the file. Returns a JS object. With `{ throw: false }`, returns `null` if the file does not exist instead of throwing.
- **`utils.yaml.write(path, data)`** — Serializes `data` to YAML and overwrites the file. Uses 2-space indentation and produces human-readable output.
- **`utils.yaml.update(path, callback)`** — Reads the file, passes the parsed object to the async callback for in-place mutation, then writes it back. Throws if the file does not exist.

## Security Constraints

`utils.yaml` relies entirely on the existing `fs.read` and `fs.write` permissions — no new scope is introduced. A rune lacking `fs.write` permission for a path cannot call `yaml.write` or `yaml.update` on it; the underlying `fs.write` call will throw a `PermissionError`.

## Implementation Details (Isolate Boundary)

Host-side parsing and stringification are exposed as two `ivm.Reference` callbacks. `write` and `update` are implemented inside `utils-bootstrap.js` composing those callbacks with `utils.fs.write` — no callbacks cross the boundary:

```js
// utils-bootstrap.js
yaml: {
  read:   (p, o) => $__utils_yaml_read.apply(undefined, [p, o ? JSON.stringify(o) : undefined], { result: { promise: true } }).then(JSON.parse),
  write: async (p, data) => {
    const content = await $__utils_yaml_stringify.apply(undefined, [JSON.stringify(data)], { result: { promise: true } });
    await globalThis.utils.fs.write(p, content);
  },
  update: async (p, callback) => {
    const data = await globalThis.utils.yaml.read(p);
    if (!data) throw new Error(`Cannot update missing YAML file: ${p}`);
    await callback(data);
    await globalThis.utils.yaml.write(p, data);
  },
}
```

This guarantees:
1. Callbacks never cross the `isolated-vm` boundary.
2. The host API requires only two new methods — `read` and `stringify`.
3. Permissions are automatically enforced by the underlying `fs.write` call.

## Implementation Groundwork

1. **Host implementation**: Add `src/rune/api/utils/yaml.js` using `js-yaml`. Expose `read(relPath, opts)` (delegates to `fsUtils.read` then `yaml.load`) and `stringify(data)` (calls `yaml.dump` with `{ indent: 2, lineWidth: -1 }`).
2. **Isolate bridge**: Register `$__utils_yaml_read` and `$__utils_yaml_stringify` as `ivm.Reference` callbacks in `runner.js`. Data crosses the boundary as JSON strings.
3. **Bootstrap wiring**: Add the `yaml` namespace to `utils-bootstrap.js` as shown above.
4. **Error messages**: On parse failure, include the file path and YAML line/column in the error message, matching the quality of `JsonParseError` in `src/rune/api/json.js`.
