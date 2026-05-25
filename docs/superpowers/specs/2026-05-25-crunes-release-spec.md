# crunes Unified Release Specification (v0.5.0)

This specification defines the unified, synchronized release process for the `crunes` monorepo. It ensures that version numbers, dependency lockfiles, CLI entry versions, and plugin manifests remain 100% synchronized and correct across all separate repositories before tagging.

---

## 1. Release Goals

We are preparing a new minor release (**v0.5.0**) to deliver:
- **WebSocket Binary Support** (high-performance sandboxed transfer via `.sendText()` / `.sendBinary()` and `'binary'` events).
- **ACI Improvements** (lowercase token regex matching, programmatic token batching `-b` flag).
- **Bug Fixes**: Resolved release checker rune path errors, shell capability permissions mismatches, and outdated `shell` calls.

To ensure consistency in a multi-repository monorepo, **both the CLI and the ACI plugin will be bumped to v0.5.0** to keep versions perfectly aligned.

---

## 2. Pre-Release Baseline

Currently, the repositories are in the following baseline states:
- **`crunes-cli`**:
  - `package.json` version: `0.4.6`
  - `src/cli/program.js` version: `0.4.6`
- **`crunes-aci`**:
  - `.claude-plugin/plugin.json` version: `0.3.2`
  - `.claude-plugin/marketplace.json` version: `0.3.2`

---

## 3. Pre-Release Verification Checklist

Before executing any version bumps, the following checks must pass:
1. **Core Tests**: Run `npm test` inside `crunes-cli/` to confirm that all 736 Vitest tests are green.
2. **Hook Wrapper Tests**: Run `npm test` inside `crunes-aci/` to verify that the Claude Code hook wrapper matches and parses tokens correctly.
3. **Workspace Status**: Ensure all working trees are clean, with no unstaged modifications in any repository.

---

## 4. Release execution Protocol

Releasing the new version involves three separate, synchronized steps:

### Phase A: `crunes-cli` Release Execution
1. **Bump package version**: Edit `crunes-cli/package.json` and change `"version"` to `"0.5.0"`.
2. **Synchronize lockfile**: Run `npm install` inside `crunes-cli/` to rebuild `package-lock.json` and synchronize its version field to `"0.5.0"`.
3. **Bump Commander version**: Edit `crunes-cli/src/cli/program.js` to update the `.version()` string to `"0.5.0"`.
4. **Append Changelog**: Add the following entry to the top of `crunes-cli/CHANGELOG.md`:
   ```markdown
   ## [0.5.0] - 2026-05-25

   ### Added
   - **WebSocket Binary Support**:
     - Sandboxed raw binary frame transmission (`Uint8Array` / `ArrayBuffer`) via the new `.sendBinary(data)` method.
     - Dedicated `'binary'` event in sandboxed event listeners yielding a raw `Uint8Array`.
     - Zero-copy host-side memory wrapping using Node's `Buffer.from(arrayBuffer)` and direct isolate transfers via `isolated-vm`'s `arguments: { copy: true }`.
   - **Interactive Shell Capability**: Exposed `utils.shell.exec(cmd)` and `utils.shell.execInSession(cmd)` namespaces supporting live command spawn streams, expect patterns, and terminal processes.
   - **Rich Sandboxed Utilities (`@utils` module)**:
     - Exposed the `@utils` virtual ESM module for importing `fs`, `md`, `tree`, `section`, `crypto`, `sqlite`, etc.
     - Added `utils.crypto` for robust SHA/MD5 hashing, UUID generation, and secure random byte strings.
     - Added `utils.sqlite` backed by high-performance SQLite handles for persistent tables.
     - Added `utils.cache` providing named TTL key-value stores.
     - Added `utils.archive` for native `zip`, `unzip`, `tar`, and `untar`.
     - Added `utils.yaml`, `utils.xml`, and `utils.json` with fully sandboxed `.read()`, `.write()`, and `.modify()` comment round-trips.
   - **New Management Subcommands**:
     - Added `crunes job`, `crunes cache`, and `crunes sqlite` shell subcommand suites to provision, list, and delete sandboxed resources.
     - Renamed `help` command group to `docs`, and introduced TypeDoc-based API walkers: `crunes docs utils` and `crunes docs rune`.
     - Added `m` (Module Structural Context) and `kb` (Knowledge Base Context) context runes to provide live structural data to AI models.
   - **Plugin & Module Enhancements**:
     - Added support for `@plugin/` and `@project/` module imports for plugin runes.
     - Isolated dependencies for local plugins without polluting workspace.

   ### Changed
   - **Restructured codebase**: Reorganized `src/` into clean, feature-first modular directories (e.g. `cli`, `rune`, `job`, `marketplace`, `plugin`, `project`, `shared`, `store`, `cache`, `sqlite`, `docs`, `template`).
   - **Breaking**: Renamed WebSocket `.send()` to `.sendText(msg)` to offer clean method symmetry.
   - **Breaking**: Renamed shell methods to `.exec()` and `.execInSession()` inside `utils.shell`.
   - **Breaking**: Standardized `use`, `check`, and `bench` command arguments.
   - **Strict Namespaced Permissions**: Migrated to strict namespaced permissions (`permissions.use.allow` in `plugin.json`).
   - **Security hardeners**: Prevented sandbox escapes by restricting `hostRequire` strictly to safe, pre-approved Node builtins.
   - **Performance optimization**: Resolved V8 isolate memory bloat via `ivm.ExternalCopy` native array transfers across boundaries.

   ### Fixed
   - Corrected the `release` verification rune to resolve program path errors, outdated `shell` calls, and permission capability matches.
   ```
5. **Re-build & Run Release Verification**:
   - Run `npm run build` to package the bundle inside `dist/`.
   - Run `node dist/cli.js use release --plain` and verify that the output reports matches for Package, Lock, and CLI versions at `0.5.0` ✓.
6. **Commit & Tag**:
   ```bash
   git add package.json package-lock.json src/cli/program.js CHANGELOG.md dist/
   git commit -m "chore: release v0.5.0"
   git tag v0.5.0
   ```

### Phase B: `crunes-aci` Release Execution
1. **Bump plugin version**: Edit `crunes-aci/.claude-plugin/plugin.json` and set `"version"` to `"0.5.0"`.
2. **Bump marketplace version**: Edit `crunes-aci/.claude-plugin/marketplace.json` and set `"version"` under `plugins` to `"0.5.0"`.
3. **Commit & Tag**:
   ```bash
   git add .claude-plugin/plugin.json .claude-plugin/marketplace.json
   git commit -m "chore: release v0.5.0"
   git tag v0.5.0
   ```

### Phase C: Root Repository Sync Tag
To establish a monorepo-level checkpoint:
1. **Commit Specs**: Ensure our release specification is committed to the root repo.
2. **Tag Root**:
   ```bash
   git tag v0.5.0
   ```

---

## 5. Push and Publish

Once all repositories are successfully tagged:
- **`crunes-cli`**: Run `git push origin main --tags`. This will trigger the automated GitHub Actions CI workflow, which builds and publishes the new package `@darkrymit/crunes-cli@0.5.0` to npm automatically.
- **`crunes-aci`**: Run `git push origin main --tags` to publish the plugin release tag to origin.
- **Root**: Run `git push origin main --tags` to publish the root monorepo release checkpoint.
