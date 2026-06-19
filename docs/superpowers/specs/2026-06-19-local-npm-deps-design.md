# Local NPM Dependencies for Local Runes — Design Spec

Brainstormed 2026-06-19.

---

## Goal

Allow local runes (`.crunes/runes/*.js`) to import npm packages by declaring them in `config.dependencies` and installing them into `.crunes/node_modules`. The user owns `npm install`; crunes just reads what's there.

---

## Architecture

Two-line change in the local rune dispatch path. The module resolver (`src/rune/isolation/resolver.js`) already handles npm imports via the `pluginDeps` + `nodeModulesDir` dual-gate — local runes currently pass `{}` and `null` for these, so npm imports silently fail. The fix is to thread `config.dependencies` as `pluginDeps` and `.crunes/node_modules` as `nodeModulesDir` into both the `run` and `repl` dispatch calls.

**Files touched:**
- `src/rune/resolver.js` — thread `nodeModulesDir` and `pluginDeps` into local rune dispatch (both `runRune` and `resolveRuneEntry`)

No new files. No changes to the module resolver, config loader, or permission system.

---

## Config Schema

`dependencies` is a new optional top-level field in `.crunes/config.json`:

```json
{
  "dependencies": {
    "semver": "^7.8.4",
    "lodash-es": "^4.17.21"
  },
  "runes": { ... }
}
```

Same shape as `package.json` `dependencies`. Values are version strings (informational only — crunes never installs packages). `config.local.json` can also declare `dependencies`; the local file wins per-key (standard `mergeConfigs` top-level primitive behavior).

---

## Permission Gate

Same dual-gate as plugin runes — **both** conditions must be true for an import to succeed:

1. `module:<pkg>` must appear in the rune's `permissions.run.allow` (or `permissions.repl.allow` for REPL)
2. `<pkg>` must be a key in `config.dependencies`

```json
{
  "dependencies": { "semver": "^7.8.4" },
  "runes": {
    "version-check": {
      "permissions": {
        "run": { "allow": ["module:semver"] }
      }
    }
  }
}
```

No change to `createModuleResolver` — the existing `isAllowed && isDeclared` check at line 109 already enforces this.

---

## Runtime Dispatch

### `runRune` (run lifecycle) — `src/rune/resolver.js:155`

Before:
```js
const result = await runRuneInIsolate(fullPath, effective, args, dir, {
  runeCallback,
  sections: opts.sections ?? null,
  vars: entry.vars ?? {},
  lifecycle: 'run',
  runeKey: key,
  onEvent: opts.onEvent ?? null,
  instanceId,
})
```

After:
```js
const result = await runRuneInIsolate(fullPath, effective, args, dir, {
  runeCallback,
  sections: opts.sections ?? null,
  vars: entry.vars ?? {},
  lifecycle: 'run',
  runeKey: key,
  onEvent: opts.onEvent ?? null,
  instanceId,
  nodeModulesDir: join(configDir, '.crunes', 'node_modules'),
  pluginDeps: config.dependencies ?? {},
})
```

### `resolveRuneEntry` (repl lifecycle) — `src/rune/resolver.js:218`

Before:
```js
return runRuneInRepl(runeFile, effective, args, projectDir, {
  vars,
  runeKey: key,
  onEvent: opts.onEvent ?? null,
  instanceId: opts.instanceId ?? '1',
})
```

After:
```js
return runRuneInRepl(runeFile, effective, args, projectDir, {
  vars,
  runeKey: key,
  onEvent: opts.onEvent ?? null,
  instanceId: opts.instanceId ?? '1',
  nodeModulesDir: join(configDir, '.crunes', 'node_modules'),
  pluginDeps: config.dependencies ?? {},
})
```

`configDir` in `resolveRuneEntry` is the fourth parameter (defaults to `projectDir`) — same variable already used on line 214 to resolve `runeFile`.

---

## Error Behavior

When a local rune imports a package not in `config.dependencies` or missing `module:pkg` from its allow list, the existing error message fires:

> `PermissionError: 'semver' is not available.`  
> `Add "module:semver" to allow in permissions and "semver" to dependencies.`

The word "dependencies" in that message already matches the config field name — no message update needed.

When a package is declared in `config.dependencies` and permitted, but `.crunes/node_modules/<pkg>` does not exist on disk (user forgot to run `npm install`), the error is a Node.js `ENOENT` from `fs.readFile` inside `compileFile`. This is acceptable — the message clearly points to the missing path.

---

## User Workflow

```bash
# 1. Declare the package
# .crunes/config.json → add "dependencies": { "semver": "^7.8.4" }

# 2. Install it
cd .crunes && npm init -y && npm install semver

# 3. Permit it in the rune entry
# config.json → runes["my-rune"].permissions.run.allow += "module:semver"

# 4. Import it in the rune
import { gt } from 'semver'
```

---

## Out of Scope

- Auto-installing packages — user owns `npm install`
- Validating version strings in `config.dependencies`
- Sub-dependency resolution (transitive deps) — handled by npm at install time; crunes just reads the top-level entry point
- `package.json` / `exports` field resolution — the resolver reads `package.json#main` only (same as plugin behavior today)
