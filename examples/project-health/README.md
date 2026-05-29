# Project Health

Reads `package.json` and GitHub Actions workflows to report project health.

## What it demonstrates

Uses `json.read` and `json.modify` for structured JSON mutation, `yaml.read` to parse CI workflow files, and `fs.glob` to discover files by pattern.

## How to run

```bash
crunes use check
crunes use fix-version --version 1.2.0
crunes use check
```

- `check` — reports package name, version, scripts, and workflow triggers
- `fix-version --version <semver>` — updates `package.json` version in place

## What to expect

`check` outputs two sections: package metadata and a list of CI workflow files with their trigger events. `fix-version` updates `package.json` and reports the old and new version.
