---
tags:
  - proposed
---

# Proposal: OpenAPI Utilities (`utils.openapi`)

## Overview

This proposal introduces `utils.openapi`, a host-side utility for parsing and inspecting OpenAPI specifications inside Rune execution. It handles `$ref` dereferencing, multi-format input (JSON and YAML), and version normalization across OpenAPI 2.0 (Swagger) and 3.x so rune authors receive a single consistent object regardless of input format.

## Motivation

Automation of controllers, DTOs, route files, and fetch clients from API specs is a core rune use case. Doing this correctly requires resolving every `$ref` in the spec tree before the rune can iterate over schemas and endpoints — a recursive operation that is error-prone to implement manually and redundant for every rune author to rewrite.

Beyond dereferencing, real-world specs mix OpenAPI 2.0 and 3.0/3.1 formats. Normalizing the differences once at the host layer means rune logic stays focused on generation rather than format detection.

## API

```js
// Parse and fully dereference a local spec file (.json or .yaml)
const spec = await utils.openapi.parse('./openapi.yaml');

// Flatten paths → methods into an iterable array of endpoint descriptors
const endpoints = utils.openapi.endpoints(spec);
// [{ method: 'get', path: '/users', operationId: 'listUsers', parameters: [], responses: {} }, ...]

// Extract all named schemas from components/definitions
const schemas = utils.openapi.schemas(spec);
// { User: { type: 'object', properties: { ... } }, ... }
```

- **`utils.openapi.parse(path)`** — Reads the file at `path`, detects JSON or YAML format, resolves all `$ref` entries recursively, and normalizes the result to an OpenAPI 3.x-shaped object. Returns a `Promise` that resolves to the fully dereferenced spec.
- **`utils.openapi.endpoints(spec)`** — Iterates `spec.paths` and flattens each path/method pair into a plain array of endpoint objects. Synchronous.
- **`utils.openapi.schemas(spec)`** — Returns the named schemas map from `spec.components.schemas` (OpenAPI 3.x) or `spec.definitions` (Swagger 2.0), normalized to the same key. Synchronous.

## Permissions

`utils.openapi.parse()` requires `fs.read` permission for the spec file path — no new scope is introduced. The parsed spec object is returned as a plain JS value; no filesystem access occurs after parsing.

## Implementation Groundwork

1. **Host implementation**: Add `src/rune/api/utils/openapi.js` using `@apidevtools/swagger-parser`. Call `SwaggerParser.dereference(absPath)` which handles `$ref` resolution, circular reference detection, and both JSON/YAML input transparently. For Swagger 2.0 inputs, apply a minimal normalization pass to move `definitions` → `components.schemas` and `basePath` → `servers`.
2. **Isolate bridge**: Register `$__utils_openapi_parse` as an `ivm.Reference` callback in `runner.js`. The resolved spec crosses the boundary as a JSON string. `endpoints` and `schemas` are implemented entirely in `utils-bootstrap.js` as synchronous helpers over the parsed object — no additional host references needed.
3. **Permission wiring**: `parse()` on the host side calls `checkPermission('fs.read', token)` using `canonicalizePath` on the spec path before passing it to `SwaggerParser`.
4. **Error messages**: Wrap `SwaggerParser` errors to include the spec file path and the offending `$ref` value in the thrown error message.
