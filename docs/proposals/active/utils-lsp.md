---
tags:
  - proposed
---

# Proposal: Language Server Protocol Client (`utils.lsp`)

## Overview

This proposal introduces `utils.lsp`, a permission-gated LSP client that gives Runes semantic understanding of TypeScript/JavaScript and Java codebases. Rather than bundling per-language AST parsers inside the sandbox, the framework spawns the project's own language server as a short-lived child process and bridges its capabilities into the rune API.

## Motivation

Runes that refactor code, generate stubs from existing types, or validate a codebase before scaffolding need to understand code semantically — not just as text. Regex and string manipulation break on real codebases; what's needed is the same structural information a developer's IDE has: symbol trees, type errors, and safe rename operations.

LSP is the standard interface for this in both ecosystems:

- **TypeScript/JavaScript** — `typescript-language-server` (wraps `tsserver`), already present in most JS projects.
- **Java** — `eclipse.jdt.ls`, the same server powering VS Code's Java extension.

By acting as an LSP client, a single bridge covers both languages without importing their toolchains into the CLI bundle.

## API

`utils.lsp.connect(lang)` spawns the language server and completes the LSP initialization handshake. It returns a session handle. The handle follows the same integer-ID pattern as `utils.sqlite` — the live process is owned by the host, the isolate sees a plain object.

```js
// TypeScript / JavaScript
const ts = await utils.lsp.connect('typescript');

// Java
const java = await utils.lsp.connect('java');

// Document symbols — structured tree of classes, functions, variables
const symbols = await ts.symbols('./src/auth/service.ts');
// [{ name: 'AuthService', kind: 'class', range: {...}, children: [...] }]

// Diagnostics — syntax and type errors
const errors = await ts.diagnostics('./src/auth/service.ts');
// [{ message: "...", severity: 'error', range: { start: { line, char }, end: { line, char } } }]

// Semantic rename across the workspace
await ts.rename('./src/auth/service.ts', { line: 12, char: 8 }, 'AuthenticationService');

// Format a file using the project's own formatter config (Prettier, google-java-format, etc.)
await ts.format('./src/auth/service.ts');

await ts.close();
```

If the rune exits without calling `session.close()`, the framework sends the LSP `shutdown` / `exit` sequence and terminates the child process automatically before disposing the isolate.

## Supported Languages

| Key | Language Server | Auto-detected from |
|---|---|---|
| `'typescript'` | `typescript-language-server` | `node_modules/.bin/typescript-language-server` in project |
| `'javascript'` | `typescript-language-server` | same binary, JS mode |
| `'java'` | `eclipse.jdt.ls` | `JAVA_HOME` + standard install paths |

If the required server binary cannot be found, `utils.lsp.connect()` throws a clear error naming the missing binary and how to install it.

## Permissions

LSP connections require an explicit permission declaration using a `lsp:<lang>` scope:

```json
{
  "runes": {
    "refactor-imports": {
      "permissions": {
        "allow": [
          "lsp:typescript",
          "fs.read:src/**",
          "fs.write:src/**"
        ]
      }
    }
  }
}
```

`rename` and `format` additionally require `fs.write` permission for the affected paths, since they apply edits to files on disk.

## Implementation Groundwork

1. **Host implementation**: Add `src/rune/api/utils/lsp.js`. Maintain a session registry (`Map<number, LspSession>`) scoped to each `createUtils` call. Each `LspSession` owns a `child_process` spawned via `node:child_process.spawn` and a JSON-RPC transport built on `vscode-jsonrpc`. On `connect()`, send `initialize` → await `initializeResult` → send `initialized`.

2. **Path mapping**: All paths passed from the isolate are relative to the project root. The LSP layer must convert them to absolute `file://` URIs before sending to the server, and strip the URI prefix from any paths returned in responses before they cross back into the isolate.

3. **`rename` edit application**: The LSP `textDocument/rename` response returns a `WorkspaceEdit` containing a map of file URIs to arrays of text edits. Apply each edit array to the corresponding file using the existing `fs.write` host implementation after resolving permissions.

4. **`format` edit application**: Similarly, `textDocument/formatting` returns an array of text edits. Apply them to the file content in order (reverse order by range to avoid offset drift) and write back.

5. **Connection cleanup**: Extend `createUtils`'s `dispose()` hook (introduced in the `utils.sqlite` proposal) to also iterate the LSP session registry, send `shutdown` + `exit` to each live server, and `kill()` the child process if it does not exit within 2 seconds.

6. **Isolate bridge**: Add `ivm.Reference` callbacks in `runner.js`: `$__utils_lsp_connect`, `$__utils_lsp_symbols`, `$__utils_lsp_diagnostics`, `$__utils_lsp_rename`, `$__utils_lsp_format`, and `$__utils_lsp_close`. Results cross the boundary as JSON strings.

7. **Handle wrapping in `utils-bootstrap.js`**: `utils.lsp.connect(lang)` receives an integer handle ID and returns a plain object `{ symbols, diagnostics, rename, format, close }` that closes over it — same pattern as `utils.sqlite.open()`.
