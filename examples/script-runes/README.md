# Script Runes

Runes that are not sandboxed JavaScript: a Python script, a bash script, a Node script and a program on `PATH`, each declared with a `run` block. They run natively, with your full access — `crunes list` marks them `native`.

## What it demonstrates

- **`todos`** — a Python script with a JSON argument schema in `tools/todos.args.json` (a typed option, a choice), reading its config `vars` from `CRUNES_VARS`, and printing sections with `run.output: "sections"`.
- **`recent`** — a narrow surface over `git log` with `run.pass: "mapped"`: the schema is the whole interface, each option declares the `git` arguments it becomes with `to`, and anything else is refused before `git` starts.
- **`wait`** — `run.timeout`: a script still running after two seconds is stopped, and the run ends with status 124.
- **`env`** — the variables every script rune receives, from a plain `.js` file run with Node.

## How to run

```bash
crunes run todos                       # Python; sections printed as markdown
crunes run todos --format list --min 2 tools
crunes run todos --format csv          # refused: not one of the choices
crunes run recent --limit 3            # git log --oneline --no-decorate -n3
crunes run recent --help               # answered by crunes from the schema
crunes run recent --stat               # refused: not on the rune's surface
crunes run wait; echo $?               # stopped after 2s, status 124
crunes run env a b
crunes run -b 'todos[-s total]' + env  # a batch: each rune's output labelled
```

## What to expect

Run on its own, a script rune behaves as the script does when run by hand: its output is not labelled and its exit code is crunes's exit code. In a batch or with `--format jsonl`, its output is captured — `todos`'s sections stream as sections, and `env`'s plain output becomes one `output` section. A section filter is written in brackets after the key, `todos[-s total]`; after the key, `-s` would be an argument to the rune.
