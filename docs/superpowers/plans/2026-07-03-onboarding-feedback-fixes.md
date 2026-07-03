# Onboarding Feedback Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 8 documentation gaps in `crunes docs intro` / `crunes docs utils env` and remove an unintended dual config shape (top-level `permissions`/`vars` maps) from `crunes-cli`, replacing its one legitimate use (plugin-rune permission overrides) with the existing nested-entry convention.

**Architecture:** Two independent parts. Part A is static text/example edits to `src/docs/intro-compiler.js` and two `.d.ts` JSDoc blocks — no runtime behavior change. Part B removes two merge/read code paths in `src/core/config.js` and `src/rune/resolver.js`/`src/docs/commands/rune.js`, replacing the plugin-rune override mechanism with a `runes["pluginName:runeKey"]` config entry.

**Tech Stack:** Node.js ESM, vitest, typedoc (regenerates `docs/generated/*.json` from `.d.ts` sources via `npm run build`).

## Global Constraints

- All work happens inside `crunes-cli/` — it's an independent git repository; all git operations run there, never from the monorepo root.
- Never run `npm install`/`npm test`/build scripts from the monorepo root — always `cd crunes-cli` first.
- `dist/` is gitignored and never committed; it's rebuilt via `npm run build`.
- Strict ESM everywhere under `src/` — no `require()`.
- TDD is mandatory for Part B (a real behavior change): write the failing test, watch it fail, then write minimal code to pass.
- Part A is docs-only; per this project's testing philosophy ("test API contracts, not internals"), no new tests are required for Part A beyond confirming existing tests still pass, since `compileIntro()`'s existing tests assert structural section headers, not full content.
- Surgical changes only — don't touch unrelated code, comments, or formatting in files this plan edits.
- After any change to `src/rune/api/*.js`-adjacent surfaces, check `examples/` still works — already confirmed in the design spec that no example uses the top-level sibling-map shape, so no example changes are needed.
- Full local CI check before considering the branch done: `npm test && npm run build && node dist/cli.js --help`.

---

## Part A — Documentation Fixes (items 1, 2, 3, 4, 5, 7, 8, 9)

### Task 1: Fix the `env.read` permission doc to mention the bare-key form (item 5)

**Files:**
- Modify: `crunes-cli/src/rune/api/types-utils/env.d.ts:5` and `:13`

**Interfaces:**
- Consumes: nothing (pure doc string edit)
- Produces: nothing consumed by later tasks — independent of everything else in this plan

- [ ] **Step 1: Edit the `read()` JSDoc block**

In `crunes-cli/src/rune/api/types-utils/env.d.ts`, replace line 5:

```typescript
   * Requires `env.read:<source>::<key>` permission (where source is `process` or a .env filename like `.env`). `*` matches any characters in the key (e.g. `env.read:process::GITHUB_*`).
```

with:

```typescript
   * Requires `env.read:<key>` (matches the key from any source) or the source-scoped `env.read:<source>::<key>` (where source is `process` or a .env filename like `.env`) permission. `*` matches any characters in the key (e.g. `env.read:GITHUB_*` or `env.read:process::GITHUB_*`).
```

- [ ] **Step 2: Edit the `has()` JSDoc block**

Same file, replace line 13 (identical text to line 5) with the identical replacement text from Step 1.

- [ ] **Step 3: Rebuild and verify the generated docs reflect the change**

Run from `crunes-cli/`:
```bash
npm run build
node dist/cli.js -p docs utils env
```
Expected: output for both `read()` and `has()` shows the new two-form wording, no leftover `<source>::<key>` as the only documented form.

- [ ] **Step 4: Run full test suite**

```bash
npm test
```
Expected: all tests pass (this is a doc-comment-only change; typedoc source files aren't covered by vitest, so no test should reference this exact string).

- [ ] **Step 5: Commit**

```bash
git add src/rune/api/types-utils/env.d.ts
git commit -m "docs(env): document bare-key env.read permission form"
```

---

### Task 2: Rewrite `helpSection()`/`helpText()` JSDoc to state the full-tree-always behavior (item 2)

**Files:**
- Modify: `crunes-cli/src/rune/api/types-utils/rune.d.ts:6-10`

**Interfaces:**
- Consumes: nothing
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Edit the JSDoc comments**

In `crunes-cli/src/rune/api/types-utils/rune.d.ts`, replace lines 6-10:

```typescript
  /** Returns the formatted CLI help text for the current rune. Empty string if no args schema. */
  function helpText(): string

  /** Creates a markdown section containing the formatted CLI help text. */
  function helpSection(): RuneSection
```

with:

```typescript
  /** Returns the formatted CLI help text for the current rune. Empty string if no args schema. Always renders the full rune command tree (all subcommands, all options) — there is no way to scope this to just the matched subcommand. */
  function helpText(): string

  /** Creates a markdown section containing the formatted CLI help text. Always renders the full rune command tree (all subcommands, all options) — there is no way to scope this to just the matched subcommand. */
  function helpSection(): RuneSection
```

- [ ] **Step 2: Rebuild and verify**

```bash
npm run build
node dist/cli.js -p docs utils rune
```
Expected: `helpText()`/`helpSection()` entries in the output include the new "always renders the full rune command tree" sentence.

- [ ] **Step 3: Run full test suite**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/rune/api/types-utils/rune.d.ts
git commit -m "docs(rune): clarify helpSection/helpText always render the full command tree"
```

---

### Task 3: Fix the `shell` namespace recipe to use `{ throw: false }` + `result.ok` (item 3)

**Files:**
- Modify: `crunes-cli/src/docs/intro-compiler.js:126-139`

**Interfaces:**
- Consumes: nothing
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Replace the `shell` recipe string**

In `crunes-cli/src/docs/intro-compiler.js`, replace the `shell:` entry in `NAMESPACE_RECIPES` (lines 126-139):

```javascript
  shell: `\`\`\`javascript
import { shell, section } from '@utils'

export async function run() {
  // Run command relative to the project directory
  const stdout = await shell.exec('git status --short');
  return [
    section.create('git-status', {
      type: 'markdown',
      content: \`\\\`\\\`\\\`\\n\${stdout}\\n\\\`\\\`\\\`\`
    })
  ];
}
\`\`\``
```

with:

```javascript
  shell: `\`\`\`javascript
import { shell, section } from '@utils'

export async function run() {
  // Run command relative to the project directory.
  // { throw: false } returns { stdout, stderr, exitCode, ok } instead of throwing on a non-zero exit.
  const result = await shell.exec('git status --short', { throw: false });
  if (!result.ok) {
    return section.create('git-status', {
      type: 'markdown',
      content: \`Failed (exit \${result.exitCode}): \${result.stderr}\`
    });
  }
  return section.create('git-status', {
    type: 'markdown',
    content: \`\\\`\\\`\\\`\\n\${result.stdout}\\n\\\`\\\`\\\`\`
  });
}
\`\`\``
```

- [ ] **Step 2: Rebuild and verify**

```bash
npm run build
node dist/cli.js -p docs intro | grep -A 20 '### `shell`'
```
Expected: the printed recipe shows `shell.exec(..., { throw: false })` and a `result.ok` check, no bare `const stdout = await shell.exec(...)`.

- [ ] **Step 3: Run the existing intro-compiler test**

```bash
npx vitest run test/docs/intro-compiler.test.js
```
Expected: PASS — this test only asserts section headers exist (`## 1. Anatomy of a Rune`, etc.), not recipe content, so it isn't affected by this change.

- [ ] **Step 4: Run full test suite**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/docs/intro-compiler.js
git commit -m "docs(intro): fix shell.exec recipe to check result.ok instead of using it as a bare string"
```

---

### Task 4: Add `--help` handling and dynamic `args()` to the "Anatomy of a Rune" example, plus the CLI-conventions callout and `$command`/`$rest` note (items 1, 4, 8)

This task bundles items 1, 4, and 8 because items 1 and 8 both modify the exact same code sample (the "Anatomy of a Rune" run-mode example in `intro-compiler.js`), and item 4 is a short adjacent addition in the same file's next section — splitting them would mean two different tasks both touching the same 20-line block, which is harder to review correctly than doing it once.

**Files:**
- Modify: `crunes-cli/src/docs/intro-compiler.js:158-177` (Anatomy of a Rune run-mode sample)
- Modify: `crunes-cli/src/docs/intro-compiler.js:205-222` (CLI Calling & Argument Conventions — add `--help` callout)
- Modify: `crunes-cli/src/docs/intro-compiler.js:240-244` (Custom Commands & Nested Parameters Mapping — add `$command`/`$rest` note)

**Interfaces:**
- Consumes: nothing
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Replace the run-mode code sample (lines 158-177)**

Replace:

```javascript
  lines.push('**Run mode** — export `args` to declare a schema and `run` to execute:')
  lines.push('')
  lines.push('```javascript')
  lines.push('export function args(builder) {')
  lines.push('  return builder')
  lines.push('    .option(\'--verbose\', \'Verbose output\', false)')
  lines.push('    .command(\'remote\', \'Manage git remotes\', remote => {')
  lines.push('      remote.command(\'add\', \'Add a remote\', add => {')
  lines.push('        add.positional(\'<name>\', \'Remote name\')')
  lines.push('           .positional(\'<url>\', \'Remote URL\')')
  lines.push('      })')
  lines.push('    })')
  lines.push('}')
  lines.push('')
  lines.push('export async function run(args) {')
  lines.push('  if (args.$command === \'remote add\') {')
  lines.push('    return `Adding remote ${args.name} at ${args.url}`')
  lines.push('  }')
  lines.push('}')
  lines.push('```')
  lines.push('')
```

with:

```javascript
  lines.push('**Run mode** — export `args` to declare a schema and `run` to execute. `--help`/`-h` is NOT intercepted by `crunes run` — declare it yourself and check it at the top of `run(args)`, as shown below. This example also shows `args(builder)` reading `vars` at schema-build time to compute a dynamic option (`--profile`), a common pattern for anything with a "profile"/"environment" concept:')
  lines.push('')
  lines.push('```javascript')
  lines.push('import { vars, rune } from \'@utils\'')
  lines.push('')
  lines.push('export function args(builder) {')
  lines.push('  const profiles = vars.read(\'deploy_profiles\', [\'staging\', \'production\'])')
  lines.push('  return builder')
  lines.push('    .option(\'-h, --help\', \'Show help\')')
  lines.push('    .option(\'--profile <name>\', `Deployment profile (${profiles.join(\'|\')})`, profiles[0])')
  lines.push('    .option(\'--verbose\', \'Verbose output\', false)')
  lines.push('    .command(\'remote\', \'Manage git remotes\', remote => {')
  lines.push('      remote.command(\'add\', \'Add a remote\', add => {')
  lines.push('        add.positional(\'<name>\', \'Remote name\')')
  lines.push('           .positional(\'<url>\', \'Remote URL\')')
  lines.push('      })')
  lines.push('    })')
  lines.push('}')
  lines.push('')
  lines.push('export async function run(args) {')
  lines.push('  if (args.help) return rune.helpSection()')
  lines.push('  if (args.$command === \'remote add\') {')
  lines.push('    return `Adding remote ${args.name} at ${args.url}`')
  lines.push('  }')
  lines.push('}')
  lines.push('```')
  lines.push('')
```

- [ ] **Step 2: Add the `--help` callout in "2. CLI Calling & Argument Conventions"**

In the same file, find the block starting `lines.push('### The Strict 3-Tier Parsing Boundary')` (around line 209) and its closing `lines.push('')` before `### Bracket Syntax` (around line 222). Immediately after the existing warning block:

```javascript
  lines.push('> [!WARNING]')
  lines.push('> Placing a global flag after `run` (e.g. `crunes run --cwd ./project`) causes an instant error.')
  lines.push('')
```

insert:

```javascript
  lines.push('> [!WARNING]')
  lines.push('> `--help`/`-h` are NOT intercepted by `crunes run` — if a rune does not declare its own help option and check it inside `run(args)`, an unrecognized `--help` is silently ignored and the rune executes for real. Use `crunes docs rune <key>` to preview a rune\'s CLI surface without executing it.')
  lines.push('')
```

- [ ] **Step 3: Add the `$command`/`$rest` note in "Custom Commands & Nested Parameters Mapping"**

In the same file, find the bullet list starting `lines.push('- **\`args.$command\`**...')` (around line 241) through `lines.push('- **Named Positionals**...')` (around line 244). Immediately after that last bullet line, before the following blank `lines.push('')`, insert:

```javascript
  lines.push('- An unrecognized subcommand does not populate `$command` — it falls through to the root (`$command === \'\'`) with the unmatched token in `$rest`. To report "unknown command," check `args.$command === \'\' && args.$rest.length > 0`.')
```

- [ ] **Step 4: Rebuild and verify**

```bash
npm run build
node dist/cli.js -p docs intro
```
Expected: section 1's run-mode example shows `--help`/`-h`, `rune.helpSection()`, and the `--profile` dynamic option; section 2 shows the new `--help` warning; section 2's command-mapping bullets show the new `$command`/`$rest` line.

- [ ] **Step 5: Run the existing intro-compiler test**

```bash
npx vitest run test/docs/intro-compiler.test.js
```
Expected: PASS (only checks section headers).

- [ ] **Step 6: Run full test suite**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/docs/intro-compiler.js
git commit -m "docs(intro): show --help handling and dynamic args() reading vars in the Anatomy example"
```

---

### Task 5: Add a `crunes create` invocation example and the `.gitignore` scaffold note (items 7, 9)

**Files:**
- Modify: `crunes-cli/src/docs/intro-compiler.js:153-158` (before Anatomy of a Rune code samples)
- Modify: `crunes-cli/src/docs/intro-compiler.js:256-257` (Configuration Reference opening)

**Interfaces:**
- Consumes: nothing
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Add the `crunes create` example before the Anatomy of a Rune code samples**

Find:

```javascript
  // Section 1: Anatomy of a Rune
  lines.push('## 1. Anatomy of a Rune')
  lines.push('')
  lines.push('Crunes execute inside an isolated sandbox (`isolated-vm`). Runes are ESM modules with two primary execution modes: **run** (one-shot) and **repl** (interactive session).')
  lines.push('')
  lines.push('**Run mode** ...')
```

Insert, immediately after the existing intro paragraph (`'Crunes execute inside...'`) and its trailing blank line, before `'**Run mode**...'`:

```javascript
  lines.push('Scaffold a new rune with `crunes create`. In non-interactive/agent sessions `--format` is required (no default):')
  lines.push('```bash')
  lines.push('crunes create my-rune --format markdown --path .crunes/runes/my-rune.js --yes')
  lines.push('```')
  lines.push('')
```

(This goes right before the existing `lines.push('**Run mode** ...')` line — do not remove or reorder any existing lines, just insert this block between the intro paragraph and the "Run mode" line.)

- [ ] **Step 2: Add the `.gitignore` scaffold note in Configuration Reference**

Find:

```javascript
  // Section 3: Configuration Reference
  lines.push('## 3. Configuration Reference')
  lines.push('')
  lines.push('Configuration properties in `.crunes/config.json` control permissions, default variables, mappings, and plugin registration.')
  lines.push('')
  lines.push('### Sandbox Security & Permissions')
```

Insert, immediately after the opening paragraph line and its blank line, before `'### Sandbox Security & Permissions'`:

```javascript
  lines.push('`crunes init` also scaffolds a `.crunes/.gitignore` covering local-only files (`config.local.json`, `project.local.json`) and generated directories (`logs/`, `caches/`, `schemas/`, `sqlite/`, `jobs/`) — only `config.json` and your rune `.js` files need to be committed.')
  lines.push('')
```

- [ ] **Step 3: Rebuild and verify**

```bash
npm run build
node dist/cli.js -p docs intro
```
Expected: section 1 shows the `crunes create` invocation before the run-mode example; section 3's opening shows the `.gitignore` sentence before "Sandbox Security & Permissions".

- [ ] **Step 4: Run the existing intro-compiler test**

```bash
npx vitest run test/docs/intro-compiler.test.js
```
Expected: PASS.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/docs/intro-compiler.js
git commit -m "docs(intro): add crunes create invocation example and .gitignore scaffold note"
```

---

## Part B — Remove the Config Sibling-Map Duality (item 6)

### Task 6: Remove top-level `permissions`/`vars` merge and validation in `config.js` (TDD)

**Files:**
- Modify: `crunes-cli/src/core/config.js:8-94`
- Modify: `crunes-cli/test/core/config.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `mergeConfigs(shared, local)` and `validateConfig(config, fileName)` no longer read or specially interpret top-level `permissions`/`vars` keys — consumed by Task 7 and Task 8, which rely on `config.permissions`/`config.vars` being fully inert (never populated by the merge step in a special way, never validated).

- [ ] **Step 1: Write the failing tests**

Replace the `mergeConfigs` describe block's two stale tests in `crunes-cli/test/core/config.test.js` (currently lines 38-56 "deep merges vars" and lines 81-100 "completely replaces permissions per rune") with:

```javascript
  it('does not specially merge a top-level vars map — local key wins as a plain primitive', () => {
    const shared = {
      vars: {
        "my-rune": { "profile": "developer", "debug": false }
      }
    }
    const local = {
      vars: {
        "my-rune": { "profile": "operator", "token": "secret" }
      }
    }
    const result = mergeConfigs(shared, local)
    expect(result.vars).toEqual({
      "my-rune": { "profile": "operator", "token": "secret" }
    })
  })
```

and:

```javascript
  it('does not specially merge a top-level permissions map — local key wins as a plain primitive', () => {
    const shared = {
      permissions: {
        "my-rune": {
          use: { allow: ["fs.read:src/**"] }
        }
      }
    }
    const local = {
      permissions: {
        "my-rune": {
          use: { allow: ["fs.read:/**"] }
        }
      }
    }
    const result = mergeConfigs(shared, local)
    expect(result.permissions).toEqual({
      "my-rune": {
        use: { allow: ["fs.read:/**"] }
      }
    })
  })
```

Also replace the `validateConfig with fileNames` describe block (currently lines 117-128, "throws with correct filename in error message") — this test currently expects a top-level `permissions` map to throw a validation error, which will no longer happen. Replace it with:

```javascript
describe('validateConfig with fileNames', () => {
  it('does not throw on a top-level permissions map regardless of file name', () => {
    const config = {
      permissions: {
        "my-rune": { allow: ["fs.read:src/**"] }
      }
    }
    expect(() => validateConfig(config, 'config.local.json')).not.toThrow()
  })

  it('still throws with correct filename for a malformed nested runes[key].permissions block', () => {
    const config = {
      runes: {
        "my-rune": { permissions: { allow: ["fs.read:src/**"] } }
      }
    }
    expect(() => validateConfig(config, 'config.local.json')).toThrow(
      'config.local.json: runes["my-rune"].permissions must be lifecycle-scoped (e.g. permissions.run.allow)'
    )
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run test/core/config.test.js
```
Expected: FAIL — the two `mergeConfigs` tests fail because `mergeConfigs` still deep-merges top-level `vars`/`permissions` (current `result.vars`/`result.permissions` would be the deep-merged object, not the local-overwrite-only object the new assertions expect). The `validateConfig with fileNames` "does not throw" test fails because `validateConfig` still throws on a flat top-level `permissions` map.

- [ ] **Step 3: Implement the minimal fix in `config.js`**

In `crunes-cli/src/core/config.js`, replace the whole file with:

```javascript
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item)
}

export function mergeConfigs(shared, local) {
  const merged = { ...shared }

  // 1. Merge Top-level Primitives & simple keys
  for (const [key, value] of Object.entries(local)) {
    if (key !== 'runes' && key !== 'plugins') {
      merged[key] = value
    }
  }

  // 2. Merge 'runes'
  if (local.runes) {
    merged.runes = { ...shared.runes }
    for (const [key, localEntry] of Object.entries(local.runes)) {
      const sharedEntry = shared.runes?.[key]
      if (sharedEntry && isObject(sharedEntry) && isObject(localEntry)) {
        merged.runes[key] = {
          ...sharedEntry,
          ...localEntry,
          vars: { ...sharedEntry.vars, ...localEntry.vars }
        }
      } else {
        merged.runes[key] = localEntry
      }
    }
  }

  // 3. Merge 'plugins' (Union)
  if (local.plugins) {
    const combined = [...(shared.plugins ?? []), ...(local.plugins ?? [])]
    merged.plugins = Array.from(new Set(combined))
  }

  return merged
}

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
    }
  }
}

export function loadConfig(dir) {
  const configPath = join(dir, '.crunes', 'config.json')
  const localConfigPath = join(dir, '.crunes', 'config.local.json')

  // Read & validate config.json
  const shared = JSON.parse(readFileSync(configPath, 'utf8'))
  validateConfig(shared, 'config.json')

  // Read & validate config.local.json (if present)
  let local = {}
  if (existsSync(localConfigPath)) {
    try {
      local = JSON.parse(readFileSync(localConfigPath, 'utf8'))
    } catch (err) {
      throw new Error(`config.local.json is invalid JSON: ${err.message}`)
    }
    validateConfig(local, 'config.local.json')
  }

  return mergeConfigs(shared, local)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run test/core/config.test.js
```
Expected: PASS — all tests in this file green, including the retained "warns if local runes permissions block is empty", "throws error if local runes permissions block is flat (non-scoped)", "deep merges runes entries", "unions plugins list", and "overrides global primitives" tests (none of these touched top-level `vars`/`permissions`).

- [ ] **Step 5: Run full test suite**

```bash
npm test
```
Expected: all pass. No existing test constructs a config with a top-level `permissions`/`vars` map and asserts on `resolver.js`/`docs/commands/rune.js` behavior (confirmed via `grep -n "config.permissions\|config.vars\b" test/rune/resolver.test.js test/docs/commands/rune.test.js` returning no matches), so this change is safe in isolation even before Tasks 7-8 update those files' reads.

- [ ] **Step 6: Commit**

```bash
git add src/core/config.js test/core/config.test.js
git commit -m "fix(config): stop specially merging/validating top-level permissions/vars maps"
```

---

### Task 7: Route plugin-rune overrides through `runes["plugin:rune"]` entries in `resolver.js` (TDD)

**Files:**
- Modify: `crunes-cli/src/rune/resolver.js:97-263`
- Modify: `crunes-cli/test/rune/resolver.test.js`

**Interfaces:**
- Consumes: `mergeConfigs`/`validateConfig` from Task 6 no longer touch top-level `permissions`/`vars` (this task removes all reads of `config.permissions?.[key]`/`config.vars?.[key]`, so Task 6 must land first, or at minimum this task's code changes are independent of whether Task 6 landed — but do Task 6 first per this plan's ordering).
- Produces: for local runes, `entry.permissions`/`entry.vars` are the sole permission/vars source. For plugin runes, `config.runes?.["pluginKey:runeKey"]?.permissions`/`.vars` is the sole project-side override source — consumed by Task 8 (`docs/commands/rune.js`, which only handles the local-rune case and has no plugin-rune override to migrate, but shares the same "drop `config.permissions?.[key]`" pattern).

- [ ] **Step 1: Write the failing tests**

Add the following to `crunes-cli/test/rune/resolver.test.js`. First, add a mock for `../../src/plugin/manifest.js` at the top of the file, alongside the existing `vi.mock` calls (after line 11's `resolvePluginKey` mock):

```javascript
vi.mock('../../src/plugin/manifest.js', () => ({
  loadPluginJson: vi.fn(),
}))
```

Add the corresponding import near the top, alongside the existing imports:

```javascript
import { loadRegistry, resolvePluginKey } from '../../src/plugin/registry.js'
import { loadPluginJson } from '../../src/plugin/manifest.js'
import { executePluginRune } from '../../src/rune/isolation/runner.js'
```

Then add a new describe block at the end of the file:

```javascript
describe('runRune — plugin rune permission/vars override via runes["plugin:rune"]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('passes runes["plugin:rune"].permissions/.vars as projectPerms/projectVars to executePluginRune', async () => {
    resolvePluginKey.mockReturnValue('my-plugin')
    loadRegistry.mockResolvedValue({
      plugins: { 'my-plugin': { path: '/plugins/my-plugin', cacheDir: '/plugins/my-plugin' } }
    })
    loadPluginJson.mockResolvedValue({
      name: 'my-plugin',
      version: '1.0.0',
      runes: { deploy: { permissions: {}, vars: {} } }
    })

    const config = {
      plugins: ['my-plugin'],
      runes: {
        'my-plugin:deploy': {
          vars: { region: 'us-east-1' },
          permissions: { run: { allow: ['fs.read:src/**'] } }
        }
      }
    }

    await runRune('/project', config, 'my-plugin:deploy', [])

    expect(executePluginRune).toHaveBeenCalledWith(
      expect.objectContaining({
        projectPerms: { run: { allow: ['fs.read:src/**'] } },
        projectVars: { region: 'us-east-1' },
      })
    )
  })

  it('auto-discovered bare-key plugin rune also picks up runes["plugin:rune"] override', async () => {
    // Note: a bare key (no colon) never reaches resolvePluginKey — resolvePluginRune()
    // short-circuits on `colonIdx === -1` and resolveRuneFromPlugins() (the actual
    // auto-discovery path) doesn't call resolvePluginKey at all. No mock needed for it here.
    loadRegistry.mockResolvedValue({
      plugins: { 'my-plugin': { path: '/plugins/my-plugin', cacheDir: '/plugins/my-plugin' } }
    })
    loadPluginJson.mockResolvedValue({
      name: 'my-plugin',
      version: '1.0.0',
      runes: { deploy: { permissions: {}, vars: {} } }
    })

    const config = {
      plugins: ['my-plugin'],
      runes: {
        'my-plugin:deploy': {
          vars: { region: 'eu-west-1' },
          permissions: { run: { allow: ['fs.read:dist/**'] } }
        }
      }
    }

    await runRune('/project', config, 'deploy', [])

    expect(executePluginRune).toHaveBeenCalledWith(
      expect.objectContaining({
        projectPerms: { run: { allow: ['fs.read:dist/**'] } },
        projectVars: { region: 'eu-west-1' },
      })
    )
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run test/rune/resolver.test.js
```
Expected: FAIL — `executePluginRune` is currently called with `projectPerms`/`projectVars` sourced from `config.permissions?.['my-plugin:deploy']`/`config.vars?.['my-plugin:deploy']`, both `undefined`/`{}` given the test's config, so the `expect.objectContaining` assertions on non-empty `projectPerms`/`projectVars` fail.

- [ ] **Step 3: Implement the minimal fix in `resolver.js`**

In `crunes-cli/src/rune/resolver.js`, make these four substitutions:

Replace (in `runRune`, first plugin-match branch, lines 101-102):
```javascript
    const projectPerms = config.permissions?.[`${pluginKey}:${runeKey}`]
    const projectVars  = config.vars?.[`${pluginKey}:${runeKey}`] ?? {}
```
with:
```javascript
    const projectPerms = config.runes?.[`${pluginKey}:${runeKey}`]?.permissions
    const projectVars  = config.runes?.[`${pluginKey}:${runeKey}`]?.vars ?? {}
```

Replace (in `runRune`, auto-discovered match branch, lines 120-121):
```javascript
      const projectPerms = config.permissions?.[`${pluginKey}:${runeKey}`]
      const projectVars  = config.vars?.[`${pluginKey}:${runeKey}`] ?? {}
```
with:
```javascript
      const projectPerms = config.runes?.[`${pluginKey}:${runeKey}`]?.permissions
      const projectVars  = config.runes?.[`${pluginKey}:${runeKey}`]?.vars ?? {}
```

Replace (in `runRune`, plugin-alias branch, line 142-143):
```javascript
    const projectPerms = entry.permissions ?? config.permissions?.[`${pluginKey}:${runeKey}`]
    const projectVars  = entry.vars ?? config.vars?.[`${pluginKey}:${runeKey}`] ?? {}
```
with:
```javascript
    const projectPerms = entry.permissions ?? config.runes?.[`${pluginKey}:${runeKey}`]?.permissions
    const projectVars  = entry.vars ?? config.runes?.[`${pluginKey}:${runeKey}`]?.vars ?? {}
```

Replace (in `runRune`, final local-rune branch, line 157):
```javascript
  const effective = computeEffectivePermissions(basePerms, config.permissions?.[key], 'run')
```
with:
```javascript
  const effective = computeEffectivePermissions(basePerms, undefined, 'run')
```

Replace (in `resolveRuneEntry`, plugin-prefixed branch, lines 188, 194):
```javascript
    const projectPerms = config.permissions?.[`${pluginKey}:${runeKey}`]
    const effective = computeEffectivePermissions(
      pluginJson.runes[runeKey]?.permissions ?? {},
      projectPerms ?? {},
      'repl'
    )
    const vars = { ...(pluginJson.runes[runeKey]?.vars ?? {}), ...(config.vars?.[`${pluginKey}:${runeKey}`] ?? {}) }
```
with:
```javascript
    const projectPerms = config.runes?.[`${pluginKey}:${runeKey}`]?.permissions
    const effective = computeEffectivePermissions(
      pluginJson.runes[runeKey]?.permissions ?? {},
      projectPerms ?? {},
      'repl'
    )
    const vars = { ...(pluginJson.runes[runeKey]?.vars ?? {}), ...(config.runes?.[`${pluginKey}:${runeKey}`]?.vars ?? {}) }
```

Replace (in `resolveRuneEntry`, local-rune branch, line 217):
```javascript
    const effective = computeEffectivePermissions(entry.permissions ?? {}, config.permissions?.[key], 'repl')
```
with:
```javascript
    const effective = computeEffectivePermissions(entry.permissions ?? {}, undefined, 'repl')
```

Replace (in `resolveRuneEntry`, auto-discovered branch, lines 237, 243):
```javascript
    const projectPerms = config.permissions?.[`${pluginKey}:${runeKey}`]
    const effective = computeEffectivePermissions(
      pluginJson.runes[runeKey]?.permissions ?? {},
      projectPerms ?? {},
      'repl'
    )
    const vars = { ...(pluginJson.runes[runeKey]?.vars ?? {}), ...(config.vars?.[`${pluginKey}:${runeKey}`] ?? {}) }
```
with:
```javascript
    const projectPerms = config.runes?.[`${pluginKey}:${runeKey}`]?.permissions
    const effective = computeEffectivePermissions(
      pluginJson.runes[runeKey]?.permissions ?? {},
      projectPerms ?? {},
      'repl'
    )
    const vars = { ...(pluginJson.runes[runeKey]?.vars ?? {}), ...(config.runes?.[`${pluginKey}:${runeKey}`]?.vars ?? {}) }
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run test/rune/resolver.test.js
```
Expected: PASS — all tests in this file green, including the two new ones and every pre-existing test (none of the pre-existing tests used plugin-prefixed keys or top-level `permissions`/`vars`, so they're unaffected).

- [ ] **Step 5: Run full test suite**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/rune/resolver.js test/rune/resolver.test.js
git commit -m "fix(resolver): route plugin-rune permission/vars overrides through runes[\"plugin:rune\"] entries"
```

---

### Task 8: Drop the redundant `config.permissions?.[key]` reads in `docs/commands/rune.js`

**Files:**
- Modify: `crunes-cli/src/docs/commands/rune.js:73-74`

**Interfaces:**
- Consumes: Task 6's `config.js` changes (top-level `permissions` is inert) and Task 7's pattern (local-rune overrides come solely from `entry.permissions`).
- Produces: nothing consumed by later tasks — this is the last resolver-adjacent call site.

- [ ] **Step 1: Confirm no test coverage needs updating**

`crunes-cli/test/docs/commands/rune.test.js` exists but contains no assertions referencing `permissions` (confirmed via `grep -n "permissions" test/docs/commands/rune.test.js` returning no matches), so this change needs no test updates — proceed directly to the code change.

- [ ] **Step 2: Replace the two lines**

In `crunes-cli/src/docs/commands/rune.js`, replace lines 73-74:

```javascript
    const runEffective  = computeEffectivePermissions(basePerms, config.permissions?.[key], 'run')
    const replEffective = computeEffectivePermissions(basePerms, config.permissions?.[key], 'repl')
```

with:

```javascript
    const runEffective  = computeEffectivePermissions(basePerms, undefined, 'run')
    const replEffective = computeEffectivePermissions(basePerms, undefined, 'repl')
```

- [ ] **Step 3: Run any existing test for this file, or the full docs test directory**

```bash
npx vitest run test/docs/
```
Expected: PASS — `basePerms` (from `entry.permissions`) already carries the full permission set; passing `undefined` as the override to `computeEffectivePermissions` is a no-op per `src/rune/permissions/permissions.js:187-197` (`namespaceProject` becomes `undefined`, falling back to `namespacePlugin`/`pluginAllow`/`pluginDeny` only — the entry's own permissions pass straight through unchanged).

- [ ] **Step 4: Run full test suite**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/docs/commands/rune.js
git commit -m "fix(docs/rune): drop redundant top-level config.permissions read"
```

---

### Task 9: Update the intro's config example to show only the nested shape, including a plugin-rune override example

**Files:**
- Modify: `crunes-cli/src/docs/intro-compiler.js:259-297` (Sandbox Security & Permissions + Config File Fields Reference)

**Interfaces:**
- Consumes: Task 6/7/8's removal of the top-level shape (this task must describe only what's actually supported after those land).
- Produces: nothing consumed by later tasks — last task in this plan.

- [ ] **Step 1: Replace the "Sandbox Security & Permissions" section**

In `crunes-cli/src/docs/intro-compiler.js`, replace lines 259-291:

```javascript
  lines.push('### Sandbox Security & Permissions')
  lines.push('Runes do not have direct access to Node.js APIs. They declare specific lifecycle-scoped permission scopes in `.crunes/config.json`:')
  lines.push('```json')
  lines.push('{')
  lines.push('  "runes": {')
  lines.push('    "my-rune": {')
  lines.push('      "name": "My Rune",')
  lines.push('      "description": "Does something useful",')
  lines.push('      "path": ".crunes/runes/my-rune.js",')
  lines.push('      "vars": { "api_url": "https://example.com" }')
  lines.push('    }')
  lines.push('  },')
  lines.push('  "permissions": {')
  lines.push('    "my-rune": {')
  lines.push('      "run": { "allow": ["fs.read:src/**", "fs.write:dist/**", "shell.run:git *"] }')
  lines.push('    }')
  lines.push('  }')
  lines.push('}')
  lines.push('```')
  lines.push('')
  lines.push('For runes that use both `run` and `repl`, declare both permission namespaces separately — `repl` does not inherit from `run`:')
  lines.push('```json')
  lines.push('{')
  lines.push('  "runes": {')
  lines.push('    "my-shell": {')
  lines.push('      "permissions": {')
  lines.push('        "run":     { "allow": ["sqlite.read:./state::db"] },')
  lines.push('        "repl":    { "allow": ["sqlite.read:./state::db", "sqlite.write:./state::db"] }')
  lines.push('      }')
  lines.push('    }')
  lines.push('  }')
  lines.push('}')
  lines.push('```')
  lines.push('')
```

with:

```javascript
  lines.push('### Sandbox Security & Permissions')
  lines.push('Runes do not have direct access to Node.js APIs. They declare specific lifecycle-scoped permission scopes nested inside their own entry in `.crunes/config.json`:')
  lines.push('```json')
  lines.push('{')
  lines.push('  "runes": {')
  lines.push('    "my-rune": {')
  lines.push('      "name": "My Rune",')
  lines.push('      "description": "Does something useful",')
  lines.push('      "path": ".crunes/runes/my-rune.js",')
  lines.push('      "vars": { "api_url": "https://example.com" },')
  lines.push('      "permissions": {')
  lines.push('        "run": { "allow": ["fs.read:src/**", "fs.write:dist/**", "shell.run:git *"] }')
  lines.push('      }')
  lines.push('    }')
  lines.push('  }')
  lines.push('}')
  lines.push('```')
  lines.push('')
  lines.push('For runes that use both `run` and `repl`, declare both permission namespaces separately — `repl` does not inherit from `run`:')
  lines.push('```json')
  lines.push('{')
  lines.push('  "runes": {')
  lines.push('    "my-shell": {')
  lines.push('      "permissions": {')
  lines.push('        "run":     { "allow": ["sqlite.read:./state::db"] },')
  lines.push('        "repl":    { "allow": ["sqlite.read:./state::db", "sqlite.write:./state::db"] }')
  lines.push('      }')
  lines.push('    }')
  lines.push('  }')
  lines.push('}')
  lines.push('```')
  lines.push('')
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
```

- [ ] **Step 2: Update the "Config File Fields Reference" bullets**

In the same file, replace lines 293-297:

```javascript
  lines.push('### Config File Fields Reference')
  lines.push('- **`permissions`**: Mappings of permission templates scoped to specific runes.')
  lines.push('- **`runes`**: Definition of project-registered runes, containing local filesystem paths, pre-declared vars, and metadata.')
  lines.push('- **`vars`**: Key-value settings scoped to specific runes (accessible inside the isolate via `utils.vars.read(key)`).')
  lines.push('- **`plugins`**: Mappings of enabled third-party marketplaces or plugins.')
```

with:

```javascript
  lines.push('### Config File Fields Reference')
  lines.push('- **`runes`**: Definition of project-registered runes, keyed by rune key (or `"pluginName:runeKey"` for a plugin-rune override). Each entry may declare `path`, `name`, `description`, `vars` (key-value settings read via `utils.vars.read(key)`), and `permissions` (lifecycle-scoped allow/deny lists).')
  lines.push('- **`plugins`**: List of enabled third-party marketplaces or plugins.')
```

- [ ] **Step 3: Rebuild and verify**

```bash
npm run build
node dist/cli.js -p docs intro
```
Expected: section 3 shows only nested `vars`/`permissions` inside `runes.<key>` entries, a new plugin-rune override example using `"my-plugin:deploy"`, and the updated Config File Fields Reference bullets. No top-level sibling `"permissions"`/`"vars"` map appears anywhere in the output.

- [ ] **Step 4: Run the existing intro-compiler test**

```bash
npx vitest run test/docs/intro-compiler.test.js
```
Expected: PASS.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 6: Full local CI check**

```bash
npm test && npm run build && node dist/cli.js --help
```
Expected: clean run, no errors.

- [ ] **Step 7: Commit**

```bash
git add src/docs/intro-compiler.js
git commit -m "docs(intro): show only the nested config shape, including a plugin-rune override example"
```

---

## Final Verification

After all 9 tasks are committed:

- [ ] Run `npm test` from `crunes-cli/` — full suite green.
- [ ] Run `npm run build && node dist/cli.js --help` — matches this project's CI-equivalent check.
- [ ] Run `node dist/cli.js -p docs intro` and manually confirm all 8 Part A doc items appear as designed.
- [ ] Run `node dist/cli.js -p docs utils env` and `node dist/cli.js -p docs utils rune` and confirm items 5 and 2's wording appears.
- [ ] Grep the final `src/core/config.js`, `src/rune/resolver.js`, and `src/docs/commands/rune.js` for any remaining `config.permissions` or `config.vars` reference — expect zero matches.
