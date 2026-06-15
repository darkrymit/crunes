# REPL SQLite Shell

An interactive SQLite query shell demonstrating the `repl` and `argsRepl` lifecycles, alongside a one-shot `run` lifecycle on the same rune.

## What it demonstrates

- **`argsRepl()` independent from `args()`** — the REPL lifecycle declares only `--db`; the one-shot lifecycle also declares a `<query>` positional
- **JS closure as session state** — `replDb` is a module-level variable that persists across inputs without serialization or external storage
- **`{ type: 'done', message }` signal** — returned by `repl` to end the session cleanly on `exit`, `quit`, or `\q`
- **Both lifecycles on one rune** — `crunes run sqlite-shell` for one-shot queries, `crunes repl sqlite-shell` for an interactive shell
- **Dynamic prompt** — returns `` `[${rowCount} rows]> ` `` after SELECT queries so the caller always sees how many rows came back
- **`repl` permissions** — the `config.json` `repl` permission block is separate from `run`; both must be declared for a rune that uses both lifecycles

## How to run

```bash
cd examples/repl-sqlite-shell

# Seed the database
crunes run init

# One-shot queries
crunes run sqlite-shell "SELECT * FROM books"
crunes run sqlite-shell "SELECT * FROM books WHERE genre = 'Sci-Fi'"
crunes run sqlite-shell "INSERT INTO books (title, author, year, genre) VALUES ('Refactoring', 'Martin Fowler', 1999, 'Programming')"

# Interactive shell
crunes repl sqlite-shell

# Machine-readable REPL (AI agent / pipe-friendly)
printf "SELECT * FROM books\nexit\n" | crunes repl --format jsonl sqlite-shell
```

## What to expect

- `crunes run init` — confirms the `books` table was seeded (idempotent via `INSERT OR IGNORE`)
- `crunes run sqlite-shell "<query>"` — prints a markdown table for SELECT, or a row-count line for INSERT/UPDATE/DELETE
- `crunes repl sqlite-shell` — opens an interactive prompt; type any SQL to execute it; type `exit`, `quit`, or `\q` to end the session
- After each SELECT, the prompt updates to `[N rows]> ` showing how many rows were returned
- `--format jsonl` streams `session-start`, `log`, `section`, and `session-end` events as newline-delimited JSON

## Key patterns

### `argsRepl` vs `args` — independent schemas

```js
export async function args(b) {
  return b
    .option('--db <path>', 'Database directory', './state')
    .positional('<query>', 'SQL query to execute')  // one-shot only
    .build()
}

export async function argsRepl(b) {
  return b
    .option('--db <path>', 'Database directory', './state')
    // no <query> positional — input arrives line-by-line via repl
    .build()
}
```

### JS closure as session state

```js
let replDb = null  // module-level — lives for the whole REPL session

export async function repl(args, input) {
  if (!replDb) {
    replDb = await sqlite.open(args.db, 'books')
    console.log(`Connected to ${args.db}/books.db`)
  }
  // replDb is reused on every subsequent input
}
```

### `repl` permissions in `config.json`

The `run` and `repl` lifecycles use separate permission namespaces. A rune that uses both must declare both:

```json
"permissions": {
  "run":  { "allow": ["sqlite.read:./state::books", "sqlite.write:./state::books"] },
  "repl": { "allow": ["sqlite.read:./state::books", "sqlite.write:./state::books"] }
}
```
