# NPM Package Imports — Design Spec

Brainstormed 2026-06-19.

---

## Goal

Make `import { gt } from 'semver'` and `import chalk from 'chalk'` work inside runes for both ESM and CJS npm packages installed in `.crunes/node_modules` (or a plugin's `node_modules`). Today the resolver reads only `package.json#main` and calls `isolate.compileModule` directly — which fails for CJS packages (no ESM exports) and for ESM-only packages that omit `main` in favour of `exports`.

---

## Architecture

Single file change: `src/rune/isolation/resolver.js`. Two new responsibilities extracted into focused functions:

- **`resolvePackageEntry(pkgJson, pkgDir)`** — pure function, walks `package.json` export conditions to find the correct entry file path.
- **`bundleNpmPackage(absEntryPath)`** — async, uses esbuild JS API to produce a self-contained ESM bundle string + the list of named export keys. For CJS packages, probes a throwaway isolated-vm isolate to extract keys safely.

`compileFile` (the existing per-module compile cache) delegates to `bundleNpmPackage` for npm specifiers (non-relative, non-virtual, non-builtin). Result is compiled via `isolate.compileModule` as before.

No new files. No new npm dependencies — esbuild is already a devDependency and its JS API is available at runtime.

---

## Part 1: `exports` Field Resolution

### Priority chain in `resolvePackageEntry(pkgJson, pkgDir)`

```
exports["."].import        (string, or nested .default)
exports["."].node          (string, or nested .default)
exports["."].default       (string)
exports                    (string shorthand — e.g. chalk: exports: "./source/index.js")
main                       (string)
"index.js"                 (hardcoded fallback)
```

Returns an absolute path: `path.join(pkgDir, resolvedEntry)`.

### Real-world shapes handled

| Package | Shape | Resolved entry |
|---------|-------|---------------|
| chalk | `exports: "./source/index.js"` | `./source/index.js` |
| jsonpath-plus | `exports["."].import: "./dist/index-node-esm.js"` | `./dist/index-node-esm.js` |
| fast-xml-parser | `exports["."].import.default: "./src/fxp.js"` | `./src/fxp.js` |
| tinyglobby | `exports["."].import: "./dist/index.mjs"` | `./dist/index.mjs` |
| yaml | `exports["."].node: "./dist/index.js"` | `./dist/index.js` |
| semver | `main: "index.js"` | `index.js` |
| picomatch | _(none)_ | `index.js` |

### Implementation

```js
function resolvePackageEntry(pkgJson, pkgDir) {
  const exp = pkgJson.exports
  let entry = null

  if (exp) {
    if (typeof exp === 'string') {
      entry = exp
    } else if (exp['.']) {
      const dot = exp['.']
      if (typeof dot === 'string') {
        entry = dot
      } else {
        const val = dot.import ?? dot.node ?? dot.default
        entry = typeof val === 'string' ? val : (val?.default ?? null)
      }
    }
  }

  if (!entry) entry = pkgJson.main ?? 'index.js'
  return path.join(pkgDir, entry)
}
```

---

## Part 2: CJS Bundling with Sandboxed Key Extraction

### `bundleNpmPackage(absEntryPath)` → `{ bundleText, namedKeys }`

```
1. esbuild.build({
     entryPoints: [absEntryPath],
     bundle: true,          // flattens ALL transitive deps — probe isolate needs no imports
     format: 'esm',
     platform: 'browser',   // no node: built-ins leaked into bundle
     write: false,
     metafile: true,
   })
   → bundleText, exportedNames (from metafile)

2. if exportedNames is ['default'] only → CJS package:
     a. Find last `var (require_\w+) = __commonJS` match in bundleText → wrapperName
     b. probeText = bundleText + `\nconst __k = JSON.stringify(Object.keys(${wrapperName}()));\nexport { __k };`
     c. Spin up throwaway ivm.Isolate({ memoryLimit: 32 })
     d. compileModule(probeText) → instantiate(ctx, noImports) → evaluate()
     e. Read __k → JSON.parse → namedKeys
     f. iso.dispose()
     g. bundleText += `\nexport const { ${namedKeys.join(', ')} } = ${wrapperName}();`

3. else → ESM package:
     namedKeys = exportedNames  (already correct named exports from esbuild)
     bundleText unchanged

4. return { bundleText, namedKeys }
```

`noImports` in step (d) is `() => { throw new Error('unexpected import') }` — the bundle is fully self-contained so this never fires for well-formed packages.

### Detection logic

| esbuild metafile exports | Package type | Action |
|--------------------------|-------------|--------|
| `['default']` only | CJS | probe isolate for keys, append named re-exports |
| anything else | ESM | use metafile exports directly, no probe |

### Timing (measured)

| Step | Time |
|------|------|
| esbuild bundle | ~35ms (CJS), ~20ms (ESM) |
| Probe isolate (CJS only) | ~10ms |
| `isolate.compileModule` | ~5ms |
| **Total per package** | **~50ms (CJS), ~25ms (ESM)** |

Cost is per unique package per rune run. In-memory cache (keyed on `absEntryPath`) means the same package imported twice in one rune pays the cost once.

### Security

- esbuild runs on the host but only reads files — no execution
- The probe isolate runs the CJS code in a sandboxed V8 context with `memoryLimit: 32` and no I/O access — identical security posture to the rune isolate itself
- Named keys are extracted from the probe result (a JSON string crossing the ivm boundary), not from host-side execution
- `platform: 'browser'` prevents esbuild from bundling `node:` built-ins — packages that require `fs`, `path`, etc. will fail cleanly at bundle time with an esbuild error

### Error cases

| Situation | Behaviour |
|-----------|-----------|
| `package.json` missing | falls back to `index.js` entry |
| Entry file not found | esbuild throws → propagated as rune error |
| esbuild bundle error (missing dep, syntax error) | propagated as rune error with esbuild message |
| CJS package uses `node:` built-ins | esbuild error: `"fs" is not available in the configured target environment` |
| No `__commonJS` wrapper found in bundle (unusual CJS) | `namedKeys = []`, only `default` export available |
| Probe isolate throws | `namedKeys = []`, only `default` export available |

---

## Integration with Existing `compileFile`

Current `compileFile(specifier, absPath)`:
```js
async function compileFile(specifier, absPath) {
  if (cache.has(specifier)) return cache.get(specifier)
  const source = await fs.readFile(absPath, 'utf8')
  const mod = await isolate.compileModule(source, { filename: absPath })
  cache.set(specifier, mod)
  moduleFilenames.set(mod, absPath)
  return mod
}
```

npm packages (Step 3 in the resolver, `isAllowed && isDeclared`) now call a new `compileNpmPackage(specifier, absPath)` instead:
```js
async function compileNpmPackage(specifier, absEntryPath) {
  if (cache.has(specifier)) return cache.get(specifier)
  const { bundleText } = await bundleNpmPackage(absEntryPath)
  const mod = await isolate.compileModule(bundleText, { filename: absEntryPath })
  cache.set(specifier, mod)
  moduleFilenames.set(mod, absEntryPath)
  return mod
}
```

`compileFile` is unchanged and continues to handle relative imports, `@project/`, `@plugin/` paths.

---

## Files Touched

- **Modify:** `src/rune/isolation/resolver.js`
  - Add `resolvePackageEntry(pkgJson, pkgDir)` (pure, ~15 lines)
  - Add `bundleNpmPackage(absEntryPath)` (async, ~40 lines)
  - Add `compileNpmPackage(specifier, absEntryPath)` (async, ~10 lines)
  - Replace lines 110–117 (entry resolution + `compileFile` call) with `resolvePackageEntry` + `compileNpmPackage`
- **Modify:** `test/rune/isolation/resolver.test.js`
  - Add describe block for `resolvePackageEntry` (unit tests for each exports shape)
  - Add describe block for `bundleNpmPackage` (integration tests with real packages from scratch/)
  - Add describe block for end-to-end npm import via `createModuleResolver`

---

## Out of Scope

- Disk cache for esbuild bundles — in-memory per run only
- `exports` conditions beyond `import`, `node`, `default` (e.g. `browser`, `deno`, `worker`)
- Sub-path exports (`pkg/subpath`) — only the `"."` root export is resolved
- `node:` built-in packages inside CJS deps — fail at bundle time with a clear esbuild error
- Dynamic `import()` inside rune source — remains blocked by `assertNoDynamicImport`
