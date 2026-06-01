# 🗃️ Premium Project Archiver & Sync Demo

A high-performance demonstration of **crunes** sandboxed environment capability. It showcases directory archiving, deep directory scaffolding, zip streaming, and alphanumeric CLI option parsing.

## What it demonstrates

This example utilizes several newly stabilized sandboxed V8 isolate-to-host bridge APIs:

1.  **Deep FS Scaffolding (`fs.writeStream`, `archive.unzipStream`)**: Writes streams to deeply nested paths where the parent folders do not exist. The parent folder structures are scaffolded recursively on the host without blocking the event loop.
2.  **Zip Extraction Race Prevention (`archive.unzipStream`)**: Pipes a zip file stream into the extractor and immediately reads the output back upon stream closure. Promises are fully tracked on the host, preventing premature stream closure.
3.  **Alphanumeric CLI Option Parsing (`args`)**: Custom alphanumeric option placeholder names containing underscores and digits (such as `--target-dir <dir_name_1>` and `--backup-dir <dir_name_2>`) are parsed and validated seamlessly.

---

## Setup & Execution

From this directory, execute the project archiver:

```bash
crunes use archive-project
```

### Specifying Custom Targets & Backups
You can pass custom source targets and deep backup paths using the parsed options:

```bash
crunes use archive-project --target-dir custom_staging_dir --backup-dir backups/deep/nested/my_v2_backup
```

---

## Technical Composition

The core sync pipeline showcases standard WHATWG streaming pipe operations inside the sandboxed V8 execution context:

```javascript
// 1. Pack the source directory on-the-fly
await archive.zip(targetDir, archivePath)

// 2. Stream the binary zip and extract it into a deeply nested path
const readStream = fs.readStreamAsBytes(archivePath)
const unzipStream = archive.unzipStream(`${backupDir}/extracted`)

await readStream.pipeTo(unzipStream)

// 3. Immediately read back restored files without race conditions
const restored = await fs.read(`${backupDir}/extracted/source_code.js`)
```
