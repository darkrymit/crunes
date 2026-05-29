# Scaffold

Bootstrap a new crunes project structure with a single command.

## What it demonstrates

Uses `fs.exists` to guard against re-initialization, `json.write` to create structured config files, `fs.mkdir` to create directories, and `yaml.write` to generate GitHub Actions workflow files.

## How to run

Run these from a new empty directory (not inside this example):

```bash
crunes use scaffold:init --name my-project
crunes use scaffold:add-workflow --name ci
```

Or run from within the example directory to see the guard behavior:

```bash
crunes use init --name my-project    # reports "already initialized"
crunes use add-workflow --name ci    # creates .github/workflows/ci.yml
```

## What to expect

`init` creates `.crunes/config.json`, `package.json`, and `.github/workflows/` directory. Running it again reports that the project is already initialized. `add-workflow` creates a named GitHub Actions workflow YAML file.
