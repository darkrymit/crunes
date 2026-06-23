# Design Spec: Rune Self-Inspection via `rune.*`

**Date:** 2026-06-23
**Status:** Approved

## Problem

The args schema (structured object with `options`, `positionals`, `commands`, `examples`) is computed on the host before the sandbox runs, but only the rendered help string is injected (`$__help_text`). Rune code has no access to the raw schema object, the rune's own key, or the REPL commands schema — making programmatic self-inspection impossible.

Additionally:
- `help` namespace is poorly named — it only renders, doesn't introspect
- `$__help_text` global name is inconsistent with no naming convention
- `commandsRepl(builder)` is typed as `ArgBuilder` but only `.command()` at root is meaningful
- `ArgBuilder` / no `CommandBuilder` type distinction makes the API misleading

## Solution

Extend the existing `rune` utils namespace with self-inspection methods. Rename injected globals to `$__rune_*`. Deprecate `help` as an alias. Tighten types in `lifecycle.d.ts`.

---

## 1. Host-Side: `injectUtils` Context Object

Replace the bare `helpText` parameter with a structured `runeContext` object:

```js
// Before
async function injectUtils(isolate, context, utils, runeCallback, vars, projectDir, checkPermission, currentRuneKey, sections, onEvent, helpText)

// After
async function injectUtils(isolate, context, utils, runeCallback, vars, projectDir, checkPermission, sections, onEvent, runeContext)
// runeContext = { key, helpText, argsSchema, commandsSchema }
```

`currentRuneKey` moves into `runeContext.key` — no longer a separate parameter.

### Injection block (replaces `$__help_text`)

```js
await jail.set('$__rune_key',             runeContext.key ?? null)
await jail.set('$__rune_help_text',       runeContext.helpText ?? null)
await jail.set('$__rune_args_schema',     JSON.stringify(runeContext.argsSchema ?? null))
await jail.set('$__rune_commands_schema', JSON.stringify(runeContext.commandsSchema ?? null))
```

### Callers

**Run path** (`runPluginRune` / `executePluginRune`):
```js
runeContext = {
  key:            runeKey,
  helpText:       helpText,       // from formatHelp(schema, ...)
  argsSchema:     schema,         // from getArgsSchema()
  commandsSchema: null,           // run lifecycle has no commandsRepl
}
```

**Repl path** (`runReplRune`):
```js
runeContext = {
  key:            runeKey,
  helpText:       helpText,       // from formatHelp(argsSchema, ...)
  argsSchema:     argsSchema,     // from getReplSchema() → argsRepl()
  commandsSchema: commandsSchema, // from getReplSchema() → commandsRepl()
}
```

**Bootstrap/help path** (`getArgsSchema`, `getReplSchema`):
Passes `runeContext = { key: null, helpText: null, argsSchema: null, commandsSchema: null }` — these paths don't need self-inspection.

---

## 2. Sandbox-Side: `utils-bootstrap.js`

Read the four globals and wire self-inspection methods onto the existing `rune` object (which already holds `exec`, `spawn`, `job`):

```js
const __runeKey            = typeof $__rune_key !== 'undefined' ? $__rune_key : null
const __runeHelpText       = typeof $__rune_help_text !== 'undefined' ? $__rune_help_text : null
const __runeArgsSchema     = typeof $__rune_args_schema !== 'undefined' ? JSON.parse($__rune_args_schema) : null
const __runeCommandsSchema = typeof $__rune_commands_schema !== 'undefined' ? JSON.parse($__rune_commands_schema) : null

// Extend existing rune object
rune.key            = () => __runeKey
rune.helpText       = () => __runeHelpText ?? ''
rune.helpSection    = () => section.create('help', { type: 'markdown', content: __runeHelpText ?? '' })
rune.argsSchema     = () => __runeArgsSchema
rune.commandsSchema = () => __runeCommandsSchema

// Deprecated aliases — identical implementations
const help = {
  text:    () => rune.helpText(),
  section: () => rune.helpSection(),
}
```

`rune.commandsSchema()` returns `null` during `run` lifecycle — not an error, callers check for null.  
`rune.argsSchema()` returns `null` when the rune exports no `args()`/`argsRepl()` function.

---

## 3. Type Definitions

### `rune.d.ts` — new self-inspection methods

Add to the existing `declare namespace rune`:

```ts
/** Returns the current rune's key (e.g. 'my-rune' or 'myplugin:my-rune'). null in bootstrap contexts. */
function key(): string | null

/** Returns the formatted CLI help text for the current rune. Empty string if no args schema. */
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

/** Root-level arg schema — no name or description (those belong to CommandSchema). */
interface ArgSchema {
  options:     { flags: string; description: string; def?: any }[]
  positionals: { spec: string; description: string }[]
  examples:    { usage: string; description: string }[]
  commands:    CommandSchema[]
}

/** Subcommand schema — extends ArgSchema with name and description. */
interface CommandSchema extends ArgSchema {
  name:        string
  description: string
}
```

### `help.d.ts` — deprecation

```ts
declare namespace help {
  /** @deprecated Use rune.helpText() instead. */
  export function text(): string

  /** @deprecated Use rune.helpSection() instead. */
  export function section(): RuneSection
}
```

### `lifecycle.d.ts` — type tightening

Add `CommandBuilder` alongside `ArgBuilder`:

```ts
/** Fluent builder for declaring REPL slash commands. Only .command() at root is meaningful — .option(), .positional(), .example() at root are ignored by the runtime. */
interface CommandBuilder {
  command(name: string, description: string, callback?: (sub: ArgBuilder) => void): this
  build(): any
}
```

Change `commandsRepl` signature:

```ts
// Before
function commandsRepl(builder: ArgBuilder): void | ArgBuilder | any | Promise<void | ArgBuilder | any>

// After
function commandsRepl(builder: CommandBuilder): void | CommandBuilder | any | Promise<void | CommandBuilder | any>
```

Also update `ParsedArgs` to reflect the now-guaranteed `$command`/`$commands` fields (always present, per the previous fix):

```ts
/** Space-separated matched command path. Empty string at root level. Always present. */
$command: string

/** Array of matched command path levels. Empty array at root level. Always present. */
$commands: string[]
```

---

## 4. Future Cross-Rune Extension

When cross-rune schema inspection is added, the signature extends naturally:

```js
rune.argsSchema()                                      // self (current design)
rune.argsSchema(rune.key())                            // self, explicit key
rune.argsSchema('other-key', { lifecycle: 'repl' })   // other rune
```

No breaking change — optional positional key argument, optional opts object.

---

## Scope

- `src/rune/isolation/runner.js` — rename `$__help_text` → `$__rune_help_text`, refactor `injectUtils` signature to `runeContext`, update all callers
- `src/rune/isolation/utils-bootstrap.js` — read `$__rune_*` globals, wire `rune.*` self-inspection methods, keep `help` as deprecated alias
- `src/rune/api/types-utils/rune.d.ts` — add `key`, `helpText`, `helpSection`, `argsSchema`, `commandsSchema`, `ArgSchema`, `CommandSchema`
- `src/rune/api/types-utils/help.d.ts` — add `@deprecated` to both methods
- `src/rune/api/types-lifecycle/lifecycle.d.ts` — add `CommandBuilder`, update `commandsRepl` signature, fix `ParsedArgs.$command`/`$commands` to non-optional
