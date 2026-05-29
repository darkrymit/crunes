# Plugin with Templates

A crunes plugin with two runes and a `templates/` directory — demonstrating the full plugin author surface.

## What it demonstrates

- A plugin with multiple runes (`add`, `list`) and per-rune permission declarations
- `fs.append` for growing a file without overwriting
- A `templates/` directory enabling `crunes create --from` project scaffolding
- The difference between rune execution (runtime) and template instantiation (scaffolding)

## File layout

```
plugin-with-templates/
├── .crunes-plugin/
│   └── marketplace.json
└── plugins/
    └── notes/
        ├── .crunes-plugin/
        │   └── plugin.json      ← two runes with fs.write / fs.read permissions
        ├── runes/
        │   ├── add.js           ← appends a timestamped note via fs.append
        │   └── list.js          ← reads and displays notes.md
        └── templates/
            └── new-note.md      ← scaffolded into the user's project on crunes create --from
```

### `plugin.json` — per-rune permissions

Each rune declares only the permissions it needs. `add` needs `fs.write:./notes.md`; `list` needs `fs.read:./notes.md`. The user consents to each rune's permissions separately at install time.

### `templates/` — project scaffolding

Files in `templates/` are copied into the user's project when they run `crunes create <dest> --from <plugin>:<template>`. They are static files — not rune code. Use `{{placeholder}}` syntax for values the CLI will substitute.

## How to test locally

```bash
cd examples/plugin-with-templates
crunes marketplace add .
crunes plugin install notes-marketplace@notes
crunes use notes:add "First note"
crunes use notes:add "Second note"
crunes use notes:list
crunes create my-note.md --from notes:new-note
```

`notes.md` is gitignored — it is created at runtime by the `add` rune.
