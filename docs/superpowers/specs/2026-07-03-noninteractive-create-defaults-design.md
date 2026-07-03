# Non-interactive create defaults — design

Date: 2026-07-03
Package: `crunes-cli`

## Background

`crunes create` (scaffold a rune) and `crunes plugin create` (scaffold a plugin) both hard-fail
in non-interactive/agent sessions when a flag is omitted, even though a sensible default exists
for each. This was flagged during a broader review of `create.js`'s non-interactive requirements
(`src/rune/commands/create.js:70-78`, `src/plugin/commands/create.js:134-138`).

Investigated and ruled out during brainstorming:
- `template create` only requires `name` (unavoidable — it's the scaffold's key), so it's out of
  scope; nothing there can be defaulted.
- Whether `--description` should also be wired into the scaffolded example rune's
  `plugin.json runes.example.description` (currently a hardcoded literal, disconnected from
  `--description` entirely) — decided this is out of scope; that literal stays as-is.
- Whether `--description` should stay required (plugin authoring is a rarer, more deliberate
  action than rune authoring) — decided a default is still worth adding, not left required.

## Scope

Two independent handler-only changes, no CLI flag registration changes (`program.js` untouched),
no interactive-mode changes (`select()`/`text()` prompts stay exactly as they are today):

1. `src/rune/commands/create.js` — `--format` gets a default in non-interactive mode.
2. `src/plugin/commands/create.js` — `--description` gets a default in non-interactive mode.

## 1. `rune create --format` defaults to `'markdown'`

Confirmed in `src/rune/commands/create.js:70-78`:
```javascript
if (isNonInteractive) {
  if (!key) { ... }
  if (!format || !VALID_FORMATS.includes(format)) {
    output.error(`Missing or invalid --format. Must be one of: ${VALID_FORMATS.join(', ')}`)
    process.exit(1)
  }
}
```
`VALID_FORMATS = ['tree', 'markdown']`. The interactive `select()` prompt lists `tree` first
(cursor-order only, not a stated preference) — `markdown` is the more general-purpose shape
(most rune output is prose/lists/tables, not literal tree structures) and is what the intro
docs' own Anatomy-of-a-Rune example now uses.

**Fix:** split the omitted-vs-invalid cases. An explicitly-passed invalid value (e.g.
`--format json`) is a real user mistake and must still error. An *omitted* `--format` defaults to
`'markdown'` and prints a note:
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
}
```

## 2. `plugin create --description` defaults to `"<name> — a crunes plugin"`

Confirmed in `src/plugin/commands/create.js:134-138`:
```javascript
if (isNonInteractive) {
  if (!name) { output.error('Missing required argument: <name>'); process.exit(1) }
  if (!description) { output.error('Missing required option: --description'); process.exit(1) }
  author = author ?? getGitAuthor()
  license = license ?? 'MIT'
}
```
`author`/`license` already default silently (git config / `'MIT'`) — `description` is the only
remaining hard-required field with no fallback.

Traced every consumer of this value before deciding on a placeholder (full trace, not just
marketplace display):
- `marketplaceJson()` (`create.js:31-46`) — writes it as the top-level `description` field in
  `.crunes-plugin/marketplace.json`.
- `readmeMd()` (`create.js:110-112`) — writes it as the second line of the generated
  `README.md`, directly under the `# ${name}` heading.
- `src/marketplace/commands/browse.js:22`, `search.js:12` — display it in
  `crunes marketplace browse`/`search` listings.
- `src/marketplace/marketplace.js:216,251` — included in the lowercase search-matching string
  and passed through as plugin metadata.
- `src/plugin/commands/list.js` (installed-plugins view) — does **not** print description at all
  (only `key` and `version`), so an installed plugin's description is never surfaced there.
- `pluginJson()` (`create.js:7-29`) — receives a `description` parameter but never uses it; the
  scaffolded example rune's own `description` is an unrelated hardcoded literal
  (`'Replace with your rune description'`), confirmed out of scope for this spec.
- No validation, length constraint, or required-field enforcement exists on this value anywhere
  in `src/marketplace/*.js` or `src/plugin/manifest.js` — it is purely display text.
- The real, shipped `crunes-plugins` repo's `git` plugin uses a genuine short description
  (`"Git context runes"`) at the marketplace level, and its README opens with a real descriptive
  sentence — confirming terse-but-real text is the normal convention here, which is why a
  placeholder needs to at least read as plausible prose rather than an internal TODO marker.

**Fix:**
```javascript
if (isNonInteractive) {
  if (!name) { output.error('Missing required argument: <name>'); process.exit(1) }
  if (!description) {
    description = `${name} — a crunes plugin`
    output.info(`--description not specified, defaulting to "${description}"`)
  }
  author = author ?? getGitAuthor()
  license = license ?? 'MIT'
}
```

## Non-goals

- Not changing `program.js`'s CLI flag registration (no `Option.default(...)`) — interactive mode
  keeps prompting for both `--format` and `--description` exactly as today; only the
  non-interactive branch changes.
- Not touching `pluginJson()`'s hardcoded `runes.example.description` /
  `templates['example-template'].description` literals.
- Not touching `template create` — no avoidable hard-fail exists there.

## Verification plan

- `npx vitest run test/rune/commands/create.test.js test/plugin/commands/create.test.js` (or
  equivalent existing test files) after adding cases for: omitted `--format` in non-interactive
  mode produces a `'markdown'`-templated file and an info message; an explicitly invalid
  `--format` still errors; omitted `--description` in non-interactive `plugin create` produces
  the `"<name> — a crunes plugin"` string in both `marketplace.json` and `README.md`, plus an
  info message.
- `npm test` full suite green.
- Manual check: `node dist/cli.js create my-rune --yes` (no `--format`) succeeds and scaffolds a
  markdown-style rune; `node dist/cli.js plugin create my-plugin --yes` (no `--description`)
  succeeds and both generated files contain the defaulted description text.
