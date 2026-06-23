# NPM Package Imports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `import { gt } from 'semver'` and `import chalk from 'chalk'` work inside runes for both ESM and CJS npm packages by fixing `exports` field resolution and adding esbuild-based CJS bundling with sandboxed named export extraction.

**Architecture:** Two changes to `src/rune/isolation/resolver.js` only. Task 1 adds `resolvePackageEntry` (pure function, walks `package.json` export conditions). Task 2 adds `bundleNpmPackage` (esbuild bundles the package into ESM; for CJS packages, probes a throwaway isolated-vm isolate to extract named export keys safely) and `compileNpmPackage` (replaces the `compileFile` call in Step 3 of the resolver).

**Tech Stack:** Node.js ESM, isolated-vm, esbuild JS API (already a devDependency), vitest

## Global Constraints

- All commands run inside `crunes-cli/` — independent git repo, never run git/npm from monorepo root
- ESM only — no `require()` in `src/`
- No new npm dependencies — esbuild is already a devDependency, import as `import { build } from 'esbuild'`
- Do not modify `compileFile` — it remains unchanged for relative/virtual/`@plugin`/`@project` imports
- `platform: 'browser'` in all esbuild calls — prevents node built-ins leaking into bundles
- Test packages live in `scratch/semver-import-test/.crunes/node_modules/` (semver = CJS, axios = ESM)

---

### Task 1: `resolvePackageEntry` — exports field resolution

**Files:**
- Modify: `src/rune/isolation/resolver.js` (lines 109–117)
- Test: `test/rune/isolation/resolver.test.js`

**Interfaces:**
- Produces: `resolvePackageEntry(pkgJson, pkgDir)` — pure sync function, returns absolute path string

- [ ] **Step 1: Write failing tests**

Append this describe block to `test/rune/isolation/resolver.test.js`:

```js
import { join } from 'node:path'
// add to existing imports at top if not already there

describe('resolvePackageEntry', () => {
  // We need to test the pure function directly — import it
  // It will be exported from resolver.js
  let resolvePackageEntry
  beforeEach(async () => {
    const mod = await import('../../../src/rune/isolation/resolver.js')
    resolvePackageEntry = mod.resolvePackageEntry
  })

  const pkgDir = '/node_modules/mypkg'

  it('returns exports string shorthand (e.g. chalk)', () => {
    expect(resolvePackageEntry({ exports: './source/index.js' }, pkgDir))
      .toBe(join(pkgDir, './source/index.js'))
  })

  it('returns exports["."].import string', () => {
    expect(resolvePackageEntry({ exports: { '.': { import: './dist/esm.js' } } }, pkgDir))
      .toBe(join(pkgDir, './dist/esm.js'))
  })

  it('returns exports["."].import.default when import is an object', () => {
    expect(resolvePackageEntry({ exports: { '.': { import: { default: './src/fxp.js' } } } }, pkgDir))
      .toBe(join(pkgDir, './src/fxp.js'))
  })

  it('returns exports["."].node when import is absent', () => {
    expect(resolvePackageEntry({ exports: { '.': { node: './dist/index.js' } } }, pkgDir))
      .toBe(join(pkgDir, './dist/index.js'))
  })

  it('returns exports["."].default when import and node are absent', () => {
    expect(resolvePackageEntry({ exports: { '.': { default: './dist/default.js' } } }, pkgDir))
      .toBe(join(pkgDir, './dist/default.js'))
  })

  it('falls back to main when exports is absent', () => {
    expect(resolvePackageEntry({ main: 'index.js' }, pkgDir))
      .toBe(join(pkgDir, 'index.js'))
  })

  it('falls back to index.js when both exports and main are absent', () => {
    expect(resolvePackageEntry({}, pkgDir))
      .toBe(join(pkgDir, 'index.js'))
  })

  it('prefers exports over main', () => {
    expect(resolvePackageEntry({ exports: './esm.js', main: './cjs.js' }, pkgDir))
      .toBe(join(pkgDir, './esm.js'))
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd crunes-cli
npx vitest run test/rune/isolation/resolver.test.js
```

Expected: 8 new tests FAIL with `resolvePackageEntry is not a function` or `cannot destructure`.

- [ ] **Step 3: Add `resolvePackageEntry` to `resolver.js`**

Add after the `import` statements at the top of `src/rune/isolation/resolver.js` (after line 4, before the JSDoc comment):

```js
export function resolvePackageEntry(pkgJson, pkgDir) {
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

- [ ] **Step 4: Wire `resolvePackageEntry` into the npm resolution block**

In `src/rune/isolation/resolver.js`, replace lines 110–117 (the npm entry resolution + `compileFile` call):

**Before:**
```js
      const pkgDir = path.join(pluginNodeModules, specifier)
      const pkgJsonPath = path.join(pkgDir, 'package.json')
      let entry = 'index.js'
      try {
        const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, 'utf8'))
        entry = pkgJson.main ?? 'index.js'
      } catch { /* package.json missing or unreadable — fall back to index.js */ }
      return compileFile(specifier, path.join(pkgDir, entry))
```

**After:**
```js
      const pkgDir = path.join(pluginNodeModules, specifier)
      const pkgJsonPath = path.join(pkgDir, 'package.json')
      let absEntry
      try {
        const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, 'utf8'))
        absEntry = resolvePackageEntry(pkgJson, pkgDir)
      } catch { absEntry = path.join(pkgDir, 'index.js') }
      return compileNpmPackage(specifier, absEntry)
```

Note: `compileNpmPackage` doesn't exist yet — it will be added in Task 2. For now this will break at runtime but tests only cover `resolvePackageEntry` directly so they will pass.

- [ ] **Step 5: Run tests — verify they pass**

```bash
cd crunes-cli
npx vitest run test/rune/isolation/resolver.test.js
```

Expected: all 8 new tests PASS. Existing tests still pass (they mock `compileModule` so the missing `compileNpmPackage` doesn't matter in unit tests).

- [ ] **Step 6: Commit**

```bash
cd crunes-cli
git add src/rune/isolation/resolver.js test/rune/isolation/resolver.test.js
git commit -m "feat(resolver): add resolvePackageEntry with exports field support"
```

---

### Task 2: `bundleNpmPackage` + `compileNpmPackage` — CJS/ESM bundling

**Files:**
- Modify: `src/rune/isolation/resolver.js` (add two functions, used from Step 3)
- Test: `test/rune/isolation/resolver.test.js`

**Interfaces:**
- Consumes: `resolvePackageEntry` from Task 1
- Consumes: real packages from `scratch/semver-import-test/.crunes/node_modules/` for integration tests
- Produces: `bundleNpmPackage(absEntryPath)` — `async (string) => { bundleText: string, namedKeys: string[] }`
- Produces: `compileNpmPackage(specifier, absEntryPath)` — `async (string, string) => ivm.Module` (uses `isolate` and `cache` from closure)

**Context:** `bundleNpmPackage` is a module-level async function (not inside `createModuleResolver`) because it only needs esbuild and ivm — no isolate closure needed. `compileNpmPackage` IS inside `createModuleResolver` because it needs `isolate`, `cache`, and `moduleFilenames`.

- [ ] **Step 1: Write failing integration tests**

Append this describe block to `test/rune/isolation/resolver.test.js`.

These tests use real packages from `scratch/semver-import-test/.crunes/node_modules/` and a real ivm isolate — no mocking.

```js
import ivm from 'isolated-vm'

describe('bundleNpmPackage', () => {
  let bundleNpmPackage
  beforeEach(async () => {
    const mod = await import('../../../src/rune/isolation/resolver.js')
    bundleNpmPackage = mod.bundleNpmPackage
  })

  const NM = new URL(
    '../../../scratch/semver-import-test/.crunes/node_modules/',
    import.meta.url
  ).pathname.replace(/^\/([A-Z]:)/, '$1') // fix Windows drive letter

  it('bundles a CJS package and returns default + named keys', async () => {
    const { bundleText, namedKeys } = await bundleNpmPackage(join(NM, 'semver/index.js'))
    expect(bundleText).toContain('export default')
    expect(namedKeys).toContain('gt')
    expect(namedKeys).toContain('parse')
    expect(namedKeys).toContain('satisfies')
  })

  it('CJS bundle text contains named re-exports', async () => {
    const { bundleText } = await bundleNpmPackage(join(NM, 'semver/index.js'))
    expect(bundleText).toContain('export const {')
  })

  it('bundles an ESM package and returns named keys from metafile', async () => {
    const { bundleText, namedKeys } = await bundleNpmPackage(join(NM, 'axios/index.js'))
    expect(namedKeys).toContain('default')
    expect(namedKeys.length).toBeGreaterThan(1)
    // ESM bundle does not use __commonJS wrapper
    expect(bundleText).not.toContain('__commonJS')
  })

  it('returns empty namedKeys gracefully when CJS has no __commonJS wrapper', async () => {
    // Write a minimal ESM-shaped file that esbuild treats as ESM with only default
    // Simulate by passing a path to a tiny CJS file
    const { writeFile, mkdtemp, rm } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const tmp = await mkdtemp(join(tmpdir(), 'crunes-bundle-test-'))
    try {
      await writeFile(join(tmp, 'pkg.js'), 'module.exports = 42')
      // This produces __commonJS — so namedKeys will be ['42'] which is invalid JS identifier
      // The real test: probe doesn't crash on unexpected export shapes
      const { namedKeys } = await bundleNpmPackage(join(tmp, 'pkg.js'))
      expect(Array.isArray(namedKeys)).toBe(true)
    } finally {
      await rm(tmp, { recursive: true, force: true })
    }
  })
})

describe('createModuleResolver — npm package imports (integration)', () => {
  let iso, ctx

  const NM = new URL(
    '../../../scratch/semver-import-test/.crunes/node_modules/',
    import.meta.url
  ).pathname.replace(/^\/([A-Z]:)/, '$1')

  beforeEach(async () => {
    iso = new ivm.Isolate({ memoryLimit: 128 })
    ctx = await iso.createContext()
  })
  afterEach(() => { if (!iso.isDisposed) iso.dispose() })

  it('resolves semver (CJS) and named exports are accessible', async () => {
    const { resolve } = createModuleResolver(
      iso, NM, NM, null, ['module:semver'], [], null, null
    )
    const mod = await resolve('semver', null)
    await mod.instantiate(ctx, () => { throw new Error('no deps') })
    await mod.evaluate()
    const ns = mod.namespace
    const gt = await ns.get('gt', { copy: true })
    expect(typeof gt).toBe('object') // ivm.Reference for a function
  })

  it('resolves axios (ESM) and named exports are accessible', async () => {
    const { resolve } = createModuleResolver(
      iso, NM, NM, null, ['module:axios'], [], null, null
    )
    const mod = await resolve('axios', null)
    await mod.instantiate(ctx, () => { throw new Error('no deps') })
    await mod.evaluate()
    const ns = mod.namespace
    const axiosDefault = await ns.get('default', { copy: true })
    expect(axiosDefault).toBeDefined()
  })

  it('caches npm module — compileModule called once for two resolves', async () => {
    const compileSpy = vi.spyOn(iso, 'compileModule')
    const { resolve } = createModuleResolver(
      iso, NM, NM, null, ['module:semver'], [], null, null
    )
    await resolve('semver', null)
    await resolve('semver', null)
    // bundleNpmPackage calls iso.compileModule once for the final bundle
    const semverCalls = compileSpy.mock.calls.filter(c => c[0].includes('export default'))
    expect(semverCalls.length).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd crunes-cli
npx vitest run test/rune/isolation/resolver.test.js
```

Expected: new tests FAIL with `bundleNpmPackage is not a function` and `compileNpmPackage is not defined`.

- [ ] **Step 3: Add `bundleNpmPackage` to `resolver.js`**

Add this import at the top of `src/rune/isolation/resolver.js` (after the existing imports):

```js
import { build } from 'esbuild'
import ivm from 'isolated-vm'
```

Then add `bundleNpmPackage` as a module-level export after `resolvePackageEntry`:

```js
export async function bundleNpmPackage(absEntryPath) {
  const result = await build({
    entryPoints: [absEntryPath],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    write: false,
    metafile: true,
  })

  const bundleText = result.outputFiles[0].text
  const outputKey = Object.keys(result.metafile.outputs)[0]
  const exportedNames = result.metafile.outputs[outputKey].exports

  // ESM package — esbuild already emitted correct named exports
  if (exportedNames.length !== 1 || exportedNames[0] !== 'default') {
    return { bundleText, namedKeys: exportedNames }
  }

  // CJS package — only 'default' in metafile. Probe in throwaway isolate to get keys.
  const wrapperMatch = [...bundleText.matchAll(/var (require_\w+) = __commonJS/g)].pop()
  if (!wrapperMatch) return { bundleText, namedKeys: [] }

  const wrapperName = wrapperMatch[1]
  const probeText = bundleText + `\nconst __k = JSON.stringify(Object.keys(${wrapperName}()));\nexport { __k };`

  let namedKeys = []
  const probeIso = new ivm.Isolate({ memoryLimit: 32 })
  try {
    const probeCtx = await probeIso.createContext()
    const probeMod = await probeIso.compileModule(probeText, { filename: 'probe.js' })
    await probeMod.instantiate(probeCtx, () => { throw new Error('unexpected import') })
    await probeMod.evaluate()
    namedKeys = JSON.parse(await probeMod.namespace.get('__k', { copy: true }))
  } catch { /* probe failed — fall back to default-only */ } finally {
    probeIso.dispose()
  }

  const finalText = bundleText + `\nexport const { ${namedKeys.join(', ')} } = ${wrapperName}();\n`
  return { bundleText: finalText, namedKeys }
}
```

- [ ] **Step 4: Add `compileNpmPackage` inside `createModuleResolver`**

Inside `createModuleResolver`, add `compileNpmPackage` after the existing `compileFile` function (after line 28):

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

- [ ] **Step 5: Run tests — verify they pass**

```bash
cd crunes-cli
npx vitest run test/rune/isolation/resolver.test.js
```

Expected: all tests PASS.

- [ ] **Step 6: Run full test suite**

```bash
cd crunes-cli
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 7: Manual smoke test with the scratch rune**

```bash
cd crunes-cli
npm run build
node dist/cli.js --cwd "../scratch/semver-import-test" run test-semver
```

The rune at `scratch/semver-import-test/.crunes/runes/test-semver.js` currently contains:
```js
import { section } from '@utils'
import { gt } from 'semver'

const result = gt('1.2.3', '1.2.2')
section('semver result', `gt('1.2.3', '1.2.2') = ${result}`)
```

Expected output:
```
semver result
gt('1.2.3', '1.2.2') = true
```

- [ ] **Step 8: Commit**

```bash
cd crunes-cli
git add src/rune/isolation/resolver.js test/rune/isolation/resolver.test.js
git commit -m "feat(resolver): bundle npm packages via esbuild with sandboxed CJS named export extraction"
```

---

## Self-Review

**Spec coverage:**
- ✅ `exports` field resolution — `resolvePackageEntry` in Task 1, all 7 real-world shapes covered in tests
- ✅ CJS bundling via esbuild — `bundleNpmPackage` in Task 2
- ✅ Sandboxed key extraction — throwaway `ivm.Isolate` in `bundleNpmPackage`
- ✅ Named re-exports appended — `export const { ... } = wrapperName()` at end of bundle
- ✅ ESM packages — metafile exports path, no probe needed
- ✅ In-memory cache — `compileNpmPackage` uses existing `cache` Map
- ✅ `compileFile` unchanged — still used for relative/virtual/`@plugin`/`@project` paths
- ✅ `platform: 'browser'` — specified in all esbuild calls
- ✅ Error fallbacks — probe catch → empty `namedKeys`, missing `package.json` → `index.js`

**Placeholder scan:** None found.

**Type consistency:** `bundleNpmPackage(absEntryPath)` → `{ bundleText, namedKeys }` used consistently in Task 2 steps 3 and 4. `compileNpmPackage(specifier, absEntryPath)` called from Task 1 step 4's wired-in replacement — names match.
