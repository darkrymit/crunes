# Minimal Plugin

The smallest possible publishable crunes plugin — a single rune with no permissions.

## What it demonstrates

- The required file layout for a crunes plugin package
- `marketplace.json` at the root for self-registration and discovery
- `plugin.json` inside the plugin directory declaring runes and permissions
- A sandboxed rune using only `@utils` — no Node.js built-ins

## File layout

```
plugin-minimal/
├── .crunes-plugin/
│   └── marketplace.json     ← marketplace registry (lists this plugin)
└── plugins/
    └── greeter/
        ├── .crunes-plugin/
        │   └── plugin.json  ← plugin manifest (declares runes + permissions)
        └── runes/
            └── greet.js     ← sandboxed rune code
```

### `marketplace.json`

The marketplace registry sits at `.crunes-plugin/marketplace.json` at the root of any plugin repository. It lists all plugins available in this source. The `source` field is a relative path to the plugin directory.

### `plugin.json`

Lives at `plugins/<name>/.crunes-plugin/plugin.json`. Declares each rune the plugin exposes and the exact permissions it needs. No `name` or `version` fields here — those belong in `marketplace.json`.

### `greet.js`

Rune code runs inside a V8 isolate. All I/O goes through the `@utils` API injected by the crunes CLI. No `require()`, no Node.js built-ins.

## How to test locally

```bash
cd examples/plugin-minimal
crunes marketplace add .
crunes plugin install greeter-marketplace@greeter
crunes use greeter:greet World
```

## Contributing to `crunes-plugins/`

To publish this plugin to the official marketplace:

1. Copy `plugins/greeter/` into `crunes-plugins/plugins/greeter/`
2. Add an entry to `crunes-plugins/.crunes-plugin/marketplace.json`:

```json
{
  "name": "greeter",
  "description": "Greets the user by name",
  "version": "1.0.0",
  "author": { "name": "your-name" },
  "source": "./plugins/greeter",
  "category": "runes"
}
```

3. Open a pull request to `darkrymit/crunes-plugins`
