# semver Namespace — Design Spec

Brainstormed 2026-06-19.

---

## Goal

Add a `semver` namespace exposing pure semantic versioning logic — parse, compare, bump, satisfy ranges — with no file I/O. Covers the full SemVer 2.0.0 spec including pre-release precedence and range expressions.

---

## Architecture

Pure sync namespace, identical pattern to `codec`: logic is inlined directly in `utils-bootstrap.js` (no `ivm.Reference` / host bridge needed). The `semver` npm package is added as a devDependency and bundled by esbuild into `dist/cli.js` — same as `jsonpath-plus`, `yaml`, `fast-xml-parser`.

**Files touched:**
- `crunes-cli/package.json` — add `semver` devDependency
- `crunes-cli/src/rune/api/semver.js` — thin re-exports wrapping the `semver` package (host-side, for testing)
- `crunes-cli/src/rune/isolation/utils-bootstrap.js` — inline `semver` namespace using `import semverLib from 'semver'`
- `crunes-cli/src/rune/api/types-utils/semver.d.ts` — type declarations
- `crunes-cli/src/rune/api/index.js` — export the namespace (check how codec is registered)
- `crunes-cli/test/rune/api/semver.test.js` — unit tests against `semver.js`
- Export line in `utils-bootstrap.js` — add `semver` to the destructure

---

## API

```ts
declare namespace semver {
  type ReleaseType = 'major' | 'minor' | 'patch' | 'premajor' | 'preminor' | 'prepatch' | 'prerelease'

  interface SemVer {
    major: number
    minor: number
    patch: number
    prerelease: ReadonlyArray<string | number>
    build: ReadonlyArray<string>
    version: string
  }

  /** Parses a version string. Returns null if invalid. */
  function parse(version: string): SemVer | null

  /** Compares two versions. Returns -1, 0, or 1. */
  function compare(a: string, b: string): -1 | 0 | 1

  function gt(a: string, b: string): boolean
  function lt(a: string, b: string): boolean
  function gte(a: string, b: string): boolean
  function lte(a: string, b: string): boolean
  function eq(a: string, b: string): boolean
  function neq(a: string, b: string): boolean

  /** Returns true if `version` satisfies the range expression. */
  function satisfies(version: string, range: string): boolean

  /** Returns the highest version in `versions` that satisfies `range`, or null. */
  function maxSatisfying(versions: string[], range: string): string | null

  /** Returns the lowest version in `versions` that satisfies `range`, or null. */
  function minSatisfying(versions: string[], range: string): string | null

  /**
   * Increments a version by the given release type.
   * `identifier` is used for pre-release tags (e.g. 'alpha').
   * Returns null if the version is invalid.
   */
  function bump(version: string, release: ReleaseType, identifier?: string): string | null

  /** Sorts versions ascending (lowest first). Returns a new array. */
  function sort(versions: string[]): string[]

  /** Sorts versions descending (highest first). Returns a new array. */
  function rsort(versions: string[]): string[]
}
```

---

## Bootstrap wiring

`utils-bootstrap.js` imports `semver` at the top of the file (alongside other bundled libs) and exposes it as a plain object:

```js
import semverLib from 'semver'

// ...inside globalThis.utils = { ... }
semver: {
  parse:         (v)       => semverLib.parse(v),
  compare:       (a, b)    => semverLib.compare(a, b),
  gt:            (a, b)    => semverLib.gt(a, b),
  lt:            (a, b)    => semverLib.lt(a, b),
  gte:           (a, b)    => semverLib.gte(a, b),
  lte:           (a, b)    => semverLib.lte(a, b),
  eq:            (a, b)    => semverLib.eq(a, b),
  neq:           (a, b)    => semverLib.neq(a, b),
  satisfies:     (v, r)    => semverLib.satisfies(v, r),
  maxSatisfying: (vs, r)   => semverLib.maxSatisfying(vs, r),
  minSatisfying: (vs, r)   => semverLib.minSatisfying(vs, r),
  bump:          (v, rel, id) => semverLib.inc(v, rel, id ?? undefined),
  sort:          (vs)      => semverLib.sort([...vs]),
  rsort:         (vs)      => semverLib.rsort([...vs]),
},
```

`parse` returns a live `SemVer` object from the semver package — its properties (`major`, `minor`, `patch`, `prerelease`, `build`, `version`) are plain values that survive the ivm copy boundary without special handling.

---

## semver.js (host-side)

Thin wrappers for testability — mirrors the bootstrap wiring exactly:

```js
import semverLib from 'semver'

export const parse         = (v)          => semverLib.parse(v)
export const compare       = (a, b)       => semverLib.compare(a, b)
export const gt            = (a, b)       => semverLib.gt(a, b)
export const lt            = (a, b)       => semverLib.lt(a, b)
export const gte           = (a, b)       => semverLib.gte(a, b)
export const lte           = (a, b)       => semverLib.lte(a, b)
export const eq            = (a, b)       => semverLib.eq(a, b)
export const neq           = (a, b)       => semverLib.neq(a, b)
export const satisfies     = (v, r)       => semverLib.satisfies(v, r)
export const maxSatisfying = (vs, r)      => semverLib.maxSatisfying(vs, r)
export const minSatisfying = (vs, r)      => semverLib.minSatisfying(vs, r)
export const bump          = (v, rel, id) => semverLib.inc(v, rel, id ?? undefined)
export const sort          = (vs)         => semverLib.sort([...vs])
export const rsort         = (vs)         => semverLib.rsort([...vs])
```

---

## Tests

`test/rune/api/semver.test.js` — imports from `src/rune/api/semver.js`:

- `parse` — valid version returns object with correct major/minor/patch/prerelease; invalid returns null
- `compare` — ordering of 1.0.0, 1.0.1, 2.0.0
- `gt` / `lt` / `gte` / `lte` / `eq` / `neq` — spot checks
- `satisfies` — `^1.0.0`, `>=1.2 <2`, pre-release exclusion
- `maxSatisfying` / `minSatisfying` — picks correct version from list
- `bump` — major/minor/patch/prerelease increments; invalid input returns null
- `sort` / `rsort` — order preserved, original array not mutated

---

## Out of Scope

- Range intersection / union (`semver.intersects`) — not in the approved API
- `semver.diff` (returns release type between two versions) — not requested
- Any file I/O (version extraction from package.json belongs in rune code via `json.readPath`)
