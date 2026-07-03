# Non-interactive Create Defaults Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop `crunes create` and `crunes plugin create` from hard-failing in non-interactive/agent sessions when `--format`/`--description` are omitted — default them instead, with an info message noting the default was applied.

**Architecture:** Two independent handler-only changes in `crunes-cli`. `src/rune/commands/create.js`'s non-interactive branch defaults an omitted `--format` to `'markdown'` (an explicitly-passed invalid value still errors). `src/plugin/commands/create.js`'s non-interactive branch defaults an omitted `--description` to `` `${name} — a crunes plugin` ``. Neither touches `program.js`'s CLI flag registration or the interactive (`select()`/`text()`) prompts.

**Tech Stack:** Node.js ESM, vitest.

## Global Constraints

- All work happens inside `crunes-cli/` — independent git repository; all git operations run there.
- Never run `npm test`/build scripts from the monorepo root.
- TDD mandatory: write the failing test, watch it fail, then write minimal code to pass.
- Interactive mode (`isNonInteractive === false`) must be completely unaffected by both changes.
- An explicitly-passed invalid `--format` value must still error — only an *omitted* value gets defaulted.
- `pluginJson()`'s hardcoded `runes.example.description` / `templates['example-template'].description` literals are untouched — out of scope per the spec.
- `template create` is untouched — no avoidable hard-fail exists there.

---

### Task 1: `rune create --format` defaults to `'markdown'` when omitted

**Files:**
- Modify: `crunes-cli/src/rune/commands/create.js:70-78`
- Modify: `crunes-cli/test/rune/commands/create.test.js:79-89`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing consumed by later tasks — independent of Task 2.

- [ ] **Step 1: Replace the stale test asserting the old hard-fail-on-omission behavior**

In `crunes-cli/test/rune/commands/create.test.js`, replace the `describe('validation', ...)` block (lines 72-90):

```javascript
  describe('validation', () => {
    it('exits 1 when key is missing', async () => {
      await expect(handler({ format: 'markdown', yes: true, projectRoot: tmp, configRoot: tmp }))
        .rejects.toThrow('process.exit(1)')
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('exits 1 when format is missing', async () => {
      await expect(handler({ key: 'myrune', yes: true, projectRoot: tmp, configRoot: tmp }))
        .rejects.toThrow('process.exit(1)')
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('exits 1 when format is invalid', async () => {
      await expect(handler({ key: 'myrune', format: 'xml', yes: true, projectRoot: tmp, configRoot: tmp }))
        .rejects.toThrow('process.exit(1)')
      expect(exitSpy).toHaveBeenCalledWith(1)
    })
  })
```

with:

```javascript
  describe('validation', () => {
    it('exits 1 when key is missing', async () => {
      await expect(handler({ format: 'markdown', yes: true, projectRoot: tmp, configRoot: tmp }))
        .rejects.toThrow('process.exit(1)')
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('exits 1 when format is invalid', async () => {
      await expect(handler({ key: 'myrune', format: 'xml', yes: true, projectRoot: tmp, configRoot: tmp }))
        .rejects.toThrow('process.exit(1)')
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('defaults format to markdown and prints an info message when format is omitted', async () => {
      const { output } = await import('../../../src/shared/output.js')
      const infoSpy = vi.spyOn(output, 'info').mockImplementation(() => {})
      await handler({ key: 'myrune', yes: true, projectRoot: tmp, configRoot: tmp })
      expect(existsSync(join(tmp, '.crunes', 'runes', 'myrune.js'))).toBe(true)
      const content = readFileSync(join(tmp, '.crunes', 'runes', 'myrune.js'), 'utf8')
      expect(content).toContain('md.h3')
      expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('markdown'))
      infoSpy.mockRestore()
    })
  })
```

(`content).toContain('md.h3')` distinguishes the markdown template from the tree template — per `template(key, format)` in `create.js:8-56`, only the markdown branch emits `md.h3(...)`.)

- [ ] **Step 2: Run the tests to verify the new test fails**

Run: `cd crunes-cli && npx vitest run test/rune/commands/create.test.js`
Expected: FAIL — `'defaults format to markdown...'` fails because `handler()` still exits 1 when `format` is omitted (the file scaffold never happens, so `existsSync(...)` never gets checked — the process.exit throw surfaces first).

- [ ] **Step 3: Implement the minimal fix in `create.js`**

In `crunes-cli/src/rune/commands/create.js`, replace lines 70-78:

```javascript
  if (isNonInteractive) {
    if (!key) {
      output.error('Missing required argument: <key>')
      process.exit(1)
    }
    if (!format || !VALID_FORMATS.includes(format)) {
      output.error(`Missing or invalid --format. Must be one of: ${VALID_FORMATS.join(', ')}`)
      process.exit(1)
    }
```

with:

```javascript
  if (isNonInteractive) {
    if (!key) {
      output.error('Missing required argument: <key>')
      process.exit(1)
    }
    if (format && !VALID_FORMATS.includes(format)) {
      output.error(`Invalid --format. Must be one of: ${VALID_FORMATS.join(', ')}`)
      process.exit(1)
    }
    if (!format) {
      format = 'markdown'
      output.info('--format not specified, defaulting to "markdown"')
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd crunes-cli && npx vitest run test/rune/commands/create.test.js`
Expected: PASS — all tests in this file green, including the retained `'exits 1 when key is missing'` and `'exits 1 when format is invalid'` tests (neither touched the omitted-format path).

- [ ] **Step 5: Run full test suite**

Run: `cd crunes-cli && npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
cd crunes-cli
git add src/rune/commands/create.js test/rune/commands/create.test.js
git commit -m "feat(create): default --format to markdown in non-interactive mode when omitted"
```

---

### Task 2: `plugin create --description` defaults to `"<name> — a crunes plugin"` when omitted

**Files:**
- Modify: `crunes-cli/src/plugin/commands/create.js:134-138`
- Modify: `crunes-cli/test/plugin/commands/create.test.js:85-95`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing consumed by later tasks — independent of Task 1.

- [ ] **Step 1: Replace the stale test asserting the old hard-fail-on-omission behavior**

In `crunes-cli/test/plugin/commands/create.test.js`, replace the `describe('validation', ...)` block (lines 85-95):

```javascript
  describe('validation', () => {
    it('exits 1 when name is missing', async () => {
      await expect(handler({ description: 'x', yes: true })).rejects.toThrow('process.exit(1)')
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('exits 1 when description is missing', async () => {
      await expect(handler({ name: 'x', yes: true })).rejects.toThrow('process.exit(1)')
      expect(exitSpy).toHaveBeenCalledWith(1)
    })
  })
```

with:

```javascript
  describe('validation', () => {
    it('exits 1 when name is missing', async () => {
      await expect(handler({ description: 'x', yes: true })).rejects.toThrow('process.exit(1)')
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('defaults description and prints an info message when description is omitted', async () => {
      const tmp = makeTmp()
      const out = join(tmp, 'my-plugin')
      const { output } = await import('../../../src/shared/output.js')
      const infoSpy = vi.spyOn(output, 'info').mockImplementation(() => {})
      try {
        await handler({ name: 'my-plugin', out, yes: true })
        const mj = JSON.parse(readFileSync(join(out, '.crunes-plugin', 'marketplace.json'), 'utf8'))
        expect(mj.description).toBe('my-plugin — a crunes plugin')
        expect(mj.plugins[0].description).toBe('my-plugin — a crunes plugin')
        const readme = readFileSync(join(out, 'README.md'), 'utf8')
        expect(readme).toContain('my-plugin — a crunes plugin')
        expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('my-plugin — a crunes plugin'))
      } finally {
        infoSpy.mockRestore()
        rmSync(tmp, { recursive: true, force: true })
      }
    })
  })
```

(Confirmed against `marketplaceJson()` at `create.js:31-46`: the top-level `description` field and `plugins[0].description` both receive the same `description` value, so both assertions apply. Confirmed against `readmeMd()` at `create.js:110-112`: `` `# ${name}\n\n${description}\n\n...` `` — the description string appears verbatim in the README body.)

- [ ] **Step 2: Run the tests to verify the new test fails**

Run: `cd crunes-cli && npx vitest run test/plugin/commands/create.test.js`
Expected: FAIL — `'defaults description...'` fails because `handler()` still exits 1 when `description` is omitted (`process.exit(1)` throws before any file is written).

- [ ] **Step 3: Implement the minimal fix in `create.js`**

In `crunes-cli/src/plugin/commands/create.js`, replace lines 134-138:

```javascript
  if (isNonInteractive) {
    if (!name) { output.error('Missing required argument: <name>'); process.exit(1) }
    if (!description) { output.error('Missing required option: --description'); process.exit(1) }
    author = author ?? getGitAuthor()
    license = license ?? 'MIT'
```

with:

```javascript
  if (isNonInteractive) {
    if (!name) { output.error('Missing required argument: <name>'); process.exit(1) }
    if (!description) {
      description = `${name} — a crunes plugin`
      output.info(`--description not specified, defaulting to "${description}"`)
    }
    author = author ?? getGitAuthor()
    license = license ?? 'MIT'
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd crunes-cli && npx vitest run test/plugin/commands/create.test.js`
Expected: PASS — all tests in this file green, including the retained `'exits 1 when name is missing'` test (untouched by this change) and all the pre-existing snapshot/file-scaffolding tests (none of them omit `description` — they all use `BASE_OPTS`, which includes `description: 'A test plugin'`).

- [ ] **Step 5: Run full test suite**

Run: `cd crunes-cli && npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
cd crunes-cli
git add src/plugin/commands/create.js test/plugin/commands/create.test.js
git commit -m "feat(plugin/create): default --description to a generated placeholder in non-interactive mode when omitted"
```

---

## Final Verification

After both tasks are committed:

- [ ] Run `cd crunes-cli && npm test` — full suite green.
- [ ] Run `cd crunes-cli && npm run build && node dist/cli.js --help` — matches this project's CI-equivalent check.
- [ ] Manual check: `node dist/cli.js create my-rune --yes` (no `--format`, run from a scratch/tmp project dir with a `.crunes/config.json`) — succeeds, scaffolds a markdown-style rune, prints the info message.
- [ ] Manual check: `node dist/cli.js plugin create my-plugin --yes` (no `--description`, run from a scratch/tmp dir) — succeeds, both `marketplace.json` and `README.md` contain `"my-plugin — a crunes plugin"`, prints the info message.
