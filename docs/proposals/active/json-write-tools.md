---
tags:
  - proposed
---

# Proposal: JSON Write Tools

## Overview
This proposal introduces `utils.json.write` and `utils.json.update` to the Context Runes ecosystem, completing the Write Tools expansion. These tools provide a safe, convenient way for runes to modify structured JSON data without dealing with manual parsing or stringification.

## Motivation
In the initial `rune-write-tools` implementation, `fs.write` and `fs.replace` were added, but JSON modification was deferred. Currently, to update a JSON file, a rune must:
1. `utils.json.read(filepath)`
2. Mutate the object
3. `JSON.stringify(object, null, 2)`
4. `utils.fs.write(filepath, string)`

This is boilerplate-heavy and prone to inconsistent formatting. By providing native JSON write utilities, we ensure standard 2-space indentation and simplify the developer experience.

## Proposed API

### 1. `utils.json.write(filepath, data)`
Directly overwrites the target JSON file with the provided data object.
```javascript
await utils.json.write('package.json', { name: "new-name" });
```

### 2. `utils.json.update(filepath, callback)`
Reads the JSON, passes it to an asynchronous callback for mutation, and automatically writes it back.
```javascript
await utils.json.update('package.json', async (pkg) => {
  pkg.version = "2.0.0";
  // The object is mutated in-place, no return required.
});
```

## Security Constraints
These tools will explicitly rely on the existing `"fs.write"` permission. We do **not** need a separate `"json.write"` permission, as JSON writing is fundamentally a filesystem write operation. If the rune lacks `fs.write` permission for the target file, a `PermissionError` is thrown.

## Implementation Details (Isolate Boundary)

To avoid complex boundary serialization (like passing callbacks to the Node.js host), both of these methods will be implemented entirely inside the V8 Isolate proxy (`src/isolation/utils-bootstrap.js`), composing existing primitives:

```javascript
json: {
  // ... existing read tools ...
  write: async (filepath, data) => {
    const content = JSON.stringify(data, null, 2) + '\n';
    await globalThis.utils.fs.write(filepath, content);
  },
  update: async (filepath, callback) => {
    const data = await globalThis.utils.json.read(filepath);
    if (!data) throw new Error(`Cannot update missing JSON file: ${filepath}`);
    await callback(data);
    await globalThis.utils.json.write(filepath, data);
  }
}
```

This guarantees that:
1. Callbacks never cross the `isolated-vm` boundary.
2. The host API requires zero new methods.
3. Permissions are automatically verified by the underlying `fs.write` call.
