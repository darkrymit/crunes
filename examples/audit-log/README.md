# Audit Log

An append-only audit log with base64 shell script export.

## What it demonstrates

Uses `fs.append` to grow a log file without overwriting it, `cache.has` to write a one-time header on first run, `codec.toBase64` to encode the log for portability, and `fs.chmod` to mark the output script as executable.

## How to run

```bash
crunes use add "deployed v1.2.3"
crunes use add "rolled back v1.2.2"
crunes use export
```

- `add <message>` — appends a timestamped line to `audit.log`
- `export` — encodes the log and writes `export/audit-dump.sh`

## What to expect

Each `add` call grows `audit.log` by one line. First run also prepends a header line. After `export`, `export/audit-dump.sh` is an executable shell script that prints the decoded log when run with `sh export/audit-dump.sh`.
