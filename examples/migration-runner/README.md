# Migration Runner

Idempotent SQL migration runner — runs each `.sql` file exactly once.

## What it demonstrates

Uses `sqlite.run` to execute multi-statement SQL files in a single call, `cache.has`/`cache.set` to track which migrations have been applied, and `fs.glob` to discover migration files.

## How to run

```bash
crunes run migrate    # run pending migrations
crunes run status     # show applied vs pending
crunes run migrate    # run again — all skipped (idempotent)
```

## What to expect

First `migrate` applies all three migrations and reports them as applied. `status` shows each file with a ✓ (applied) or ○ (pending). Running `migrate` again reports no new migrations — all are skipped.
