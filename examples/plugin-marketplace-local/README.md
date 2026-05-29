# Local Marketplace Plugin

Register a fully self-contained local marketplace and install a plugin from it — no network required.

## What it demonstrates

- Registering a local directory as a marketplace source with `crunes marketplace add`
- Installing a plugin from that local marketplace with `crunes plugin install`
- How to swap a local source for a remote one (GitHub or HTTPS) when ready to publish

## How to run

From this directory:

```bash
crunes marketplace add ./my-marketplace
crunes plugin install my-marketplace@greeter
crunes use greeter:greet World
```

`./my-marketplace` is a local directory containing a `.crunes-plugin/marketplace.json` registry that points at `./plugins/greeter`.
The crunes CLI resolves plugin sources relative to the marketplace root, so the plugin files stay co-located with the registry.

## What to expect

```
Hello, **World**! Greetings from the local marketplace.
```

## Going to production

Replace the local path with a remote source:

```bash
# GitHub repo
crunes marketplace add your-org/your-plugins-repo

# HTTPS URL
crunes marketplace add https://your-host.com/marketplace.json
```

The `marketplace.json` format is identical — only the source location changes.
