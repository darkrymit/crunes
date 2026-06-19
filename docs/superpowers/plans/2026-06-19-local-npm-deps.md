# Local NPM Dependencies for Local Runes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let local runes import npm packages declared in `config.dependencies` and installed into `.crunes/node_modules`.

**Architecture:** Two call sites in `src/rune/resolver.js` currently pass no `pluginDeps`/`nodeModulesDir` to the isolate runner — the module resolver already enforces the dual-gate (`isAllowed && isDeclared`) but has nothing to gate against. The fix is to thread `config.dependencies ?? {}` as `pluginDeps` and `<configDir>/.crunes/node_modules` as `nodeModulesDir` into both the `run` (`runRune`) and `repl` (`resolveRuneEntry`) local rune dispatch calls.

**Tech Stack:** Node.js ESM, isolated-vm, vitest

## Global Constraints

- All commands run inside `crunes-cli/` (independent git repo — never run git or npm from monorepo root)
- ESM only — no `require()`
- No new files — only `src/rune/resolver.js` and `test/rune/resolver.test.js` are touched
- Do not modify `createModuleResolver` — the dual-gate is already correct
- Do not add `dependencies` validation to `validateConfig` — pass-through is intentional

---

### Task 1: Thread `pluginDeps` and `nodeModulesDir` into local rune dispatch

**Files:**
- Modify: `src/rune/resolver.js` (lines 158–166 and 219–224)
- Test: `test/rune/resolver.test.js`

**Interfaces:**
- Consumes: `config.dependencies` (plain object `{ [pkgName]: versionString }`, may be absent)
- Consumes: `configDir` (string, already available at both call sites)
- Produces: `runRuneInIsolate` and `runRuneInRepl` called with `pluginDeps` and `nodeModulesDir` set for local runes

- [ ] **Step 1: Write the failing tests**

Add these three `describe` blocks to `test/rune/resolver.test.js` (append after the existing `runRune — configDir` block). The existing mock at the top of the file already intercepts `runRuneInIsolate` — no setup changes needed.

```js
describe('runRune — pluginDeps from config.dependencies', () => {
  beforeEach(() => vi.clearAllMocks())

  it('passes config.dependencies as pluginDeps when present', async () => {
    const config = {
      runes: { hello: { path: 'runes/hello.js' } },
      dependencies: { semver: '^7.8.4' },
    }
    await runRune('/project', config, 'hello', [])
    const opts = runRuneInIsolate.mock.calls[0][4]
    expect(opts.pluginDeps).toEqual({ semver: '^7.8.4' })
  })

  it('passes empty object as pluginDeps when config.dependencies is absent', async () => {
    const config = { runes: { hello: { path: 'runes/hello.js' } } }
    await runRune('/project', config, 'hello', [])
    const opts = runRuneInIsolate.mock.calls[0][4]
    expect(opts.pluginDeps).toEqual({})
  })

  it('passes <configDir>/.crunes/node_modules as nodeModulesDir', async () => {
    const config = { runes: { hello: { path: 'runes/hello.js' } } }
    await runRune('/project', config, 'hello', [])
    const opts = runRuneInIsolate.mock.calls[0][4]
    expect(opts.nodeModulesDir).toBe(join('/project', '.crunes', 'node_modules'))
  })

  it('nodeModulesDir uses configDir when provided', async () => {
    const config = { runes: { hello: { path: 'runes/hello.js' } } }
    await runRune('/project', config, 'hello', [], { configDir: '/config' })
    const opts = runRuneInIsolate.mock.calls[0][4]
    expect(opts.nodeModulesDir).toBe(join('/config', '.crunes', 'node_modules'))
  })
})
```

- [ ] **Step 2: Run the tests — verify they fail**

```bash
cd crunes-cli
npx vitest run test/rune/resolver.test.js
```

Expected: 4 new tests FAIL (`opts.pluginDeps` is undefined, `opts.nodeModulesDir` is undefined).

- [ ] **Step 3: Implement — update `runRune` (run lifecycle)**

In `src/rune/resolver.js`, find the local rune dispatch block (around line 158). Replace:

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

With:

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

- [ ] **Step 4: Implement — update `resolveRuneEntry` (repl lifecycle)**

In `src/rune/resolver.js`, find the local config rune branch inside `resolveRuneEntry` (around line 219). Replace:

```js
      createReplSession(args, opts = {}) {
        return runRuneInRepl(runeFile, effective, args, projectDir, {
          vars,
          runeKey: key,
          onEvent: opts.onEvent ?? null,
          instanceId: opts.instanceId ?? '1',
        })
      }
```

With:

```js
      createReplSession(args, opts = {}) {
        return runRuneInRepl(runeFile, effective, args, projectDir, {
          vars,
          runeKey: key,
          onEvent: opts.onEvent ?? null,
          instanceId: opts.instanceId ?? '1',
          nodeModulesDir: join(configDir, '.crunes', 'node_modules'),
          pluginDeps: config.dependencies ?? {},
        })
      }
```

Note: `configDir` is the fourth parameter of `resolveRuneEntry` (defaults to `projectDir`) — it is already in scope at this line.

- [ ] **Step 5: Run all tests — verify they pass**

```bash
cd crunes-cli
npx vitest run
```

Expected: all tests PASS, including the 4 new ones.

- [ ] **Step 6: Commit**

```bash
cd crunes-cli
git add src/rune/resolver.js test/rune/resolver.test.js
git commit -m "feat(resolver): thread config.dependencies into local rune dispatch"
```

---

## Self-Review

**Spec coverage:**
- ✅ `config.dependencies` as top-level field → read via `config.dependencies ?? {}`, passed as `pluginDeps`
- ✅ `.crunes/node_modules` as `nodeModulesDir` → `join(configDir, '.crunes', 'node_modules')`
- ✅ Dual-gate (permission + declared dep) → no change needed, module resolver already enforces it
- ✅ Both `run` and `repl` lifecycles updated
- ✅ `config.local.json` merging → handled by existing `mergeConfigs` (top-level key passthrough)
- ✅ No validation added to `validateConfig` — intentional
- ✅ Error messages unchanged — existing message already says "dependencies"

**Placeholder scan:** None found.

**Type consistency:** `pluginDeps` and `nodeModulesDir` names match `runRuneInIsolate` and `runRuneInRepl` parameter names exactly (confirmed from runner.js lines 1266–1267 and 1470–1471).
