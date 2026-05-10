---
tags:
  - proposed
---

# Proposal: Archive Utilities (`utils.archive`)

## Overview

This proposal introduces `utils.archive`, a permission-gated utility for creating and extracting archive files inside Rune execution. It provides streaming-based zip extraction and tar.gz creation without requiring authors to shell out to system tools or bundle heavy libraries in the sandbox.

## Motivation

Runes that scaffold projects, distribute built artifacts, or unpack remote downloads frequently need to manipulate archives. Without a built-in utility, authors are forced to either shell out to `tar`/`unzip` (which bypasses the permission system) or import a third-party JS library that must cross the isolate boundary unsafely.

Two additional concerns make a native bridge essential:

- **Memory safety**: Loading a large `.zip` entirely into the V8 sandbox heap will crash the isolate. All operations must stream from disk to disk on the host side.
- **Security**: Naive zip extraction is vulnerable to zip-slip attacks, where crafted archive entries use `../` paths to write outside the intended destination directory. The bridge must validate every extracted path before writing.

## API

```js
// Extract a .zip archive into a directory
await utils.archive.unzip(source, destDir);

// Create a .tar.gz archive from a directory
await utils.archive.tar(sourceDir, destFile);
```

- **`utils.archive.unzip(source, destDir)`** — Extracts the zip file at `source` into `destDir`. The destination directory is created if it does not exist. Throws if any entry path resolves outside `destDir`.
- **`utils.archive.tar(sourceDir, destFile)`** — Packs `sourceDir` into a gzip-compressed tar archive written to `destFile`. Existing files at `destFile` are overwritten.

Both methods return a `Promise<void>` and resolve only after all data has been fully flushed to disk.

## Permissions

Archive operations compose existing filesystem permissions — no new permission scope is introduced.

- `unzip` requires `fs.write` on the destination directory and `fs.read` on the source file.
- `tar` requires `fs.read` on the source directory and `fs.write` on the destination file.

```json
{
  "runes": {
    "scaffold": {
      "permissions": {
        "allow": [
          "fs.read:templates/**",
          "fs.write:output/**"
        ]
      }
    }
  }
}
```

## Implementation Groundwork

1. **Host implementation**: Add `src/rune/api/utils/archive.js` using `unzipper` (streaming zip) and the `tar` npm package (streaming tar.gz). Both operate on host file paths and never buffer full archive content in memory.
2. **Zip-slip guard**: Before extracting each entry, resolve its final path and assert it starts with the resolved `destDir`. Abort the entire extraction and clean up partial output if any entry fails the check.
3. **Isolate bridge**: Register `utils.archive` in `src/rune/isolation/builtins.js`, exposing `unzip` and `tar` as `ivm.Reference` callbacks that accept serializable string arguments and return a promise.
4. **Permission wiring**: Route both methods through the existing `makePermissionChecker` pipeline using the `fs.read` / `fs.write` scopes already defined in `src/rune/permissions/permissions.js`.
