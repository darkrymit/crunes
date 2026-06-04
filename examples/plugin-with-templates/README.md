# Plugin with Templates

A crunes plugin with two runes and a `templates/` directory — demonstrating the full plugin author surface.

## What it demonstrates

- A plugin with multiple runes (`add`, `list`) and per-rune permission declarations
- `fs.append` for growing a file without overwriting
- A `templates/` directory with a rune starter, declared in `plugin.json` under `"templates"`
- The difference between rune execution (runtime) and template instantiation (scaffolding)

## File layout

```
plugin-with-templates/
├── .crunes-plugin/
│   └── marketplace.json
└── plugins/
    └── notes/
        ├── .crunes-plugin/
        │   └── plugin.json      ← two runes + one template declared under "templates"
        ├── runes/
        │   ├── add.js           ← appends a timestamped note via fs.append
        │   └── list.js          ← reads and displays notes.md
        └── templates/
            └── new-note.js      ← rune starter copied into the user's project on crunes template apply
```

### `plugin.json` — per-rune permissions

Each rune declares only the permissions it needs. `add` needs `fs.write:./notes.md`; `list` needs `fs.read:./notes.md`. Templates are declared in a separate `"templates"` key alongside `"runes"`. The user consents to each rune's permissions separately at install time.

### `templates/` — rune starters

Files in `templates/` are rune JS files copied into the user's project when they run `crunes template apply <plugin>:<template>`. The template is registered as a new rune in the project's `.crunes/config.json` with the permissions declared in `plugin.json`.

## How to test locally

```bash
cd examples/plugin-with-templates
crunes marketplace add .
crunes plugin install notes-marketplace@notes
crunes run notes:add "First note"
crunes run notes:add "Second note"
crunes run notes:list
crunes template apply notes:new-note --as my-note
crunes run my-note "My titled note"
```

`notes.md` is gitignored — it is created at runtime by the `add` rune.
