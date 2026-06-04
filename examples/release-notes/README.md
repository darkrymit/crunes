# Release Notes

Generates a structured changelog entry from `git log` and appends it to `CHANGELOG.md`.

## What it demonstrates

Uses `shell.exec` to run a git command and capture output, string parsing to format commit lines, and `fs.append` to grow the changelog without overwriting it.

## How to run

```bash
crunes run generate --since HEAD~5
```

Replace `HEAD~5` with any git tag or commit hash (e.g. `v1.0.0`).

## What to expect

`CHANGELOG.md` is created (or appended to) with a dated section listing all commits since the given ref. Each subsequent call appends a new dated section.
