# Rune Self-Inspection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose `rune.key()`, `rune.argsSchema()`, `rune.commandsSchema()`, `rune.helpText()`, and `rune.helpSection()` inside the rune sandbox for both `run` and `repl` lifecycles, replacing the `help` namespace (deprecated alias kept).

**Architecture:** Replace the bare `helpText` parameter on `injectUtils` with a structured `runeContext` object; inject four `$__rune_*` globals into the sandbox; wire self-inspection methods onto the existing `rune` utils object in `utils-bootstrap.js`; tighten type definitions in `rune.d.ts`, `help.d.ts`, and `lifecycle.d.ts`.

**Tech Stack:** Node.js ESM, isolated-vm, vitest

## Global Constraints

- All files under `src/` must use ES module syntax (no `require`)
- Tests run via `npx vitest run <path>` from inside `crunes-cli/`
- Never commit `dist/`; build manually with `npm run build` for manual verification
- All git commands must be run inside `crunes-cli/`

---

## File Map

| File | Change |
|------|--------|
| `src/rune/isolation/runner.js` | Refactor `injectUtils` signature; update run + repl call sites to pass `runeContext`; rename `$__help_text` → `$__rune_help_text` |
| `src/rune/isolation/utils-bootstrap.js` | Read `$__rune_*` globals; add `rune.*` self-inspection methods; keep `help` as deprecated alias |
| `src/rune/api/types-utils/rune.d.ts` | Add `key`, `helpText`, `helpSection`, `argsSchema`, `commandsSchema`, `ArgSchema`, `CommandSchema` |
| `src/rune/api/types-utils/help.d.ts` | Add `@deprecated` to `text()` and `section()` |
| `src/rune/api/types-lifecycle/lifecycle.d.ts` | Add `CommandBuilder`; update `commandsRepl` signature; fix `ParsedArgs.$command`/`$commands` to non-optional |
| `test/rune/isolation/runner.test.js` | Add tests for `rune.key()`, `rune.argsSchema()`, `rune.commandsSchema()` in run lifecycle |
| `test/rune/isolation/repl-session.test.js` | Add tests for `rune.argsSchema()`, `rune.commandsSchema()` in repl lifecycle |

---

### Task 1: Refactor `injectUtils` — `runeContext` parameter + `$__rune_*` globals

**Files:**
- Modify: `src/rune/isolation/runner.js:63` (signature) and `:1206-1208` (injection block) and `:1313` (run call site) and `:1776` (repl call site) and `:1490` (bootstrap/help call site)
- Test: `test/rune/isolation/runner.test.js`

**Interfaces:**
- Produces: `injectUtils(..., runeContext)` where `runeContext = { key: string|null, helpText: string|null, argsSchema: object|null, commandsSchema: object|null }`
- Produces: sandbox globals `$__rune_key`, `$__rune_help_text`, `$__rune_args_schema`, `$__rune_commands_schema`

- [ ] **Step 1: Write a failing test that verifies `$__rune_key` is readable from sandbox**

Add to `test/rune/isolation/runner.test.js` inside an existing or new `describe` block:

```js
describe('runeContext injection', () => {
  let tmp
  beforeEach(async () => { tmp = await mkdtemp(join(tmpdir(), 'crunes-ctx-')) })
  afterEach(async () => { await rm(tmp, { recursive: true, force: true }) })

  it('exposes rune.key() from the run lifecycle', async () => {
    const f = join(tmp, 'rune.js')
    await writeFile(f, `
      import { rune } from '@utils'
      export async function run() {
        return rune.key()
      }
    `)
    const effective = { allow: [], deny: [] }
    const result = await runRuneInIsolate(f, effective, [], tmp, {})
    expect(result.sections).toHaveLength(1)
    expect(result.sections[0]).toBe('my-rune')
  })
})
```

Wait — `runRuneInIsolate` returns sections, not raw strings. Look at how existing runner tests call it and check what `runeKey` value gets passed. Use the pattern from existing tests in `runner.test.js` (search for `runRuneInIsolate` calls). The rune key used in tests comes from the options object. Adjust the assertion to match — the key will be whatever is passed as `runeKey` in the opts.

The actual test (matching the runner.test.js pattern):

```js
it('exposes rune.key() inside run()', async () => {
  const f = join(tmp, 'rune.js')
  await writeFile(f, `
    import { section, rune } from '@utils'
    export async function run() {
      return section.create('result', { type: 'markdown', content: rune.key() ?? 'null' })
    }
  `)
  const effective = { allow: [], deny: [] }
  const result = await runRuneInIsolate(f, effective, [], tmp, { runeKey: 'test-rune' })
  expect(result.sections[0].data.content).toBe('test-rune')
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd crunes-cli && npx vitest run test/rune/isolation/runner.test.js --reporter=verbose 2>&1 | tail -30
```

Expected: FAIL — `rune.key is not a function` or similar.

- [ ] **Step 3: Refactor `injectUtils` signature in `runner.js`**

Change line 63 from:
```js
async function injectUtils(isolate, context, utils, _runeCallback, vars, projectDir, checkPermission, currentRuneKey, sections, onEvent, helpText) {
```
to:
```js
async function injectUtils(isolate, context, utils, _runeCallback, vars, projectDir, checkPermission, sections, onEvent, runeContext) {
```

- [ ] **Step 4: Replace the `$__help_text` injection block**

Find this block (around line 1206-1208):
```js
await jail.set('$__vars', JSON.stringify(vars))
await jail.set('$__projectDir', projectDir)
await jail.set('$__help_text', helpText ?? null)
```

Replace with:
```js
await jail.set('$__vars', JSON.stringify(vars))
await jail.set('$__projectDir', projectDir)
await jail.set('$__rune_key',             runeContext?.key ?? null)
await jail.set('$__rune_help_text',       runeContext?.helpText ?? null)
await jail.set('$__rune_args_schema',     JSON.stringify(runeContext?.argsSchema ?? null))
await jail.set('$__rune_commands_schema', JSON.stringify(runeContext?.commandsSchema ?? null))
```

- [ ] **Step 5: Update the run path call site**

Find this block (around line 1305-1313):
```js
let helpText = null
if (lifecycle === 'run') {
  try {
    const schema = await getArgsSchema(runeFile, effective, projectDir, { vars, nodeModulesDir, pluginDeps, pluginDir, pluginId })
    const entry = { name: runeKey, description: undefined }
    helpText = formatHelp(schema, { key: runeKey, name: entry.name, description: entry.description })
  } catch { /* help unavailable, silently skip */ }
}
const utilsMod = await injectUtils(isolate, context, utils, runeCallback, vars, projectDir, checkPermission, runeKey, sections, wrappedOnEvent, helpText)
```

Replace with:
```js
let runeContext = { key: runeKey, helpText: null, argsSchema: null, commandsSchema: null }
if (lifecycle === 'run') {
  try {
    const schema = await getArgsSchema(runeFile, effective, projectDir, { vars, nodeModulesDir, pluginDeps, pluginDir, pluginId })
    runeContext.argsSchema = schema
    runeContext.helpText = formatHelp(schema, { key: runeKey, name: runeKey, description: undefined })
  } catch { /* help unavailable, silently skip */ }
}
const utilsMod = await injectUtils(isolate, context, utils, runeCallback, vars, projectDir, checkPermission, sections, wrappedOnEvent, runeContext)
```

- [ ] **Step 6: Update the repl path call site**

Find this block (around line 1770-1776):
```js
let helpText = null
try {
  const { argsSchema } = await getReplSchema(runeFile, effective, [], projectDir, { vars, nodeModulesDir, pluginDeps, pluginDir })
  if (argsSchema) helpText = formatHelp(argsSchema, { key: runeKey, name: runeKey, description: undefined, lifecycle: 'repl' })
} catch { /* help unavailable, silently skip */ }

const utilsMod = await injectUtils(isolate, context, utils, null, vars, projectDir, checkPermission, runeKey, null, wrappedOnEvent, helpText)
```

Replace with:
```js
let runeContext = { key: runeKey, helpText: null, argsSchema: null, commandsSchema: null }
try {
  const { argsSchema, commandsSchema } = await getReplSchema(runeFile, effective, [], projectDir, { vars, nodeModulesDir, pluginDeps, pluginDir })
  runeContext.argsSchema = argsSchema ?? null
  runeContext.commandsSchema = commandsSchema ?? null
  if (argsSchema) runeContext.helpText = formatHelp(argsSchema, { key: runeKey, name: runeKey, description: undefined, lifecycle: 'repl' })
} catch { /* help unavailable, silently skip */ }

const utilsMod = await injectUtils(isolate, context, utils, null, vars, projectDir, checkPermission, null, wrappedOnEvent, runeContext)
```

- [ ] **Step 7: Update the bootstrap/help call site in `getArgsSchema`**

Find (around line 1490):
```js
const utilsMod = await injectUtils(isolate, context, utils, null, vars, projectDir, checkPermission, null, null, null)
```

Replace with:
```js
const utilsMod = await injectUtils(isolate, context, utils, null, vars, projectDir, checkPermission, null, null, null)
```

This call site passes `null` as the last arg — with the new signature that's `runeContext = null`, which the bootstrap reads as all-null. No change needed here; the `runeContext?.key` optional chaining handles it. ✓

Also find the getReplSchema bootstrap call site and do the same check — it calls `injectUtils` the same way, also fine.

- [ ] **Step 8: Run the test to verify it still fails (bootstrap not done yet)**

```bash
cd crunes-cli && npx vitest run test/rune/isolation/runner.test.js --reporter=verbose 2>&1 | tail -20
```

Expected: still FAIL — `rune.key is not a function` because utils-bootstrap hasn't been updated yet.

- [ ] **Step 9: Run full test suite to check for regressions from signature change**

```bash
cd crunes-cli && npm test 2>&1 | tail -20
```

Expected: all existing tests still pass (the null-arg call sites are compatible).

- [ ] **Step 10: Commit**

```bash
cd crunes-cli && git add src/rune/isolation/runner.js test/rune/isolation/runner.test.js
git commit -m "refactor(runner): replace helpText param with runeContext object on injectUtils"
```

---

### Task 2: Wire `rune.*` self-inspection in `utils-bootstrap.js`

**Files:**
- Modify: `src/rune/isolation/utils-bootstrap.js:1682-1758`
- Test: `test/rune/isolation/runner.test.js` (failing test from Task 1 now passes)

**Interfaces:**
- Consumes: `$__rune_key`, `$__rune_help_text`, `$__rune_args_schema`, `$__rune_commands_schema` globals (set by Task 1)
- Produces: `rune.key()`, `rune.helpText()`, `rune.helpSection()`, `rune.argsSchema()`, `rune.commandsSchema()` on the `rune` utils object; `help` deprecated alias

- [ ] **Step 1: Replace the `$__help_text` block and `help` object in `utils-bootstrap.js`**

Find this block (around line 1748-1758):
```js
const __helpText = typeof $__help_text !== 'undefined' ? $__help_text : null

const help = {
  text() {
    return __helpText ?? ''
  },
  section() {
    const { section } = globalThis.utils
    return section.create('help', { type: 'markdown', content: __helpText ?? '' })
  },
}
```

Replace with:
```js
const __runeKey            = typeof $__rune_key !== 'undefined' ? $__rune_key : null
const __runeHelpText       = typeof $__rune_help_text !== 'undefined' ? $__rune_help_text : null
const __runeArgsSchema     = typeof $__rune_args_schema !== 'undefined' ? JSON.parse($__rune_args_schema) : null
const __runeCommandsSchema = typeof $__rune_commands_schema !== 'undefined' ? JSON.parse($__rune_commands_schema) : null

const { rune } = globalThis.utils
rune.key            = () => __runeKey
rune.helpText       = () => __runeHelpText ?? ''
rune.helpSection    = () => globalThis.utils.section.create('help', { type: 'markdown', content: __runeHelpText ?? '' })
rune.argsSchema     = () => __runeArgsSchema
rune.commandsSchema = () => __runeCommandsSchema

const help = {
  text:    () => rune.helpText(),
  section: () => rune.helpSection(),
}
```

- [ ] **Step 2: Update the export line to include `rune`**

Find line 1682-1683:
```js
export const { fs, shell, section, rune, json, yaml, xml, csv, http, env, vars, archive, cache, sqlite, db, crypto, codec, ws, time } = globalThis.utils
export { md, tree, help }
```

No change needed — `rune` is already exported via destructuring from `globalThis.utils`, and the self-inspection methods are added onto that same object reference. ✓

- [ ] **Step 3: Run the Task 1 failing test — it should now pass**

```bash
cd crunes-cli && npx vitest run test/rune/isolation/runner.test.js --reporter=verbose 2>&1 | tail -20
```

Expected: the `rune.key()` test PASSES.

- [ ] **Step 4: Add tests for `rune.argsSchema()` and `rune.helpText()` in run lifecycle**

Add to `test/rune/isolation/runner.test.js` inside the same `describe('runeContext injection')` block:

```js
it('exposes rune.argsSchema() with the parsed args schema during run()', async () => {
  const f = join(tmp, 'rune.js')
  await writeFile(f, `
    import { section, rune } from '@utils'
    export function args(b) {
      return b.option('--count <n>', 'Count', 1)
    }
    export async function run() {
      const s = rune.argsSchema()
      return section.create('result', { type: 'markdown', content: JSON.stringify(s?.options?.[0]?.flags ?? null) })
    }
  `)
  const effective = { allow: [], deny: [] }
  const result = await runRuneInIsolate(f, effective, [], tmp, { runeKey: 'test-rune' })
  expect(result.sections[0].data.content).toBe('"--count <n>"')
})

it('exposes rune.helpText() as non-empty string when args() is defined', async () => {
  const f = join(tmp, 'rune.js')
  await writeFile(f, `
    import { section, rune } from '@utils'
    export function args(b) {
      return b.option('--verbose', 'Verbose output', false)
    }
    export async function run() {
      return section.create('result', { type: 'markdown', content: rune.helpText().length > 0 ? 'yes' : 'no' })
    }
  `)
  const effective = { allow: [], deny: [] }
  const result = await runRuneInIsolate(f, effective, [], tmp, { runeKey: 'test-rune' })
  expect(result.sections[0].data.content).toBe('yes')
})

it('rune.commandsSchema() returns null during run lifecycle', async () => {
  const f = join(tmp, 'rune.js')
  await writeFile(f, `
    import { section, rune } from '@utils'
    export async function run() {
      return section.create('result', { type: 'markdown', content: rune.commandsSchema() === null ? 'null' : 'not-null' })
    }
  `)
  const effective = { allow: [], deny: [] }
  const result = await runRuneInIsolate(f, effective, [], tmp, { runeKey: 'test-rune' })
  expect(result.sections[0].data.content).toBe('null')
})

it('help.text() still works as deprecated alias', async () => {
  const f = join(tmp, 'rune.js')
  await writeFile(f, `
    import { section } from '@utils'
    import { help } from '@utils'
    export function args(b) {
      return b.option('--verbose', 'Verbose', false)
    }
    export async function run() {
      return section.create('result', { type: 'markdown', content: help.text().length > 0 ? 'yes' : 'no' })
    }
  `)
  const effective = { allow: [], deny: [] }
  const result = await runRuneInIsolate(f, effective, [], tmp, { runeKey: 'test-rune' })
  expect(result.sections[0].data.content).toBe('yes')
})
```

- [ ] **Step 5: Run the new tests to verify they pass**

```bash
cd crunes-cli && npx vitest run test/rune/isolation/runner.test.js --reporter=verbose 2>&1 | tail -30
```

Expected: all new tests PASS.

- [ ] **Step 6: Add tests for repl lifecycle in `repl-session.test.js`**

Open `test/rune/isolation/repl-session.test.js` and check the existing pattern for how repl runes are tested (look for `runReplSession` or similar import). Then add:

```js
it('exposes rune.argsSchema() during repl lifecycle', async () => {
  const f = join(tmp, 'rune.js')
  await writeFile(f, `
    import { section, rune } from '@utils'
    export function argsRepl(b) {
      return b.option('--db <path>', 'DB path', './state')
    }
    export async function inputRepl(input) {
      if (input.type === 'line' && input.text === 'schema') {
        const s = rune.argsSchema()
        section.emit('result', { type: 'markdown', content: JSON.stringify(s?.options?.[0]?.flags ?? null) })
      }
      return { type: 'done' }
    }
  `)
  // Use the existing test helper pattern from this file to start the session,
  // send 'schema', collect sections, end session.
  // Assert sections[0].data.content === '"--db <path>"'
})

it('exposes rune.commandsSchema() during repl lifecycle', async () => {
  const f = join(tmp, 'rune.js')
  await writeFile(f, `
    import { section, rune } from '@utils'
    export function commandsRepl(b) {
      return b.command('tables', 'List tables')
    }
    export async function inputRepl(input) {
      if (input.type === 'line' && input.text === 'cmds') {
        const s = rune.commandsSchema()
        section.emit('result', { type: 'markdown', content: JSON.stringify(s?.commands?.[0]?.name ?? null) })
      }
      return { type: 'done' }
    }
  `)
  // Use the existing test helper pattern from this file.
  // Assert sections[0].data.content === '"tables"'
})
```

**Important:** Before writing these tests, read `test/rune/isolation/repl-session.test.js` (first 80 lines) to see exactly what helper is used to start sessions and how to send input + collect sections. Fill in the pattern — do NOT leave placeholders.

- [ ] **Step 7: Run the full test suite**

```bash
cd crunes-cli && npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
cd crunes-cli && git add src/rune/isolation/utils-bootstrap.js test/rune/isolation/runner.test.js test/rune/isolation/repl-session.test.js
git commit -m "feat(sandbox): add rune.key/argsSchema/commandsSchema/helpText/helpSection; deprecate help namespace"
```

---

### Task 3: Update type definitions

**Files:**
- Modify: `src/rune/api/types-utils/rune.d.ts`
- Modify: `src/rune/api/types-utils/help.d.ts`
- Modify: `src/rune/api/types-lifecycle/lifecycle.d.ts`

**Interfaces:**
- Consumes: nothing from prior tasks (types only)
- Produces: updated `.d.ts` files matching the implemented API

- [ ] **Step 1: Update `rune.d.ts` — add self-inspection methods and schema types**

At the end of `declare namespace rune { ... }` (before the closing `}`), add:

```ts
  /** Returns the current rune's key (e.g. 'my-rune' or 'myplugin:my-rune'). null in bootstrap contexts. */
  function key(): string | null

  /** Returns the formatted CLI help text for the current rune. Empty string if no args schema is defined. */
  function helpText(): string

  /** Creates a markdown section containing the formatted CLI help text. */
  function helpSection(): RuneSection

  /**
   * Returns the raw arg schema object for the current rune.
   * Source is args() during run lifecycle, argsRepl() during repl lifecycle.
   * null if the rune exports no args/argsRepl function.
   */
  function argsSchema(): ArgSchema | null

  /**
   * Returns the raw commandsRepl schema for the current rune.
   * null during run lifecycle or if commandsRepl() is not exported.
   */
  function commandsSchema(): ArgSchema | null

  /** Root-level arg schema returned by argsSchema() and commandsSchema(). */
  interface ArgSchema {
    options:     { flags: string; description: string; def?: any }[]
    positionals: { spec: string; description: string }[]
    examples:    { usage: string; description: string }[]
    commands:    CommandSchema[]
  }

  /** Subcommand schema — same as ArgSchema but with a name and description. */
  interface CommandSchema extends ArgSchema {
    name:        string
    description: string
  }
```

- [ ] **Step 2: Update `help.d.ts` — mark both methods deprecated**

Replace the file content with:

```ts
declare namespace help {
  /** @deprecated Use rune.helpText() instead. */
  export function text(): string

  /** @deprecated Use rune.helpSection() instead. */
  export function section(): RuneSection
}
```

- [ ] **Step 3: Update `lifecycle.d.ts` — add `CommandBuilder`, update `commandsRepl`, fix `ParsedArgs`**

Add `CommandBuilder` interface after `ArgBuilder`:

```ts
  /** Fluent builder for declaring REPL slash commands. Only .command() at root is meaningful — .option(), .positional(), .example() at root are ignored by the runtime. */
  interface CommandBuilder {
    command(name: string, description: string, callback?: (sub: ArgBuilder) => void): this
    build(): any
  }
```

Change the `commandsRepl` signature from:
```ts
  function commandsRepl(builder: ArgBuilder): void | ArgBuilder | any | Promise<void | ArgBuilder | any>
```
to:
```ts
  function commandsRepl(builder: CommandBuilder): void | CommandBuilder | any | Promise<void | CommandBuilder | any>
```

Fix `ParsedArgs.$command` and `$commands` from optional to required (they are always set now — per the previous `args-parser.js` fix):
```ts
  interface ParsedArgs extends Record<string, any> {
    _: string[]
    $rest: string[]
    $raw: string[]
    /** Space-separated matched command path. Empty string at root level. Always present. */
    $command: string
    /** Array of matched command path levels. Empty array at root level. Always present. */
    $commands: string[]
  }
```

- [ ] **Step 4: Build to verify no type/compile errors**

```bash
cd crunes-cli && npm run build 2>&1 | tail -10
```

Expected: build succeeds (esbuild bundles `.js` files, `.d.ts` files are not compiled — this verifies the JS side builds clean).

- [ ] **Step 5: Run full test suite**

```bash
cd crunes-cli && npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd crunes-cli && git add src/rune/api/types-utils/rune.d.ts src/rune/api/types-utils/help.d.ts src/rune/api/types-lifecycle/lifecycle.d.ts
git commit -m "types(rune): add ArgSchema/CommandSchema/CommandBuilder; deprecate help; fix ParsedArgs"
```
