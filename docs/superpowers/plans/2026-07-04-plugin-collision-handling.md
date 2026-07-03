# Plugin/Rune Collision Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop bare (non-marketplace-qualified) plugin/rune references from producing false ambiguity errors or silent no-ops when two different marketplaces ship a same-named plugin, while giving genuine collisions clear, actionable errors.

**Architecture:** A new project-scoped resolution helper in `registry.js` replaces the global-registry-only ambiguity check used by `run`/`repl`/alias/`disable`. Ambiguity error messages everywhere switch to always showing full `marketplace@name[:rune]` forms. A new hard `validateConfig` check catches plugin-rune override keys that can structurally never work. `docs rune <key>` gains plugin-rune support via the same resolution path. Docs are corrected and extended to match.

**Tech Stack:** Node.js ESM, vitest.

## Global Constraints

- All work happens inside `crunes-cli/` — independent git repository; all git operations run there.
- Never run `npm test`/build scripts from the monorepo root.
- TDD mandatory: write the failing test, watch it fail, then write minimal code to pass.
- `crunes plugin enable`/`update`/`uninstall` are unchanged — their global-registry ambiguity check is already correct (they're "pick among everything installed" operations with no project scope).
- No bare-key fallback for `config.runes` plugin-rune overrides — always require the fully-qualified `marketplace@plugin:rune` key. This is a documented/validated requirement, not a resolver behavior change.
- No new CLI command for creating `entry.plugin` aliases — out of scope per the design.

---

### Task 1: `resolvePluginKeyScoped` in `registry.js`

**Files:**
- Modify: `crunes-cli/src/plugin/registry.js`
- Create: `crunes-cli/test/plugin/registry.test.js`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `resolvePluginKeyScoped(nameOrKey, registry, enabledPlugins)` — exported function.
  Returns a full `marketplace@name` string or `null`; throws `Error` on ambiguity or on
  zero-enabled-but-installed-elsewhere. Consumed by Task 2.

- [ ] **Step 1: Write the failing tests**

Create `crunes-cli/test/plugin/registry.test.js`:

```javascript
import { describe, it, expect } from 'vitest'
import { resolvePluginKeyScoped } from '../../src/plugin/registry.js'

const registry = {
  plugins: {
    'crunes-plugins@git': { path: '/a' },
    'my-org@git': { path: '/b' },
    'other@docker': { path: '/c' },
  }
}

describe('resolvePluginKeyScoped', () => {
  it('returns the key unchanged when already fully qualified', () => {
    expect(resolvePluginKeyScoped('my-org@git', registry, [])).toBe('my-org@git')
  })

  it('resolves silently when exactly one scoped match is enabled', () => {
    expect(resolvePluginKeyScoped('git', registry, ['my-org@git'])).toBe('my-org@git')
  })

  it('resolves silently even though a same-named plugin exists globally but is not enabled here', () => {
    expect(resolvePluginKeyScoped('git', registry, ['my-org@git'])).toBe('my-org@git')
    // crunes-plugins@git exists in the registry but is NOT in enabledPlugins — must not affect resolution
  })

  it('throws ambiguous with full keys when 2+ scoped matches are enabled', () => {
    expect(() => resolvePluginKeyScoped('git', registry, ['my-org@git', 'crunes-plugins@git']))
      .toThrow('Ambiguous plugin "git". Use the full key: crunes-plugins@git, my-org@git')
  })

  it('throws a "not enabled" error naming the real candidate when 0 scoped matches exist but 1+ global matches do', () => {
    expect(() => resolvePluginKeyScoped('git', registry, []))
      .toThrow('Plugin "git" is not enabled in this project (installed as crunes-plugins@git, my-org@git). Run: crunes plugin enable <one of the above>')
  })

  it('returns null when there are zero matches anywhere', () => {
    expect(resolvePluginKeyScoped('nonexistent', registry, [])).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd crunes-cli && npx vitest run test/plugin/registry.test.js`
Expected: FAIL — `resolvePluginKeyScoped` is not exported from `registry.js` yet.

- [ ] **Step 3: Implement `resolvePluginKeyScoped`**

In `crunes-cli/src/plugin/registry.js`, add this new export (after the existing
`resolvePluginKey` function, leave `resolvePluginKey` itself completely unchanged since
`enable`/`update`/`uninstall` still use it):

```javascript
/**
 * Resolves a bare plugin name scoped to the project's enabled plugins first.
 * A fully-qualified "marketplace@plugin" key is returned unchanged.
 * Throws if 2+ enabled plugins share the bare name, or if the name isn't
 * enabled in this project but exists globally (names the real candidates).
 * Returns null if the name doesn't exist anywhere.
 */
export function resolvePluginKeyScoped(nameOrKey, registry, enabledPlugins) {
  if (nameOrKey.includes('@')) return nameOrKey

  const allMatches = Object.keys(registry.plugins ?? {})
    .filter(k => k.slice(k.indexOf('@') + 1) === nameOrKey)
  const scopedMatches = allMatches.filter(k => enabledPlugins.includes(k))

  if (scopedMatches.length === 1) return scopedMatches[0]

  if (scopedMatches.length > 1) {
    throw new Error(`Ambiguous plugin "${nameOrKey}". Use the full key: ${scopedMatches.join(', ')}`)
  }

  if (allMatches.length === 0) return null

  throw new Error(
    `Plugin "${nameOrKey}" is not enabled in this project (installed as ${allMatches.join(', ')}). ` +
    `Run: crunes plugin enable ${allMatches.length === 1 ? allMatches[0] : '<one of the above>'}`
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd crunes-cli && npx vitest run test/plugin/registry.test.js`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Run full test suite**

Run: `cd crunes-cli && npm test`
Expected: all pass (this is a pure addition, nothing else references this function yet).

- [ ] **Step 6: Commit**

```bash
cd crunes-cli
git add src/plugin/registry.js test/plugin/registry.test.js
git commit -m "feat(registry): add project-scoped plugin key resolution"
```

---

### Task 2: Wire `resolvePluginRune` to the scoped resolver

**Files:**
- Modify: `crunes-cli/src/rune/resolver.js:1-4,18-44`
- Modify: `crunes-cli/test/rune/resolver.test.js`

**Interfaces:**
- Consumes: `resolvePluginKeyScoped(nameOrKey, registry, enabledPlugins)` from Task 1.
- Produces: `resolvePluginRune` now resolves bare plugin names scoped to `config.plugins`. Consumed
  by Task 8 (`docs rune` reuses `resolvePluginRune` unchanged in its new call site).

- [ ] **Step 1: Update the failing tests**

In `crunes-cli/test/rune/resolver.test.js`, the mock of `registry.js` currently mocks
`resolvePluginKey` — switch it to mock `resolvePluginKeyScoped` instead, and update the two
existing plugin-override tests to mock the new function name. Replace lines 8-11 and lines 139 and
173's comment/mock:

```javascript
vi.mock('../../src/plugin/registry.js', () => ({
  loadRegistry: vi.fn().mockResolvedValue({ plugins: {} }),
  resolvePluginKeyScoped: vi.fn().mockReturnValue(null),
}))
```

```javascript
import { loadRegistry, resolvePluginKeyScoped } from '../../src/plugin/registry.js'
```

In the `describe('runRune — plugin rune permission/vars override via runes["plugin:rune"]', ...)`
block, replace `resolvePluginKey.mockReturnValue('my-plugin')` (line 139) with
`resolvePluginKeyScoped.mockReturnValue('my-plugin')`.

Then add a new test proving the scoping fix itself, in the same describe block:

```javascript
  it('resolves a bare plugin:rune key correctly even when a same-named plugin is installed but not enabled elsewhere', async () => {
    resolvePluginKeyScoped.mockImplementation((name, registry, enabledPlugins) => {
      // Simulate registry.js's real scoping logic for this one test, proving resolver.js
      // passes config.plugins through as enabledPlugins correctly.
      if (name === 'my-plugin' && enabledPlugins.includes('my-org@my-plugin')) return 'my-org@my-plugin'
      throw new Error('scoping not applied correctly')
    })
    loadRegistry.mockResolvedValue({
      plugins: { 'my-org@my-plugin': { path: '/plugins/my-plugin', cacheDir: '/plugins/my-plugin' } }
    })
    loadPluginJson.mockResolvedValue({
      name: 'my-org@my-plugin',
      version: '1.0.0',
      runes: { deploy: { permissions: {}, vars: {} } }
    })

    const config = { plugins: ['my-org@my-plugin'], runes: {} }
    await runRune('/project', config, 'my-plugin:deploy', [])

    expect(executePluginRune).toHaveBeenCalled()
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd crunes-cli && npx vitest run test/rune/resolver.test.js`
Expected: FAIL — `resolvePluginKeyScoped` is not exported yet by the mock target being called (the
real `resolver.js` still imports and calls `resolvePluginKey`, so the mocked
`resolvePluginKeyScoped` is never invoked and the new test's `mockImplementation` never fires,
causing `executePluginRune` to not be called as expected).

- [ ] **Step 3: Implement the resolver.js change**

In `crunes-cli/src/rune/resolver.js`, replace line 2:

```javascript
import { loadRegistry, resolvePluginKey } from '../plugin/registry.js'
```

with:

```javascript
import { loadRegistry, resolvePluginKeyScoped } from '../plugin/registry.js'
```

Replace line 35:

```javascript
  const pluginKey = resolvePluginKey(pluginPart, registry)
```

with:

```javascript
  const pluginKey = resolvePluginKeyScoped(pluginPart, registry, enabledPlugins)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd crunes-cli && npx vitest run test/rune/resolver.test.js`
Expected: PASS — all tests in this file green, including the new scoping test.

- [ ] **Step 5: Run full test suite**

Run: `cd crunes-cli && npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
cd crunes-cli
git add src/rune/resolver.js test/rune/resolver.test.js
git commit -m "fix(resolver): scope bare plugin name resolution to the project's enabled plugins"
```

---

### Task 3: Narrower resolution for `crunes plugin disable`

**Files:**
- Modify: `crunes-cli/src/plugin/commands/disable.js`
- Modify: `crunes-cli/test/plugin/commands/enable-disable.test.js`

**Interfaces:**
- Consumes: nothing from other tasks (independent, self-contained helper).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing test**

In `crunes-cli/test/plugin/commands/enable-disable.test.js`, the global `beforeEach` currently
mocks `resolvePluginKey` for both handlers. Since `disable` will stop calling `resolvePluginKey`
entirely (it never touches the registry now), update the mock module declaration (lines 6-9) to
keep `resolvePluginKey` for `enable` but recognize `disable` no longer needs it mocked:

```javascript
vi.mock('../../../src/plugin/registry.js', () => ({
  loadRegistry: vi.fn(),
  resolvePluginKey: vi.fn(),
}))
```

(unchanged — `enable` still needs this mock). Add a new describe block at the end of the file:

```javascript
describe('disable handler — scoped resolution, no global registry lookup', () => {
  it('resolves a bare name using only config.plugins, ignoring a same-named globally-installed-but-not-enabled plugin', async () => {
    const tmp1 = await mkdtemp(join(tmpdir(), 'crunes-disable-scoped-'))
    await mkdir(join(tmp1, '.crunes'), { recursive: true })
    await writeFile(
      join(tmp1, '.crunes', 'config.json'),
      JSON.stringify({ plugins: ['my-org@git'] }, null, 2)
    )

    // loadRegistry mock (from the outer beforeEach) would normally report crunes-plugins@git too,
    // but disable must not need to consult it at all — this succeeds using only config.plugins.
    await disableHandler({ name: 'git', projectRoot: tmp1, configRoot: tmp1 })

    const written = JSON.parse(await import('node:fs/promises').then(fs => fs.readFile(join(tmp1, '.crunes', 'config.json'), 'utf8')))
    expect(written.plugins).not.toContain('my-org@git')

    await rm(tmp1, { recursive: true, force: true })
  })

  it('throws ambiguous with full keys when config.plugins itself has two matches', async () => {
    const tmp2 = await mkdtemp(join(tmpdir(), 'crunes-disable-ambiguous-'))
    await mkdir(join(tmp2, '.crunes'), { recursive: true })
    await writeFile(
      join(tmp2, '.crunes', 'config.json'),
      JSON.stringify({ plugins: ['my-org@git', 'crunes-plugins@git'] }, null, 2)
    )
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await disableHandler({ name: 'git', projectRoot: tmp2, configRoot: tmp2 })

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Ambiguous plugin "git". Use the full key: my-org@git, crunes-plugins@git'))
    expect(exitSpy).toHaveBeenCalledWith(1)

    exitSpy.mockRestore()
    errorSpy.mockRestore()
    await rm(tmp2, { recursive: true, force: true })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd crunes-cli && npx vitest run test/plugin/commands/enable-disable.test.js`
Expected: FAIL — `disable.js` still calls `resolvePluginKey(name, registry)` against the (mocked,
global) registry, which in the test's outer `beforeEach` mock returns `'official@myplugin'`
regardless of `name`, so the two new scoped-behavior tests fail (wrong plugin key resolved / no
ambiguous error thrown).

- [ ] **Step 3: Implement the disable.js change**

Replace the full content of `crunes-cli/src/plugin/commands/disable.js`:

```javascript
import fs from 'node:fs/promises'
import path from 'node:path'

function resolveEnabledPluginKey(nameOrKey, enabledPlugins) {
  if (nameOrKey.includes('@')) return nameOrKey
  const matches = enabledPlugins.filter(k => k.slice(k.indexOf('@') + 1) === nameOrKey)
  if (matches.length > 1) {
    throw new Error(`Ambiguous plugin "${nameOrKey}". Use the full key: ${matches.join(', ')}`)
  }
  return matches[0] ?? null
}

export async function handler({ name, projectRoot, configRoot }) {
  const configPath = path.join(configRoot ?? projectRoot, '.crunes', 'config.json')

  let config
  try {
    config = JSON.parse(await fs.readFile(configPath, 'utf8'))
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error('Error: No .crunes/config.json found. Run: crunes init')
    } else {
      console.error(`Error: ${err.message}`)
    }
    process.exit(1)
  }

  const enabledPlugins = config.plugins ?? []

  let pluginKey
  try {
    pluginKey = resolveEnabledPluginKey(name, enabledPlugins)
    if (!pluginKey) throw new Error(`Plugin "${name}" is not enabled in this project.`)
  } catch (err) {
    console.error(`Error: ${err.message}`)
    process.exit(1)
  }

  config.plugins = enabledPlugins.filter(p => p !== pluginKey)
  const tmp = configPath + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(config, null, 2), 'utf8')
  await fs.rename(tmp, configPath)
  console.log(`Plugin "${pluginKey}" disabled.`)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd crunes-cli && npx vitest run test/plugin/commands/enable-disable.test.js`
Expected: PASS — all tests in this file green, including the pre-existing "disable handler —
configRoot" test (that one uses a real registry mock returning `'official@myplugin'`, but since
the pre-seeded `config.json` in that test lists `official@myplugin` directly in `config.plugins`
and the handler is called with `name: 'myplugin'`, `resolveEnabledPluginKey('myplugin',
['official@git', 'official@myplugin'])` correctly matches the bare suffix `myplugin` against
`official@myplugin` and resolves it — no registry needed).

- [ ] **Step 5: Run full test suite**

Run: `cd crunes-cli && npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
cd crunes-cli
git add src/plugin/commands/disable.js test/plugin/commands/enable-disable.test.js
git commit -m "fix(plugin/disable): resolve bare plugin names against config.plugins only, not the global registry"
```

---

### Task 4: Ambiguity error message fix in `resolveRuneFromPlugins`

**Files:**
- Modify: `crunes-cli/src/rune/resolver.js:46-69`
- Modify: `crunes-cli/test/rune/resolver.test.js`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `resolveRuneFromPlugins` becomes exported (needed by Task 8). Its ambiguity error now
  lists full `marketplace@name:rune` forms.

- [ ] **Step 1: Write the failing test**

Add to `crunes-cli/test/rune/resolver.test.js`, a new describe block:

```javascript
describe('resolveRuneFromPlugins — ambiguity message shows full keys', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists full marketplace@name:rune forms, not bare names or a placeholder', async () => {
    loadRegistry.mockResolvedValue({
      plugins: {
        'sole-market@git': { path: '/plugins/git', cacheDir: '/plugins/git' },
        'other-market@docker-tools': { path: '/plugins/docker', cacheDir: '/plugins/docker' },
      }
    })
    loadPluginJson.mockImplementation(async (dir) => {
      if (dir === '/plugins/git') return { name: 'git', version: '1.0.0', runes: { info: {} } }
      if (dir === '/plugins/docker') return { name: 'docker-tools', version: '1.0.0', runes: { info: {} } }
      throw new Error('unexpected dir')
    })

    const config = { plugins: ['sole-market@git', 'other-market@docker-tools'], runes: {} }

    await expect(runRune('/project', config, 'info', [])).rejects.toThrow(
      '"info" matches runes in multiple plugins: sole-market@git, other-market@docker-tools. ' +
      'Use sole-market@git:info or other-market@docker-tools:info to specify one.'
    )
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd crunes-cli && npx vitest run test/rune/resolver.test.js`
Expected: FAIL — the current message is `"info" matches runes in multiple plugins: git,
docker-tools. Use plugin:info to specify one.` (bare names, unfilled placeholder).

- [ ] **Step 3: Implement the message fix and export**

In `crunes-cli/src/rune/resolver.js`, replace lines 46-69:

```javascript
async function resolveRuneFromPlugins(config, runeKey) {
  const enabledPlugins = config.plugins ?? []
  if (enabledPlugins.length === 0) return null

  let registry
  try { registry = await loadRegistry() } catch { return null }

  const matches = []
  for (const pluginKey of enabledPlugins) {
    const entry = registry.plugins?.[pluginKey]
    if (!entry) continue
    let pluginJson
    try { pluginJson = await loadPluginJson(entry.path) } catch { continue }
    if ((pluginJson.runes ?? {})[runeKey]) {
      matches.push({ pluginKey, runeKey, pluginDir: entry.path, pluginCacheDir: entry.cacheDir ?? entry.path, pluginJson })
    }
  }

  if (matches.length > 1) {
    const names = matches.map(m => m.pluginKey).join(', ')
    const options = matches.map(m => `${m.pluginKey}:${runeKey}`).join(' or ')
    throw new Error(`"${runeKey}" matches runes in multiple plugins: ${names}. Use ${options} to specify one.`)
  }
  return matches[0] ?? null
}
```

with:

```javascript
export async function resolveRuneFromPlugins(config, runeKey) {
  const enabledPlugins = config.plugins ?? []
  if (enabledPlugins.length === 0) return null

  let registry
  try { registry = await loadRegistry() } catch { return null }

  const matches = []
  for (const pluginKey of enabledPlugins) {
    const entry = registry.plugins?.[pluginKey]
    if (!entry) continue
    let pluginJson
    try { pluginJson = await loadPluginJson(entry.path) } catch { continue }
    if ((pluginJson.runes ?? {})[runeKey]) {
      matches.push({ pluginKey, runeKey, pluginDir: entry.path, pluginCacheDir: entry.cacheDir ?? entry.path, pluginJson })
    }
  }

  if (matches.length > 1) {
    const names = matches.map(m => m.pluginKey).join(', ')
    const options = matches.map(m => `${m.pluginKey}:${runeKey}`).join(' or ')
    throw new Error(`"${runeKey}" matches runes in multiple plugins: ${names}. Use ${options} to specify one.`)
  }
  return matches[0] ?? null
}
```

(Only change: `matches.map(m => m.pluginKey.slice(...))` → `matches.map(m => m.pluginKey)` in the
message, the new `options` line, and adding `export` to the function declaration.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd crunes-cli && npx vitest run test/rune/resolver.test.js`
Expected: PASS — all tests in this file green.

- [ ] **Step 5: Run full test suite**

Run: `cd crunes-cli && npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
cd crunes-cli
git add src/rune/resolver.js test/rune/resolver.test.js
git commit -m "fix(resolver): show full marketplace@name:rune forms in the multi-plugin-rune ambiguity error"
```

---

### Task 5: Ambiguity error message fix in `template apply`

**Files:**
- Modify: `crunes-cli/src/template/commands/apply.js:29-53`
- Modify: `crunes-cli/test/template/apply.test.js`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing test**

Add to `crunes-cli/test/template/apply.test.js`, a new describe block:

```javascript
describe('resolveTemplate — ambiguity message shows full keys', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists full marketplace@name:template forms, not bare names or a placeholder', async () => {
    vi.mocked(loadRegistry).mockResolvedValue({
      plugins: {
        'sole-market@git': { path: '/plugins/git' },
        'other-market@docker-tools': { path: '/plugins/docker' },
      }
    })
    vi.mocked(loadPluginJson).mockImplementation(async (dir) => {
      if (dir === '/plugins/git') return { templates: { info: { name: 'Git Info' } } }
      if (dir === '/plugins/docker') return { templates: { info: { name: 'Docker Info' } } }
      throw new Error('unexpected dir')
    })

    const { output } = await import('../../src/shared/output.js')
    const errorSpy = vi.spyOn(output, 'error').mockImplementation(() => {})
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {})

    await resolveTemplate(null, 'info', '/project')

    expect(errorSpy).toHaveBeenCalledWith(
      '"info" matches templates in multiple sources: sole-market@git, other-market@docker-tools. ' +
      'Use sole-market@git:info or other-market@docker-tools:info.'
    )
    expect(exitSpy).toHaveBeenCalledWith(1)

    errorSpy.mockRestore()
    exitSpy.mockRestore()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd crunes-cli && npx vitest run test/template/apply.test.js`
Expected: FAIL — the current message uses `matches.map(m => m.pluginName)` (bare, stripped names)
and has no "Use X or Y" full-form suggestion.

- [ ] **Step 3: Implement the fix**

In `crunes-cli/src/template/commands/apply.js`, replace lines 29-53 (the `resolveTemplate`
function's plugin-template-matching block):

```javascript
  // Check plugin templates
  const registry = await loadRegistry()
  const matches = []
  for (const [pluginKey, pluginEntry] of Object.entries(registry.plugins ?? {})) {
    const pluginName = pluginKey.slice(pluginKey.indexOf('@') + 1)
    // sourceName can be bare name or full marketplace@plugin key
    if (sourceName && sourceName !== pluginName && sourceName !== pluginKey) continue
    if (!pluginEntry.path) continue
    let pluginJson
    try { pluginJson = await loadPluginJson(pluginEntry.path) } catch { continue }
    const templateMeta = (pluginJson.templates ?? {})[templateName]
    if (templateMeta) {
      matches.push({ pluginName, pluginEntry, pluginJson, templateMeta })
    }
  }

  if (matches.length > 1) {
    const sources = matches.map(m => m.pluginName).join(', ')
    output.error(`"${templateName}" matches templates in multiple sources: ${sources}. Use source:${templateName}.`)
    process.exit(1)
  }
  if (matches.length === 1) {
    return { type: 'plugin', templateName, ...matches[0] }
  }

  return null
```

with:

```javascript
  // Check plugin templates
  const registry = await loadRegistry()
  const matches = []
  for (const [pluginKey, pluginEntry] of Object.entries(registry.plugins ?? {})) {
    const pluginName = pluginKey.slice(pluginKey.indexOf('@') + 1)
    // sourceName can be bare name or full marketplace@plugin key
    if (sourceName && sourceName !== pluginName && sourceName !== pluginKey) continue
    if (!pluginEntry.path) continue
    let pluginJson
    try { pluginJson = await loadPluginJson(pluginEntry.path) } catch { continue }
    const templateMeta = (pluginJson.templates ?? {})[templateName]
    if (templateMeta) {
      matches.push({ pluginKey, pluginName, pluginEntry, pluginJson, templateMeta })
    }
  }

  if (matches.length > 1) {
    const sources = matches.map(m => m.pluginKey).join(', ')
    const options = matches.map(m => `${m.pluginKey}:${templateName}`).join(' or ')
    output.error(`"${templateName}" matches templates in multiple sources: ${sources}. Use ${options}.`)
    process.exit(1)
  }
  if (matches.length === 1) {
    return { type: 'plugin', templateName, ...matches[0] }
  }

  return null
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd crunes-cli && npx vitest run test/template/apply.test.js`
Expected: PASS — all tests in this file green, including the pre-existing plugin-template tests
(they only assert on `result.type`/`result.templateMeta.path`, unaffected by the added `pluginKey`
field on match objects).

- [ ] **Step 5: Run full test suite**

Run: `cd crunes-cli && npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
cd crunes-cli
git add src/template/commands/apply.js test/template/apply.test.js
git commit -m "fix(template/apply): show full marketplace@name:template forms in the multi-source ambiguity error"
```

---

### Task 6: Hard validation error for structurally-dead override keys

**Files:**
- Modify: `crunes-cli/src/core/config.js`
- Modify: `crunes-cli/test/core/config.test.js`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing tests**

Add to `crunes-cli/test/core/config.test.js`, inside the `describe('validateConfig', ...)` block
(after the existing three tests, before the closing `})` at line 36):

```javascript
  it('throws on a plugin-rune override key missing the marketplace prefix', () => {
    const config = {
      runes: {
        'git:status': { vars: { region: 'us-east-1' } }
      }
    }
    expect(() => validateConfig(config)).toThrow(
      'config.json: runes["git:status"] has no path or plugin, so it can only be a plugin-rune ' +
      'override — but "git" is missing the marketplace prefix. Use the full ' +
      '"marketplace@plugin:status" form.'
    )
  })

  it('does not throw on a fully-qualified plugin-rune override key', () => {
    const config = {
      runes: {
        'my-org@git:status': { vars: { region: 'us-east-1' } }
      }
    }
    expect(() => validateConfig(config)).not.toThrow()
  })

  it('does not throw on a local rune entry whose key happens to contain a colon, if it has a path', () => {
    const config = {
      runes: {
        'weird:name': { path: '.crunes/runes/weird-name.js' }
      }
    }
    expect(() => validateConfig(config)).not.toThrow()
  })

  it('does not throw on a plugin alias entry whose key contains a colon', () => {
    const config = {
      runes: {
        'my-alias:thing': { plugin: 'my-org@git:status' }
      }
    }
    expect(() => validateConfig(config)).not.toThrow()
  })

  it('does not throw on an ordinary local rune key with no colon at all', () => {
    const config = {
      runes: {
        myrune: { path: '.crunes/runes/myrune.js' }
      }
    }
    expect(() => validateConfig(config)).not.toThrow()
  })
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `cd crunes-cli && npx vitest run test/core/config.test.js`
Expected: FAIL — the first new test ("throws on a plugin-rune override key missing the marketplace
prefix") fails because `validateConfig` currently has no such check at all.

- [ ] **Step 3: Implement the validation check**

In `crunes-cli/src/core/config.js`, add this block inside `validateConfig`, immediately after the
existing `if (config.runes && typeof config.runes === 'object') { for (const [runeKey, entry] of
Object.entries(config.runes)) {` loop's existing `entry.permissions` check (i.e., add a new `if`
inside the same `for` loop body, alongside the existing permissions-shape check):

```javascript
export function validateConfig(config, fileName = 'config.json') {
  if (config.runes && typeof config.runes === 'object') {
    for (const [runeKey, entry] of Object.entries(config.runes)) {
      if (entry && typeof entry === 'object' && entry.permissions) {
        const perms = entry.permissions
        if (Array.isArray(perms)) {
          throw new Error(`${fileName}: runes["${runeKey}"].permissions must be lifecycle-scoped (e.g. permissions.run.allow)`)
        }
        if (perms && typeof perms === 'object') {
          if (Array.isArray(perms.allow) || Array.isArray(perms.deny)) {
            throw new Error(`${fileName}: runes["${runeKey}"].permissions must be lifecycle-scoped (e.g. permissions.run.allow)`)
          }
          if (perms.run && typeof perms.run === 'object' && Object.keys(perms.run).length === 0) {
            console.warn(`[crunes:warn] ${fileName}: runes["${runeKey}"].permissions.run is empty. No extra permissions will be granted.`)
          }
        }
      }

      if (entry && typeof entry === 'object' && !entry.path && !entry.plugin) {
        const colonIdx = runeKey.indexOf(':')
        if (colonIdx !== -1) {
          const pluginPart = runeKey.slice(0, colonIdx)
          if (!pluginPart.includes('@')) {
            throw new Error(
              `${fileName}: runes["${runeKey}"] has no path or plugin, so it can only be a plugin-rune ` +
              `override — but "${pluginPart}" is missing the marketplace prefix. Use the full ` +
              `"marketplace@plugin:${runeKey.slice(colonIdx + 1)}" form.`
            )
          }
        }
      }
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd crunes-cli && npx vitest run test/core/config.test.js`
Expected: PASS — all tests in this file green, including all 5 new ones and every pre-existing
test (none of them use a no-path/no-plugin colon-containing key without a marketplace prefix).

- [ ] **Step 5: Run full test suite**

Run: `cd crunes-cli && npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
cd crunes-cli
git add src/core/config.js test/core/config.test.js
git commit -m "fix(config): hard-error on plugin-rune override keys that can never resolve"
```

---

### Task 7: Documentation — correct existing example, add CLI form and alias guidance

**Files:**
- Modify: `crunes-cli/src/docs/intro-compiler.js:313-330`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Fix the existing incorrect example and add the new content**

In `crunes-cli/src/docs/intro-compiler.js`, replace lines 313-330:

```javascript
  lines.push('To grant a **plugin** rune extra permissions or vars from the project side (plugin runes have no `runes.<key>` entry of their own), add an entry keyed by the fully-qualified `"pluginName:runeKey"` string:')
  lines.push('```json')
  lines.push('{')
  lines.push('  "plugins": ["my-plugin"],')
  lines.push('  "runes": {')
  lines.push('    "my-plugin:deploy": {')
  lines.push('      "vars": { "region": "us-east-1" },')
  lines.push('      "permissions": {')
  lines.push('        "run": { "allow": ["fs.read:src/**"] }')
  lines.push('      }')
  lines.push('    }')
  lines.push('  }')
  lines.push('}')
  lines.push('```')
  lines.push('')
  lines.push('### Config File Fields Reference')
  lines.push('- **`runes`**: Definition of project-registered runes, keyed by rune key (or `"pluginName:runeKey"` for a plugin-rune override). Each entry may declare `path`, `name`, `description`, `vars` (key-value settings read via `utils.vars.read(key)`), and `permissions` (lifecycle-scoped allow/deny lists).')
  lines.push('- **`plugins`**: List of enabled third-party marketplaces or plugins.')
  lines.push('')
```

with:

```javascript
  lines.push('To grant a **plugin** rune extra permissions or vars from the project side (plugin runes have no `runes.<key>` entry of their own), add an entry keyed by the fully-qualified `"marketplace@plugin:runeKey"` string — **this must always be the full form, never the bare plugin name**, since two enabled plugins could share a bare name and a bare-form key can never resolve to anything (config loading rejects a bare-form key outright).')
  lines.push('```json')
  lines.push('{')
  lines.push('  "plugins": ["my-market@my-plugin"],')
  lines.push('  "runes": {')
  lines.push('    "my-market@my-plugin:deploy": {')
  lines.push('      "vars": { "region": "us-east-1" },')
  lines.push('      "permissions": {')
  lines.push('        "run": { "allow": ["fs.read:src/**"] }')
  lines.push('      }')
  lines.push('    }')
  lines.push('  }')
  lines.push('}')
  lines.push('```')
  lines.push('')
  lines.push('### Disambiguating Same-Named Plugins')
  lines.push('If two enabled plugins from different marketplaces happen to share a bare name, `crunes run <name>:<rune>` (and `repl`, and `docs rune`) needs the fully-qualified `marketplace@plugin:rune` form to pick one — e.g. `crunes run my-org@git:status` instead of the ambiguous `crunes run git:status`. An ambiguity error always lists the full keys to use.')
  lines.push('')
  lines.push('A rune entry can also give a specific plugin rune its own project-local name and `vars`/`permissions` preset, by aliasing to it directly — useful any time you want a memorable name for one particular configuration of a plugin rune (e.g. `deploy-staging` and `deploy-prod` both aliasing the same underlying rune with different `vars`). Disambiguating a same-named collision permanently is one example use of this:')
  lines.push('```json')
  lines.push('{')
  lines.push('  "runes": {')
  lines.push('    "git": { "plugin": "my-org@git:status" }')
  lines.push('  }')
  lines.push('}')
  lines.push('```')
  lines.push('Now `crunes run git` always resolves to that specific plugin rune, with no ambiguity, regardless of what else is enabled.')
  lines.push('')
  lines.push('### Config File Fields Reference')
  lines.push('- **`runes`**: Definition of project-registered runes, keyed by rune key (or the fully-qualified `"marketplace@plugin:runeKey"` string for a plugin-rune override — never a bare plugin name). Each entry may declare `path`, `name`, `description`, `vars` (key-value settings read via `utils.vars.read(key)`), `permissions` (lifecycle-scoped allow/deny lists), or `plugin` (an alias to a specific plugin rune, see above).')
  lines.push('- **`plugins`**: List of enabled third-party marketplaces or plugins.')
  lines.push('')
```

- [ ] **Step 2: Rebuild and verify**

Run:
```bash
cd crunes-cli
npm run build
node dist/cli.js -p docs intro
```
Expected: section 3 shows the corrected fully-qualified example (`"my-market@my-plugin:deploy"`,
not the old bare `"my-plugin:deploy"`), the new "Disambiguating Same-Named Plugins" subsection with
both the CLI form and the `entry.plugin` alias example, and the updated Config File Fields
Reference bullet.

- [ ] **Step 3: Run the existing intro-compiler test**

Run: `cd crunes-cli && npx vitest run test/docs/intro-compiler.test.js`
Expected: PASS — this test only asserts section headers exist, unaffected by this content change.

- [ ] **Step 4: Run full test suite**

Run: `cd crunes-cli && npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
cd crunes-cli
git add src/docs/intro-compiler.js
git commit -m "docs(intro): fix bare plugin-rune override example, document marketplace@plugin:rune disambiguation and the plugin alias mechanism"
```

---

### Task 8: `docs rune <key>` plugin-rune support

**Files:**
- Modify: `crunes-cli/src/docs/commands/rune.js`
- Modify: `crunes-cli/test/docs/commands/rune.test.js`

**Interfaces:**
- Consumes: `resolvePluginRune` (Task 2's scoped resolution, already exported from
  `resolver.js`), `resolveRuneFromPlugins` (now exported per Task 4), `getPluginRunePath` (already
  exported from `isolation/runner.js`), `loadPluginJson` (already exported from
  `plugin/manifest.js`).
- Produces: nothing consumed by later tasks — last task in this plan.

- [ ] **Step 1: Write the failing tests**

Add to `crunes-cli/test/docs/commands/rune.test.js`, first add mocks at the top of the file
(before the existing `describe('help rune handler', ...)` block) — this changes the file from
pure-filesystem testing to also supporting mocked plugin resolution for the new tests only, so add
the mocks but leave every existing test's local-rune behavior untouched (the mocks only affect
calls that actually reach `resolvePluginRune`/`resolveRuneFromPlugins`, which none of the existing
tests trigger):

```javascript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'node:path'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'

vi.mock('../../../src/plugin/registry.js', () => ({
  loadRegistry: vi.fn().mockResolvedValue({ plugins: {} }),
  resolvePluginKeyScoped: vi.fn().mockReturnValue(null),
}))
vi.mock('../../../src/plugin/manifest.js', () => ({
  loadPluginJson: vi.fn(),
}))

import { handler } from '../../../src/docs/commands/rune.js'
import { loadRegistry, resolvePluginKeyScoped } from '../../../src/plugin/registry.js'
import { loadPluginJson } from '../../../src/plugin/manifest.js'
```

Then add a new describe block at the end of the file:

```javascript
describe('help rune handler — plugin runes', () => {
  let tmp
  let written

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'crunes-help-plugin-'))
    await mkdir(join(tmp, '.crunes'), { recursive: true })
    written = []
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => { written.push(chunk); return true })
    vi.clearAllMocks()
    loadRegistry.mockResolvedValue({ plugins: {} })
    resolvePluginKeyScoped.mockReturnValue(null)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await rm(tmp, { recursive: true, force: true })
  })

  it('resolves a fully-qualified plugin:rune key and renders its help', async () => {
    await writeFile(join(tmp, '.crunes', 'config.json'), JSON.stringify({
      runes: {}, plugins: ['my-org@git']
    }))
    resolvePluginKeyScoped.mockReturnValue('my-org@git')
    loadRegistry.mockResolvedValue({
      plugins: { 'my-org@git': { path: '/plugins/git', cacheDir: '/plugins/git' } }
    })
    loadPluginJson.mockResolvedValue({
      name: 'git', version: '1.0.0',
      runes: { status: { name: 'Git Status', description: 'Shows status', permissions: {} } }
    })

    await handler({ keys: ['my-org@git:status'], projectRoot: tmp, configRoot: tmp })
    const out = written.join('')
    expect(out).toContain('Shows status')
  })

  it('auto-discovers a bare rune key from an enabled plugin when no local entry exists', async () => {
    await writeFile(join(tmp, '.crunes', 'config.json'), JSON.stringify({
      runes: {}, plugins: ['my-org@git']
    }))
    loadRegistry.mockResolvedValue({
      plugins: { 'my-org@git': { path: '/plugins/git', cacheDir: '/plugins/git' } }
    })
    loadPluginJson.mockResolvedValue({
      name: 'git', version: '1.0.0',
      runes: { status: { name: 'Git Status', description: 'Shows status', permissions: {} } }
    })

    await handler({ keys: ['status'], projectRoot: tmp, configRoot: tmp })
    const out = written.join('')
    expect(out).toContain('Shows status')
  })

  it('an ambiguous bare rune key surfaces the resolver error instead of "Unknown rune"', async () => {
    await writeFile(join(tmp, '.crunes', 'config.json'), JSON.stringify({
      runes: {}, plugins: ['sole-market@git', 'other-market@docker-tools']
    }))
    loadRegistry.mockResolvedValue({
      plugins: {
        'sole-market@git': { path: '/plugins/git', cacheDir: '/plugins/git' },
        'other-market@docker-tools': { path: '/plugins/docker', cacheDir: '/plugins/docker' },
      }
    })
    loadPluginJson.mockImplementation(async (dir) => {
      if (dir === '/plugins/git') return { name: 'git', version: '1.0.0', runes: { info: {} } }
      if (dir === '/plugins/docker') return { name: 'docker-tools', version: '1.0.0', runes: { info: {} } }
      throw new Error('unexpected dir')
    })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {})

    await handler({ keys: ['info'], projectRoot: tmp, configRoot: tmp })

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('"info" matches runes in multiple plugins: sole-market@git, other-market@docker-tools'))
    expect(exitSpy).toHaveBeenCalledWith(1)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd crunes-cli && npx vitest run test/docs/commands/rune.test.js`
Expected: FAIL — `docs/commands/rune.js` has no plugin-resolution path yet, so all three new tests
produce "Unknown rune" warnings instead of rendering plugin rune help.

- [ ] **Step 3: Implement the docs rune plugin support**

Replace the full content of `crunes-cli/src/docs/commands/rune.js`:

```javascript
import { join, relative } from 'node:path'
import { loadConfig } from '../../core/config.js'
import { getRune, resolvePluginRune, resolveRuneFromPlugins } from '../../rune/resolver.js'
import { getArgsSchema, getReplSchema, getPluginRunePath } from '../../rune/isolation/runner.js'
import { loadPluginJson } from '../../plugin/manifest.js'
import { formatHelp } from '../formatter.js'
import { computeEffectivePermissions } from '../../rune/permissions/permissions.js'
import { output } from '../../shared/output.js'

const SUGGESTIONS = {
  run: 'crunes docs run',
  args: 'crunes docs args',
  intro: 'crunes docs intro',
  utils: 'crunes docs utils',
  globals: 'crunes docs globals',
}

function formatSlashCommands(commands, indent = '') {
  const lines = [`${indent}REPL Slash Commands:`]
  for (const cmd of commands) {
    lines.push(`${indent}  /${cmd.name.padEnd(12)} ${cmd.description ?? ''}`)
    for (const pos of (cmd.positionals ?? [])) {
      lines.push(`${indent}               ${pos.spec.padEnd(14)} ${pos.description ?? ''}`)
    }
    for (const opt of (cmd.options ?? [])) {
      lines.push(`${indent}               ${opt.flags.padEnd(14)} ${opt.description ?? ''}`)
    }
  }
  return lines.join('\n')
}

function formatBatch(batch) {
  const lines = ['Batch:']
  if (!batch) {
    lines.push('  (not permitted — no batch block declared)')
    return lines.join('\n')
  }
  const allow = batch.allow ?? []
  const deny  = batch.deny  ?? []
  lines.push(`  allow: ${allow.length ? allow.join(', ') : '(none)'}`)
  if (deny.length) lines.push(`  deny:  ${deny.join(', ')}`)
  return lines.join('\n')
}

export async function handler({ keys, format = 'text', projectRoot = process.cwd(), configRoot = projectRoot }) {
  let config
  try {
    config = loadConfig(configRoot)
  } catch (err) {
    output.error(`Config unreadable: ${err.message}`)
    process.exit(1)
  }

  const results = []
  let anyFailed = false

  for (const key of keys) {
    let pluginMatch
    try {
      pluginMatch = await resolvePluginRune(config, key)
    } catch (err) {
      output.warn(err.message)
      anyFailed = true
      continue
    }

    const localEntry = pluginMatch ? null : getRune(config, key)

    let autoMatch = null
    if (!pluginMatch && !localEntry) {
      try {
        autoMatch = await resolveRuneFromPlugins(config, key)
      } catch (err) {
        output.warn(err.message)
        anyFailed = true
        continue
      }
    }

    const resolved = pluginMatch ?? autoMatch

    if (!localEntry && !resolved) {
      if (SUGGESTIONS[key]) {
        output.warn(`Unknown rune: "${key}". (Tip: Did you mean "${SUGGESTIONS[key]}"?)`)
      } else {
        output.warn(`Unknown rune: "${key}"`)
      }
      anyFailed = true
      continue
    }

    let runeFile, relativePath, basePerms, vars, displayName, displayDescription, batch

    if (resolved) {
      const { runeKey, pluginDir } = resolved
      let pluginJson
      try {
        pluginJson = await loadPluginJson(pluginDir)
      } catch (err) {
        output.warn(`Could not load plugin for "${key}": ${err.message}`)
        anyFailed = true
        continue
      }
      const runeDef = pluginJson.runes[runeKey] ?? {}
      runeFile = getPluginRunePath(pluginDir, runeKey, pluginJson)
      relativePath = undefined
      basePerms = runeDef.permissions ?? { allow: [], deny: [] }
      vars = runeDef.vars ?? {}
      displayName = runeDef.name ?? runeKey
      displayDescription = runeDef.description ?? null
      batch = runeDef.batch != null ? { allow: runeDef.batch.allow ?? [], deny: runeDef.batch.deny ?? [] } : null
    } else {
      runeFile = join(configRoot, localEntry.path ?? `.crunes/runes/${key}.js`)
      relativePath = relative(projectRoot, runeFile).replace(/\\/g, '/')
      basePerms = localEntry.permissions ?? { allow: [], deny: [] }
      vars = localEntry.vars ?? {}
      displayName = localEntry.name ?? key
      displayDescription = localEntry.description ?? null
      batch = localEntry.batch != null ? { allow: localEntry.batch.allow ?? [], deny: localEntry.batch.deny ?? [] } : null
    }

    const runEffective  = computeEffectivePermissions(basePerms, undefined, 'run')
    const replEffective = computeEffectivePermissions(basePerms, undefined, 'repl')

    let schema = null
    try {
      schema = await getArgsSchema(runeFile, runEffective, projectRoot, { vars, runeKey: key })
    } catch (err) {
      output.warn(`Could not load args schema for "${key}": ${err.message}`)
    }

    let repl = null
    try {
      const { argsSchema, commandsSchema } = await getReplSchema(runeFile, replEffective, [], projectRoot, { vars, runeKey: key })
      if (argsSchema !== null || commandsSchema !== null) {
        repl = { argsSchema, commandsSchema }
      }
    } catch (err) {
      output.warn(`Could not load REPL schema for "${key}": ${err.message}`)
    }

    results.push({
      key,
      name: displayName,
      description: displayDescription,
      relativePath,
      schema,
      repl,
      batch,
    })
  }

  if (format === 'json') {
    process.stdout.write(JSON.stringify(results, null, 2) + '\n')
  } else {
    const blocks = []
    for (const r of results) {
      const parts = []
      parts.push(formatHelp(r.schema, { key: r.key, name: r.name, description: r.description, relativePath: r.relativePath }))
      if (r.repl?.argsSchema) {
        parts.push(formatHelp(r.repl.argsSchema, { key: r.key, name: r.name, description: r.description, relativePath: r.relativePath, lifecycle: 'repl' }))
      }
      if (r.repl?.commandsSchema?.commands?.length) {
        parts.push(formatSlashCommands(r.repl.commandsSchema.commands))
      }
      parts.push(formatBatch(r.batch))
      blocks.push(parts.join('\n\n'))
    }
    if (blocks.length > 0) process.stdout.write(blocks.join('\n\n') + '\n')
  }

  if (anyFailed) process.exit(1)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd crunes-cli && npx vitest run test/docs/commands/rune.test.js`
Expected: PASS — all tests in this file green, including the three new plugin-rune tests and every
pre-existing local-rune test (the mocks default to `loadRegistry` resolving to `{ plugins: {} }`
and `resolvePluginKeyScoped` returning `null`, so `resolvePluginRune` always returns `null` for
existing tests' plain local-rune keys, and `getRune`/local resolution takes over exactly as before).

- [ ] **Step 5: Run full test suite**

Run: `cd crunes-cli && npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
cd crunes-cli
git add src/docs/commands/rune.js test/docs/commands/rune.test.js
git commit -m "feat(docs/rune): support plugin-prefixed and auto-discovered plugin rune keys"
```

---

## Final Verification

After all 8 tasks are committed:

- [ ] Run `cd crunes-cli && npm test` — full suite green.
- [ ] Run `cd crunes-cli && npm run build && node dist/cli.js --help` — matches this project's
  CI-equivalent check.
- [ ] Manual re-verification of the exact empirical scratch-registry scenarios from the design's
  investigation (isolated `CRUNES_STORE`, two same-named plugins from different marketplaces, one
  enabled): confirm `crunes run <name>:<rune>`, `crunes plugin disable <name>`, and `crunes docs
  rune <name>:<rune>` now resolve correctly instead of falsely reporting ambiguity, and that a
  genuine two-enabled collision produces the corrected full-key error message.
- [ ] Run `node dist/cli.js -p docs intro` and manually confirm the corrected plugin-override
  example and new disambiguation/alias sections render as designed.
