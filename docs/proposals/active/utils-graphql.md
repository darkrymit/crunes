---
tags:
  - proposed
---

# Proposal: GraphQL Utilities (`utils.graphql`)

## Overview

This proposal introduces `utils.graphql`, a host-side utility for loading and inspecting GraphQL schemas and documents inside Rune execution. It provides schema parsing from SDL files, type and field introspection, and multi-file schema merging — giving rune authors the structured data they need to generate resolvers, types, and client code without bundling the `graphql` package in the sandbox.

## Motivation

GraphQL schemas are the source of truth for code generation in many stacks — TypeScript type definitions, resolver stubs, client hooks, and mock factories all derive from the schema. Runes that automate this generation need to parse `.graphql` SDL files and inspect their type system programmatically.

The reference `graphql` npm package is too large and dependency-heavy to bundle inside the isolated-vm sandbox. A host-side bridge exposes the same capabilities through a clean, serializable API.

## API

```js
// Load and parse a SDL schema file
const schema = await utils.graphql.load('./schema.graphql');

// Merge multiple SDL files or glob patterns into one schema
const schema = await utils.graphql.load(['./schema/**/*.graphql']);

// List all types in the schema
const types = utils.graphql.types(schema);
// [{ name: 'User', kind: 'OBJECT', fields: [{ name: 'id', type: 'ID!', args: [] }, ...] }, ...]

// Get a single type by name
const userType = utils.graphql.type(schema, 'User');

// List all queries, mutations, and subscriptions
const operations = utils.graphql.operations(schema);
// { queries: [...], mutations: [...], subscriptions: [...] }
```

- **`utils.graphql.load(path | path[])`** — Reads one or more SDL files (glob patterns accepted), merges them into a single schema, and validates the result. Returns a serializable schema descriptor object. Throws on invalid SDL or type conflicts.
- **`utils.graphql.types(schema)`** — Returns all named types (objects, inputs, enums, interfaces, unions) excluding built-in GraphQL scalars. Synchronous.
- **`utils.graphql.type(schema, name)`** — Returns the descriptor for a single named type, or `null` if not found. Synchronous.
- **`utils.graphql.operations(schema)`** — Returns the fields of the `Query`, `Mutation`, and `Subscription` root types grouped by operation kind. Synchronous.

## Permissions

`utils.graphql.load()` requires `fs.read` permission for each file path resolved — no new scope is introduced. All other helpers operate on the already-parsed schema descriptor and require no permissions.

## Implementation Groundwork

1. **Host implementation**: Add `src/rune/api/utils/graphql.js` using the `graphql` package. Use `loadSchemaSync` from `@graphql-tools/load` with `GraphQLFileLoader` for file loading and merging. Serialize the resulting `GraphQLSchema` into a plain descriptor object (types, fields, args, directives) using `schema.getTypeMap()` — this is what crosses the boundary as JSON.
2. **Glob support in `load()`**: When an array is passed, expand any glob patterns using `tinyglobby` (already a dependency) before loading. Resolve all paths via `canonicalizePath` and check `fs.read` permission for each.
3. **Isolate bridge**: Register `$__utils_graphql_load` as an `ivm.Reference` callback in `runner.js`. The serialized schema descriptor crosses the boundary as a JSON string. `types`, `type`, and `operations` are implemented in `utils-bootstrap.js` as synchronous helpers over the parsed descriptor — no additional host references needed.
4. **Schema descriptor format**: Define a stable, minimal serialization format for the schema (type name, kind, fields with name/type/args, enum values, directive names). This is the public contract rune authors work against, not the raw `GraphQLSchema` object.
