---
tags:
  - completed
---

# Proposal: The `use` Lifecycle & Namespaced Permissions

## Overview
This proposal deprecates the legacy `generate` lifecycle method in favor of a new `use` export. Additionally, it introduces **Namespaced Permissions** to the `plugin.json` configuration, scoping permissions specifically to the lifecycle function being executed (e.g., `use` vs `args`).

## Motivation
1. **Nomenclature Alignment:** The term `generate` implies the creation of artifacts. Changing the export to `use` perfectly aligns the codebase with the CLI command (`crunes use <key>`).
2. **Lifecycle Security:** Runes may need to perform setup tasks (like reading `.env` to build schemas via the proposed `args()` export). Granting global permissions is dangerous. By namespacing permissions to the lifecycle function, we can grant a specific method (e.g., `args`) permission to read `.env` without giving the primary `use()` function access to those same variables. This stands independently as a robust security model for any current or future lifecycle methods.

## Example Usage

### 1. Rune Export
```javascript
// .crunes/runes/fetch.js

export async function args(dir, utils, opts) {
  // Requires "env.read" permission in the "args" namespace
  const key = await utils.env.get('API_KEY'); 
  return utils.args.config().build();
}

export async function use(dir, args, utils, opts) {
  // Requires "fs.read" permission in the "use" namespace
}
```

### 2. Namespaced Permissions
```json
{
  "runes": {
    "fetch": {
      "permissions": {
        "args": {
          "allow": ["env.read:API_KEY"]
        },
        "use": { 
          "allow": ["fs.read:src/*"] 
        }
      }
    }
  }
}
```

## Implementation Groundwork
1. **Registry Update:** Update the internal rune registry to look for the `use` export (with a fallback to `generate` for backwards compatibility).
2. **Permission Engine:** Refactor `computeEffectivePermissions` to require the lifecycle intent (`'use'` or `'args'`) and resolve permissions strictly from that namespace in `plugin.json`.
