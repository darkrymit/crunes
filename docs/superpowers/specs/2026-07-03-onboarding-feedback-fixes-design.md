# Onboarding feedback fixes — design

Date: 2026-07-03
Package: `crunes-cli`

## Background

A cold-start onboarding session (no crunes Claude Code plugin/skill available — only
`crunes --help`, `crunes docs`, and a sibling project's runes as reference) produced a
feedback report listing friction points hit while building a rune. Because that report came
from an unreliable agent, every claim was independently re-verified against `crunes-cli`
source before any fix was proposed, and each proposed fix was confirmed with the project
owner item-by-item before being included here. All 9 claims turned out to reflect real,
current behavior — none were stale or misdiagnosed. File/line citations are given per item
below.

A prior spec attempt (`2026-07-03-intro-compiler-fixes-design.md`) treated item 6 as "both
config shapes are intentionally supported, just reorder the docs." That conclusion was
wrong — confirmed with the project owner that the top-level sibling `permissions`/`vars`
maps are an unintended side effect of the config-merge implementation, not a supported
feature, and should be silently removed rather than documented. That spec has been deleted
and replaced by this one.

## Scope

Two independent parts:

- **Part A** — documentation-only fixes (items 1–5, 7, 8, 9). Static text/code-sample edits
  to `src/docs/intro-compiler.js` and `src/rune/api/types-utils/env.d.ts`. No behavior
  changes.
- **Part B** — a real bug fix (item 6). Removes an unintended dual config shape from
  `src/core/config.js` and its two call sites in `src/rune/resolver.js` /
  `src/docs/commands/rune.js`. This changes behavior and needs test coverage per this
  project's TDD requirement.

Out of scope: adding `--help` interception to `crunes run` (item 1) — the report frames
this as a choice between two valid resolutions, and the source shows the current behavior
(rune authors handle `--help` themselves) is a deliberate, working design, not an accidental
gap. This spec documents it loudly instead of changing it.

Also out of scope: a standalone new example rune under `examples/` for item 8 — instead, the
dynamic `args()` pattern gets folded directly into the existing "Anatomy of a Rune" code
sample inside `intro-compiler.js`, per project owner's preference.

---

## Part A — Documentation fixes

All edits are to `src/docs/intro-compiler.js` (a ~344-line function that pushes static
markdown lines into an array — `compileIntro()`) unless noted otherwise. No parsing,
help-rendering, or permission behavior changes; only text/example content changes.

### 1. `crunes run <rune> --help` silently runs the rune

Confirmed in `src/rune/commands/run.js`: `handler()` has no `--help`/`-h` special-casing
anywhere in parsing or dispatch. An unrecognized `--help` token is not consumed by
`args-parser.js`, so the rune executes for real.

**Fix:** add a callout in "2. CLI Calling & Argument Conventions" (near the 3-tier parsing
boundary) stating plainly that `--help`/`-h` are not intercepted by `crunes run`, and that
rune authors must declare their own help option and check it in `run(args)`. Point to
`crunes docs rune <key>` as the actual way to preview a rune's CLI surface without executing
it.

**Additionally** (per project owner): update the "Anatomy of a Rune" run-mode code sample
(section 1) itself to declare a `-h, --help` option and check it at the top of `run(args)`,
returning `rune.helpSection()` — so an agent that copies the example gets correct `--help`
handling by default, not just a prose warning elsewhere.

### 2. `rune.helpSection()`/`helpText()` always render the whole command tree

Confirmed in `src/rune/isolation/runner.js:1409-1411`: `getArgsSchema` returns the top-level
schema for the whole rune, and `formatHelp(schema, ...)` (`src/docs/formatter.js:48`) is
called once with no path-scoping parameter. `utils-bootstrap.js:1878` exposes one
precomputed `__runeHelpText` string. There is no scoped-to-one-subcommand variant.

**Fix:** add a one-line prose note wherever `helpSection()`/`helpText()` are introduced
(the Rune Exports API Reference section, generated from `lifecycle-api.json`): "always
renders the full rune command tree, not scoped to the matched subcommand — there is
currently no way to get help for just one subcommand."

### 3. `ShellResult` uses `exitCode`/`ok`, not `code` — and the intro's own example gets it wrong

Confirmed in `src/rune/api/shell.js:7-12,193-217`: the resolved object has `exitCode`
(number) and `ok` (boolean, `exitCode === 0`). No `code` field exists. `exec()`'s default
`{ throw: true }` means a non-zero exit **throws** a `ShellError` — passing `{ throw: false
}` is what returns `{ stdout, stderr, exitCode, ok }` for the caller to check.

The existing `shell` namespace recipe (`NAMESPACE_RECIPES.shell`, `intro-compiler.js:126-139`)
currently does `const stdout = await shell.exec(...)` and uses `stdout` directly as if
`exec()` resolves to a bare string — this is itself wrong/misleading and is exactly the
example a rune author would copy.

**Fix:** rewrite the recipe to show the non-throwing check pattern:
```javascript
import { shell, section } from '@utils'

export async function run() {
  const result = await shell.exec('git status --short', { throw: false })
  if (!result.ok) {
    return section.create('git-status', { type: 'markdown', content: `Failed (exit ${result.exitCode}): ${result.stderr}` })
  }
  return section.create('git-status', { type: 'markdown', content: `\`\`\`\n${result.stdout}\n\`\`\`` })
}
```

### 4. Unmatched subcommand token falls through to `$rest`, not `$command`

Confirmed in `src/rune/api/args-parser.js:89-117`: the command-matching loop only advances
`commandsMatched` on an exact name match; a non-matching token breaks the loop and flows
through into `args._`, then into `$rest` via `mapPositionals` since nothing consumes it.

**Fix:** add one line immediately after the existing `$command`/`$commands`/`$rest` bullets
in "Custom Commands & Nested Parameters Mapping":
> An unrecognized subcommand does not populate `$command` — it falls through to the root
> (`$command === ''`) with the unmatched token in `$rest`. To report "unknown command,"
> check `args.$command === '' && args.$rest.length > 0`.

### 5. `env.read` works without a `<source>::` prefix — undocumented

Confirmed in `src/rune/permissions/permissions-env.js:3-19`: when the pattern body has no
`::`, `parseEnvPattern` treats the whole body as `keyPatterns` and defaults `sources` to
`['*']` (matches any source). This is a fully supported, intentional form — not a
side-effect or legacy path.

**Fix:** edit `src/rune/api/types-utils/env.d.ts` (the true source of the generated
`docs/generated/utils-api.json`, compiled via `typedoc` in `npm run build`) to state both
forms explicitly, and clarify where each value actually originates:
> Requires `env.read:<key>` (matches the key from any source) or the source-scoped
> `env.read:<source>::<key>` (where `<source>` is `process` or a `.env` filename, e.g.
> `.env`) permission. `*` matches any characters in the key (e.g. `env.read:process::GITHUB_*`
> or `env.read:GITHUB_*`).

Apply this to both the `read()` and `has()` JSDoc blocks (lines 5 and 13).

### 7. `crunes create` requires `--format` with no shown invocation example

Confirmed in `src/rune/commands/create.js:70-78`: in non-interactive mode (`--yes` or
non-TTY — the mode an agent session runs in), `format` is mandatory with no default and
errors immediately if missing/invalid (`VALID_FORMATS` = `tree`/`markdown`).

**Fix:** add a concrete invocation example, e.g. `crunes create my-rune --format markdown
--path .crunes/runes/my-rune.js --yes`, immediately before the "Anatomy of a Rune" code
samples in section 1, so the first thing shown is how a rune file actually gets scaffolded
before its contents are discussed.

### 8. No example of a dynamic `args()` builder reading `vars`/`env` at schema-build time

The intro's only `args()` examples use static `.option()` chains. No example shows reading
config-time data (`vars`) to compute option choices/defaults — an extremely common
real-world pattern (any "profile"/"environment" concept needs it).

Confirmed exact API in `src/rune/api/vars.js`: `vars.read(key, fallback)` and `vars.has(key)`
are **synchronous**, not async.

**Fix (per project owner):** fold this into the existing "Anatomy of a Rune" run-mode
example in section 1 (not a separate example file) — extend the sample's `args(builder)` to
read a `vars`-backed list of deployment profiles and expose it as a `--profile` option
alongside the existing `--verbose` and `remote add` command structure:
```javascript
import { vars, rune } from '@utils'

export function args(builder) {
  const profiles = vars.read('deploy_profiles', ['staging', 'production'])
  return builder
    .option('-h, --help', 'Show help')
    .option('--profile <name>', `Deployment profile (${profiles.join('|')})`, profiles[0])
    .option('--verbose', 'Verbose output', false)
    .command('remote', 'Manage git remotes', remote => {
      remote.command('add', 'Add a remote', add => {
        add.positional('<name>', 'Remote name')
           .positional('<url>', 'Remote URL')
      })
    })
}

export async function run(args) {
  if (args.help) return rune.helpSection()
  if (args.$command === 'remote add') {
    return `Adding remote ${args.name} at ${args.url}`
  }
}
```
(Exact final wording/imports to be reconciled with item 1's `--help`-handling addition to
this same sample during implementation, since both touch it.)

### 9. `.crunes/.gitignore` scaffold isn't mentioned in docs

Confirmed in `src/core/commands/init.js:7,40-49`: `crunes init` silently writes a
`.gitignore` covering `config.local.json`, `project.local.json`, `logs/`, `caches/`,
`schemas/`, `sqlite/`, `jobs/` — the success output never mentions it.

**Fix:** add one sentence to the "Configuration Reference" intro (section 3, right after
the opening paragraph): "`crunes init` also scaffolds a `.crunes/.gitignore` covering
local-only files (`config.local.json`, `project.local.json`) and generated directories
(`logs/`, `caches/`, `schemas/`, `sqlite/`, `jobs/`) — only `config.json` and your rune `.js`
files need to be committed."

---

## Part B — Remove the config sibling-map duality (item 6)

### Problem

Confirmed in `src/core/config.js`:
- `mergeConfigs` step 2 (lines 19-33) merges `vars` **nested inside** each `runes.<key>`
  entry — the intended, documented shape.
- `mergeConfigs` step 3 (lines 35-46) and step 4 (lines 48-51) **also** merge a **top-level**
  `vars`/`permissions` map keyed by rune name (sibling of `runes`) — this is the
  accidental/undocumented shape.
- `validateConfig`'s first block (lines 63-74) validates the top-level `permissions` map;
  its second block (lines 76-93) validates the nested `runes[key].permissions` shape.

Both shapes are live, independently-merged code paths today. `docs intro` shows both,
back-to-back, with no indication that only one is intended — this was the single biggest
time sink in the feedback report (a full config was built from the top-level shape before
discovering, only by reading a sibling project's file, that the nested shape is the one
that matters in practice).

Confirmed with the project owner: the top-level sibling maps were never an intended
feature — a bug, not a convention — and must be **silently dropped**, not documented as
deprecated/legacy.

### The one legitimate use case this removal affects

For **plugin** runes (key form `pluginName:runeKey`, resolved via `resolvePluginRune` /
`resolveRuneFromPlugins` in `src/rune/resolver.js`), there is no `runes.<key>` project-side
entry at all — a plugin rune's permissions come from the plugin's own `plugin.json`, with
only the top-level `config.permissions?.['pluginName:runeKey']` / `config.vars?.[...]`
as the existing mechanism for a project to grant extra permissions/vars to a plugin rune.
Confirmed at `src/rune/resolver.js:101-102,120-121,142-143,157,188,194,217,237,243`.

**Resolution (per project owner):** since `getRune(config, key)` (`resolver.js:12-16`) does
a flat lookup on `config.runes[key]`, and `key` can already be any string — including one
containing a colon — a project can add an entry keyed by the **fully-qualified**
`"pluginName:runeKey"` string directly under `runes` in `config.json`, with `vars`/
`permissions` nested inside exactly like a local rune:
```json
{
  "runes": {
    "my-plugin:deploy": {
      "vars": { "region": "us-east-1" },
      "permissions": {
        "run": { "allow": ["fs.read:src/**"] }
      }
    }
  }
}
```
This reuses the existing nested convention rather than inventing a new one.

### Changes

1. **`src/core/config.js`**
   - `mergeConfigs`: remove step 3 (top-level `vars` merge) and step 4 (top-level
     `permissions` merge) entirely. Remove `'vars'` and `'permissions'` from step 1's
     exclusion list (line 13) so a stray top-level `permissions`/`vars` key — unwanted,
     unsupported — is treated like any other unrecognized primitive: no special merge
     semantics, no interpretation, local just overwrites shared like everything else. Step 2
     (nested `runes` merge) and step 5 (plugins union) are untouched — `config.json` +
     `config.local.json` merging for `runes.<key>` entries stays exactly as-is.
   - `validateConfig`: remove the top-level `config.permissions` validation block (lines
     63-74). Keep the `runes[key].permissions` nested validation block (lines 76-93)
     unchanged.

2. **`src/rune/resolver.js`** — for each of the 3 plugin-rune-resolution call sites
   (`resolvePluginRune` match, auto-discovered match, plugin-alias match) and the 1
   local-rune call site (`runRune`'s final branch) and the 3 equivalent sites in
   `resolveRuneEntry`:
   - **Local runes:** drop the `config.permissions?.[key]` / `config.vars?.[key]` reads
     entirely — `entry.permissions` / `entry.vars` (already read) are the sole source now.
     `computeEffectivePermissions(basePerms, undefined, lifecycle)` becomes equivalent to
     just using `basePerms.run`/`basePerms.repl` directly, per
     `src/rune/permissions/permissions.js:187-197`.
   - **Plugin runes:** replace `config.permissions?.[\`${pluginKey}:${runeKey}\`]` /
     `config.vars?.[\`${pluginKey}:${runeKey}\`]` reads with
     `config.runes?.[\`${pluginKey}:${runeKey}\`]?.permissions` /
     `config.runes?.[\`${pluginKey}:${runeKey}\`]?.vars`.

3. **`src/docs/commands/rune.js:73-74`** — same substitution (this path is local-rune-only
   via `getRune`, so both `config.permissions?.[key]` reads are simply dropped; no
   plugin-rune equivalent needed here since this file only renders local rune docs).

4. **Tests** (`test/core/config.test.js`, `test/rune/resolver.test.js`):
   - Replace tests asserting the old top-level sibling-map merge/validation behavior with
     tests asserting top-level `permissions`/`vars` are now inert, unrecognized keys: no
     special deep-merge (local's value simply overwrites shared's, like any other
     unrecognized primitive), and no validation is applied to them.
   - Add new resolver test coverage for the `runes["plugin:rune"]` override path (currently
     no test exercises the plugin-permission-override branches at all).

5. **`src/docs/intro-compiler.js`** — rewrite the "Sandbox Security & Permissions" example
   (section 3) to show **only** the nested `runes.<key>.vars`/`runes.<key>.permissions`
   shape, including a plugin-rune override example using the fully-qualified key. No mention
   of a top-level sibling map anywhere. Update the "Config File Fields Reference" bullets
   accordingly (drop the standalone `permissions`/`vars` bullets or fold them into the
   `runes` bullet's description).

### Testing plan (TDD, per project rules)

- `test/core/config.test.js`: RED test asserting `mergeConfigs`/`validateConfig` no longer
  specially interpret a top-level `permissions`/`vars` map — e.g. two configs with
  conflicting top-level `permissions` maps merge such that local's value simply overwrites
  shared's (generic primitive overwrite, no deep merge), and a malformed top-level
  `permissions` map that used to throw during validation no longer does.
- `test/rune/resolver.test.js`: RED test — a plugin rune with a project `runes["plugin:rune"]`
  entry containing `permissions.run.allow`/`vars` receives those as its effective
  permissions/vars when executed, exercising both the explicit-prefix and
  auto-discovered-bare-key resolution paths.
- Full suite (`npm test`) must stay green; `npm run build && node dist/cli.js --help` sanity
  check per this project's CI-equivalent command.

## Verification plan (both parts)

- After Part A edits: `npm run build` (regenerates `docs/generated/utils-api.json` from
  `.d.ts` sources via typedoc) then `node dist/cli.js -p docs intro` and `node dist/cli.js
  -p docs utils env` — manually confirm each of the 8 doc items appears correctly, and that
  the two JSON/code examples touched are valid and internally consistent.
- After Part B edits: `npm test` full suite green, plus the manual plugin-override scenario
  above exercised via `node dist/cli.js -p run <plugin>:<rune>` against a local test fixture
  if one is easy to construct, or covered fully by the new resolver unit test if not.
- Confirmed via a scripted check of all `examples/*/.crunes/config*.json`: none currently
  use the top-level sibling-map shape (all already use nested `runes.<key>.vars`/
  `.permissions`), so no example migration is needed as part of this change.
