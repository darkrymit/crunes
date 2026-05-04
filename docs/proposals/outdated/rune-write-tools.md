---
tags:
  - completed
---

> **Note:** The `utils.json.update` functionality was deferred from this proposal. See the new `json-write-tools.md` proposal for details on the JSON tools.

# Proposal: File Write Tools

## Overview
This proposal expands the Context Runes ecosystem to support **Project Modification** (Write capabilities). It introduces a suite of write-enabled utility tools to the `utils` object.

## Motivation
Runes are uniquely positioned to act as AI-driven automation agents. To perform chores like updating dependencies, refactoring code, or scaffolding files, Runes need safe, controlled write access to the project. 

Rather than over-complicating the Rune API with a separate `cast` lifecycle method, we embrace the philosophy of **single-purpose functions**. If a user wants to write files, they simply create a dedicated Rune for it (e.g., `refactor`), and the write tools are made available inside the standard `use()` export. 

## Write-Enabled Utilities
We will introduce new methods to the `utils` object passed to runes:
- `utils.fs.write(filepath, content)`
- `utils.fs.replace(filepath, regex, replacement)`
- `utils.json.update(filepath, callback)`

## Security Constraints
**Permission Gating:** Write tools are strictly gated by the permissions declared in `plugin.json`. A rune can only execute `utils.fs.write` if the user explicitly granted `"fs.write"` permissions.

```json
// Compatible with both global permissions and the proposed namespaced permissions:
"permissions": {
  "use": { "allow": ["fs.write:src/**/*.js"] } 
}
```
If a rune attempts to execute a write operation but lacks the corresponding permission, the framework will throw a fatal `SecurityError`. This proposal is fully independent and works seamlessly with either legacy global permissions or the newer namespaced permissions model.
