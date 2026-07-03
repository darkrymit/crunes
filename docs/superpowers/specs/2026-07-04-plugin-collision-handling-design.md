# Plugin/rune name collision handling — design

Date: 2026-07-04
Package: `crunes-cli`

## Background

Two different marketplaces can each ship a plugin with the identical bare name (e.g. both
"crunes-plugins" and "my-org" offering a plugin called "git") — nothing in the system prevents
this, and both install and coexist cleanly at the registry/cache-dir/config level. The problem is
entirely in how bare (non-marketplace-qualified) references to these plugins and their runes get
resolved and reported, both at the CLI and inside `config.json`.

A full investigation (static code reading plus empirical testing against an isolated scratch
registry, `CRUNES_STORE` env override) surfaced nine concrete findings. All were reviewed
case-by-case and are folded into this design; two findings led to scope changes worth noting up
front:

- What was originally planned as a silent `config.runes` bare-key fallback (for plugin-rune
  overrides) was dropped in favor of always requiring the fully-qualified key. A silent fallback
  would mean a working override could start throwing later, purely because someone enabled an
  unrelated second same-named plugin elsewhere in the file — a config edit in one place quietly
  breaking something else. Requiring the qualified form always is stable regardless of what gets
  enabled later.
- A planned proactive "two enabled plugins share a bare name" warning (originally case 6a) was
  dropped entirely: the fixed ambiguity error message (case 3) already names both full keys
  clearly the moment a bare-name call is actually made, which covers this with no extra ceremony.

## Scope

Eight fixes, in `crunes-cli`:

1. Project-scoped resolution for bare plugin names (`run`, `repl`, `entry.plugin` alias, `disable`).
2. Plugin-rune overrides in `config.runes` always require the fully-qualified key — no fallback.
3. Ambiguity error messages always show full `marketplace@name[:rune]` forms, never stripped bare
   names or unfilled placeholders (`resolveRuneFromPlugins` and `template apply`'s equivalent).
4. A hard `validateConfig` error for structurally-dead plugin-rune override keys.
5. Intro docs: the `marketplace@plugin:rune` CLI form, the `entry.plugin` mechanism (documented
   with its real, general framing — a way to give a specific plugin rune its own project-local
   name and vars/permissions preset — with collision-disambiguation shown as one example use, not
   its dedicated purpose), and the qualified-override requirement from item 2.
6. `docs rune <key>` gains plugin-rune support via the same scoped resolution as `run`/`repl`.

Out of scope: any change to how plugins are installed, cached, or registered (all already correct
— see Verified Working below). No new CLI command for creating `entry.plugin` aliases (see
Background — the manual JSON edit is proportionate for what's already a general, occasional,
deliberate config mechanism, not something newly invented for this problem).

## Verified working today (confirmed via static read + empirical test, unaffected by this spec)

- Marketplace name uniqueness enforced at `marketplace add` time (`marketplace.js:166`).
- Plugin names are never required to be unique across marketplaces — legal and expected.
- `crunes plugin install` always requires the fully-qualified `<marketplace>@<plugin>` reference
  (`commands/install.js:14`) — no bare-name path exists here at all.
- Registry keys, cache dirs (`.crunes/plugins/<marketplace>/<name>/<version>`,
  `store/index.js:18`), and `config.plugins` entries are all namespaced by marketplace — two
  same-named plugins coexist on disk and in config with zero collision.
- `plugin list`, `marketplace browse`, `marketplace search` all display or group by the full key
  or marketplace name — a user can always see which same-named plugin is which.
- The fully-qualified `marketplace@plugin:rune` CLI syntax already works correctly end-to-end —
  confirmed by a real round trip (`crunes run my-org@git:status` executed the correct plugin's
  rune, verified by distinct output).
- A local rune registered under the same bare key as a plugin rune shadows it silently and
  correctly for the bare form, while the plugin rune stays fully reachable via its qualified form
  — confirmed empirically, this is correct, intentional-feeling behavior, not a bug.
- The `entry.plugin` alias mechanism, once manually configured, works correctly and permanently
  resolves any bare-name ambiguity with one config entry — confirmed empirically (`runes["info"] =
  { plugin: "other-market@docker-tools:info" }` correctly executed the right plugin's rune).
  `entry.vars`/`entry.permissions` on the alias entry itself are also read and applied
  (`resolver.js`'s `entry.plugin` branch), so an alias can carry its own overrides directly without
  needing a separate `config.runes` qualified-key entry at all.

## 1. Project-scoped resolution for bare plugin names

**Problem, confirmed empirically:** `resolvePluginKey(nameOrKey, registry)` (`registry.js:49-56`)
checks the *entire global registry* for bare-name ambiguity, not the current project's enabled
`config.plugins`. Reproduced: a project with only `my-org@git` enabled still gets `Ambiguous
plugin "git"` from `crunes run git:status` purely because `crunes-plugins@git` is installed
*somewhere else, in an unrelated project*. Same root cause breaks `crunes repl`, `entry.plugin`
alias resolution, and `crunes plugin disable git` identically, since all funnel through
`resolvePluginKey`/`resolvePluginRune`.

**Fix:** new `resolvePluginKeyScoped(nameOrKey, registry, enabledPlugins)` in `registry.js`:

```javascript
export function resolvePluginKeyScoped(nameOrKey, registry, enabledPlugins) {
  if (nameOrKey.includes('@')) return nameOrKey

  const allMatches = Object.keys(registry.plugins ?? {})
    .filter(k => k.slice(k.indexOf('@') + 1) === nameOrKey)
  const scopedMatches = allMatches.filter(k => enabledPlugins.includes(k))

  if (scopedMatches.length === 1) return scopedMatches[0]

  if (scopedMatches.length > 1) {
    throw new Error(`Ambiguous plugin "${nameOrKey}". Use the full key: ${scopedMatches.join(', ')}`)
  }

  // scopedMatches.length === 0
  if (allMatches.length === 0) return null
  throw new Error(
    `Plugin "${nameOrKey}" is not enabled in this project (installed as ${allMatches.join(', ')}). ` +
    `Run: crunes plugin enable ${allMatches.length === 1 ? allMatches[0] : '<one of the above>'}`
  )
}
```

`resolvePluginRune` (`resolver.js:18-44`, used by `run`, `repl`, and `entry.plugin` alias
resolution) switches its `resolvePluginKey(pluginPart, registry)` call to
`resolvePluginKeyScoped(pluginPart, registry, config.plugins ?? [])`.

`crunes plugin disable` (`commands/disable.js:8`) gets its own even-narrower resolution — it never
needs the global registry, only `config.plugins`, since disabling only makes sense for something
already enabled here:

```javascript
function resolveEnabledPluginKey(nameOrKey, enabledPlugins) {
  if (nameOrKey.includes('@')) return nameOrKey
  const matches = enabledPlugins.filter(k => k.slice(k.indexOf('@') + 1) === nameOrKey)
  if (matches.length > 1) throw new Error(`Ambiguous plugin "${nameOrKey}". Use the full key: ${matches.join(', ')}`)
  return matches[0] ?? null
}
```

`crunes plugin enable`/`update`/`uninstall` are unchanged — their existing global-registry
ambiguity check is correct as-is, since all three are inherently "pick among everything installed"
operations with no project-scoping concept to apply.

## 2. `config.runes` plugin-rune overrides always require the fully-qualified key

**Decision (see Background):** no bare-key fallback. Local rune keys are completely unaffected —
they stay bare (`runeKey`) exactly as today, since local runes have no marketplace concept at all.
Only plugin-rune override entries (keys with no `path`/`plugin` field, used purely to attach
`vars`/`permissions` to an existing plugin rune) must always be written in full
`marketplace@plugin:runeKey` form. This is unchanged from today's actual behavior — the fix here
is item 4 (validation) and item 5 (documentation), not a resolver code change.

## 3. Ambiguity error messages always show full keys

**Problem, confirmed empirically:** `resolveRuneFromPlugins` (`resolver.js:64-67`) builds its error
message from bare plugin names (`m.pluginKey.slice(m.pluginKey.indexOf('@') + 1)`). When two
colliding plugins also share a bare name, both print identically — `"status" matches runes in
multiple plugins: git, git. Use plugin:status to specify one.` — a functional dead end, since
`plugin:status` is a literal, unfilled placeholder and the "obvious" next attempt (`git:status`)
would (before item 1's fix) hit the separate global-ambiguity bug. `template apply`'s equivalent
(`template/commands/apply.js:47`) has the identical flaw.

**Fix:** both messages list the real, full `marketplace@name:rune` form for every match:

```javascript
// resolver.js — resolveRuneFromPlugins
if (matches.length > 1) {
  const options = matches.map(m => `${m.pluginKey}:${runeKey}`).join(' or ')
  throw new Error(`"${runeKey}" matches runes in multiple plugins: ${matches.map(m => m.pluginKey).join(', ')}. Use ${options} to specify one.`)
}
```

```javascript
// template/commands/apply.js
if (matches.length > 1) {
  const sources = matches.map(m => m.pluginKey).join(', ')
  const options = matches.map(m => `${m.pluginKey}:${templateName}`).join(' or ')
  output.error(`"${templateName}" matches templates in multiple sources: ${sources}. Use ${options}.`)
  process.exit(1)
}
```

(Note: `template apply`'s `matches` currently stores `pluginName` — the bare stripped name — not
the full `pluginKey`; the fix must also thread the full key through into each match object, not
just change the message string.)

## 4. Hard validation error for structurally-dead override keys

**Problem:** given item 2's decision, a `config.runes[key]` entry that has no `path` and no
`plugin` field (so it can only be interpreted as a plugin-rune override, never a valid local rune)
whose key doesn't contain `@` before its colon can *never* resolve to anything, ever — it's not a
"might be a mistake," it's structurally impossible to work. This currently fails completely
silently.

**Fix:** add this check to `validateConfig` in `core/config.js` (fully synchronous, no registry
access needed — this is pure string-shape validation against the key itself):

```javascript
if (config.runes && typeof config.runes === 'object') {
  for (const [key, entry] of Object.entries(config.runes)) {
    if (!entry || typeof entry !== 'object') continue
    if (entry.path || entry.plugin) continue // valid local rune or alias entry
    const colonIdx = key.indexOf(':')
    if (colonIdx === -1) continue // not shaped like a plugin-rune override at all
    const pluginPart = key.slice(0, colonIdx)
    if (!pluginPart.includes('@')) {
      throw new Error(
        `${fileName}: runes["${key}"] has no path or plugin, so it can only be a plugin-rune ` +
        `override — but "${pluginPart}" is missing the marketplace prefix. Use the full ` +
        `"marketplace@plugin:${key.slice(colonIdx + 1)}" form.`
      )
    }
  }
}
```

## 5. Documentation

Add to `src/docs/intro-compiler.js`'s Configuration Reference section (near the existing plugin
override example from the prior onboarding-feedback-fixes work):

- The `marketplace@plugin:rune` fully-qualified CLI form: what it's for (disambiguating two
  enabled plugins that share a bare name) and a one-line example.
- The `entry.plugin` mechanism, framed accurately as general-purpose: "give a specific plugin
  rune its own project-local name and `vars`/`permissions` preset" (e.g. a `deploy-staging` and
  `deploy-prod` entry both aliasing the same underlying plugin rune with different vars) — with
  disambiguating two same-named plugins shown as one example use of this, not its dedicated
  purpose.
- A one-line note that plugin-rune override keys in `config.runes` must always be the full
  `marketplace@plugin:rune` form (tying into item 4's validation error, so an author who hits that
  error knows exactly what the docs say to do about it).

## 6. `docs rune <key>` plugin-rune support

**Problem:** `docs/commands/rune.js` only ever calls `getRune(config, key)` — a flat
`config.runes[key]` lookup. A plugin-prefixed key (`git:status`) or a bare auto-discoverable plugin
rune key always falls into "Unknown rune," regardless of collisions.

**Fix:** mirror the resolution path `runRune` already uses (`resolver.js:97-133`), reusing existing
machinery — no new resolution logic:

```javascript
// docs/commands/rune.js, inside the per-key loop, before "Unknown rune" handling
const pluginMatch = await resolvePluginRune(config, key)
let pluginJson, runeFile, basePerms, vars, isPlugin = false

if (pluginMatch) {
  isPlugin = true
  pluginJson = await loadPluginJson(pluginMatch.pluginDir)
  runeFile = getPluginRunePath(pluginMatch.pluginDir, pluginMatch.runeKey, pluginJson)
  basePerms = pluginJson.runes[pluginMatch.runeKey]?.permissions ?? {}
  vars = pluginJson.runes[pluginMatch.runeKey]?.vars ?? {}
} else {
  const localEntry = getRune(config, key)
  if (!localEntry) {
    const autoMatch = await resolveRuneFromPlugins(config, key) // throws its own clear error on ambiguity (item 3)
    if (autoMatch) {
      isPlugin = true
      pluginJson = autoMatch.pluginJson
      runeFile = getPluginRunePath(autoMatch.pluginDir, autoMatch.runeKey, pluginJson)
      basePerms = pluginJson.runes[autoMatch.runeKey]?.permissions ?? {}
      vars = pluginJson.runes[autoMatch.runeKey]?.vars ?? {}
    }
    // else: falls through to existing "Unknown rune" handling, unchanged
  }
}
```

The rest of the existing per-key block (`getArgsSchema`/`getReplSchema`/`formatHelp` calls) is
unchanged — both functions already accept any file path + effective permissions + vars, with no
local-only assumption, confirmed by reading their signatures (`isolation/runner.js:1570,1682`).

## Testing plan

- `test/plugin/registry.test.js` (or wherever `resolvePluginKey` is currently tested): add cases
  for `resolvePluginKeyScoped` — single scoped match resolves silently; zero scoped matches with
  1+ global matches throws the new "not enabled" message naming the real candidate(s); 2+ scoped
  matches throws ambiguous with full keys; zero matches anywhere returns `null`.
- `test/rune/resolver.test.js`: extend the existing plugin-override tests (added in the earlier
  onboarding-feedback-fixes work) to cover the scoped resolution change, plus a case proving a
  globally-installed-but-not-enabled same-named plugin no longer causes false ambiguity.
- `test/plugin/commands/disable.test.js`: new/extended cases for the narrower
  enabled-only resolution.
- `test/rune/resolver.test.js` and `test/template/commands/apply.test.js`: assert the fixed
  ambiguity messages contain full `marketplace@name:rune` forms, not bare names or placeholders.
- `test/core/config.test.js`: new cases for the item 4 validation error — a bare-keyed
  no-path/no-plugin entry throws; a fully-qualified one doesn't; a normal local rune entry (has
  `path`) with a colon-containing key (edge case) doesn't false-positive.
- `test/docs/commands/rune.test.js`: new cases for plugin-rune docs support — a qualified
  `plugin:rune` key resolves and renders help; a bare rune key auto-discovers; an ambiguous bare
  key surfaces the item 3 error rather than "Unknown rune."
- `npm test` full suite green after each task, per this project's TDD requirement.
- Manual verification: re-run the exact empirical scratch-registry scenarios from the
  investigation (isolated `CRUNES_STORE`, two same-named plugins, one enabled) and confirm each
  now resolves or errors as designed rather than falsely.
