# batch-demo

Demonstrates the three batch-permission cases for crunes runes.

Coding agents (e.g. Claude) can invoke runes in bulk with `crunes run -b`. The
`batch` config block on each rune entry declares which invocations are permitted.

## The three cases

| Rune | Batch policy | Why |
|------|-------------|-----|
| `status` | Always allowed | Read-only; no side effects |
| `report` | Partial — `read` allowed, `generate` blocked | `read` is safe; `generate` writes a file |
| `deploy` | Never allowed (default deny-all) | A deploy must always be a deliberate single action |

## Try it

Run from this directory after installing crunes globally (`npm i -g crunes-cli`).

```sh
# Normal (non-batch) invocation — always works
crunes run status
crunes run "report read"
crunes run "report generate"
crunes run deploy

# Batch invocations
crunes run -b status             # ✓ allowed
crunes run -b "report read"      # ✓ allowed
crunes run -b "report generate"  # ✗ blocked — matches deny pattern
crunes run -b deploy             # ✗ blocked — no batch block declared
```

## Pattern matching

`batch.allow` and `batch.deny` patterns match against the **args portion** of the
invocation (everything after the rune key). Deny wins over allow.

- `allow: ['*']` — permit any args (including none)
- `allow: ['read*']` — permit `read`, `read --verbose`, etc.
- `deny: ['generate*']` — block `generate`, `generate --out=foo`, etc.
- No `batch` block — default deny-all

See `docs/proposals/active/` for the full batch permissions spec.
