# Profile-Configurable Cloud Deployer Example Workspace

This workspace demonstrates a highly configurable `deployer` rune that dynamically changes its CLI options and subcommands based on a configuration profile variable (`readonly` | `developer` | `operator`).

## Running with Different Profiles

Change `"profile"` under `"vars.deployer"` in `.crunes/config.json` to see argument compilation adapt in real time.

### 1. `readonly` Profile
Exposes only the `status` command:
```bash
crunes run deployer status
```

### 2. `developer` Profile
Exposes `status` and `deploy` commands:
```bash
crunes run deployer deploy webapp --tag v1.0.0
```

### 3. `operator` Profile
Exposes all commands including stack destruction:
```bash
crunes run deployer destroy --force
```
