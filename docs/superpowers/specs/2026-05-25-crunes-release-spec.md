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
   - **WebSocket Support**:
     - Added `utils.ws` WebSocket client namespace to the sandboxed utils API.
     - Added sandboxed raw binary frame transmission (`Uint8Array` / `ArrayBuffer`) via `.sendBinary(data)`.
     - Added dedicated `'binary'` event in sandboxed event listeners yielding a raw `Uint8Array`.
     - Added `.closed()` method and full `WebSocketError` replication inside the isolate.
     - Zero-copy host-side memory wrapping using `ivm.ExternalCopy` native array transfers across isolate boundaries.
   - **Interactive Shell Namespace**:
     - Exposed `utils.shell.exec(cmd)` and `utils.shell.execInSession(cmd)` for live command spawn streams, expect patterns, and terminal processes.
     - Added `--ccd` global flag to specify a separate config directory, allowing project-isolated `.crunes/` roots.
   - **Rich Sandboxed Utilities (`@utils` module)**:
     - Exposed the `@utils` virtual ESM module for importing `fs`, `md`, `tree`, `section`, `crypto`, `sqlite`, etc. via `import { ... } from '@utils'`.
     - Added `utils.crypto`: SHA/MD5 hashing, UUID generation, and secure random hex/base64 byte strings.
     - Added `utils.sqlite`: high-performance `better-sqlite3`-backed SQLite client with persistent tables and scoped-by-project handle management.
     - Added `utils.cache`: named TTL key-value store for rune sandboxes.
     - Added `utils.archive`: native `zip`, `unzip`, `tar`, and `untar` operations.
     - Added `utils.yaml`, `utils.xml`, and `utils.json` with fully sandboxed `.read()`, `.write()`, and `.modify()` with comment-preserving round-trips.
     - Added `utils.fs.write` and `utils.fs.replace` tools for in-sandbox file writes.
     - Added `utils.fs.resolve` and `expandDirectories` option to `utils.fs.glob`.
     - Added `section` output filter with micromatch glob pattern support.
   - **Declarative Rune Argument Builder**:
     - Added `args()` schema-driven builder API for rune argument parsing.
     - Added `crunes help rune` subcommand group with batch `-a` flag and `--format json`.
   - **New Management Subcommands**:
     - Added `crunes job` command with ownership model (rune-spawned processes, kill, list, prefix-match kill) and `crunes jobs` command group.
     - Added `crunes cache` and `crunes sqlite` management command suites to provision, list, and delete sandboxed resources scoped by project.
     - Introduced TypeDoc-based API walkers: `crunes docs utils` and `crunes docs rune` (renamed from `crunes help`).
     - Added `m` (Module Structural Context) and `kb` (Knowledge Base Context) bundled context runes for AI model integration.
   - **Plugin & Module Enhancements**:
     - Added support for `@plugin/` and `@project/` virtual module prefixes for plugin and project runes respectively.
     - Auto-permitted `.crunes/` reads for project runes.
     - Isolated local plugin dependencies in their own install directory without polluting the workspace.
     - Added `--cwd` placement fix in `rune spawn` to correctly set working directory.
   - **Unified Path Resolution**:
     - Introduced virtual roots, dotfile-based permission grants, and consistent token format across all `utils.fs` operations.
     - Plugin runes auto-receive `fs.read:@plugin/**` in their effective permission set.

   ### Changed
   - **Restructured codebase**: Reorganized `src/` into clean, feature-first modular directories: `cli`, `rune`, `job`, `marketplace`, `plugin`, `project`, `shared`, `store`, `cache`, `sqlite`, `docs`, `template`.
   - **Breaking**: Renamed WebSocket `.send()` to `.sendText(msg)` for clean method symmetry with `.sendBinary()`.
   - **Breaking**: Renamed shell methods to `.exec()` and `.execInSession()` inside `utils.shell` (previously `shell.run` capability string, now `shell.exec`).
   - **Breaking**: Standardized `use`, `check`, and `bench` command arguments to consistent CLI syntax with explicit positional/flag tiers.
   - Renamed `help` command group to `docs` and `jobs` command group to `job`; cache and sqlite resources are now scoped by project.
   - Moved `getProjectKey` and `shortHash` to `src/project/` as the unified project identity module.
   - Placed batching `+` token behind an explicit `-b` flag (`crunes -b use key1 + key2`); bare `+` tokens are no longer treated as batch separators without the flag.
   - CLI now rejects rune keys starting with hyphens to catch misplaced global flags early.
   - Decoupled identity metadata (author, description, homepage) from `plugin.json` and delegated to `marketplace.json`.
   - Moved inline syntax documentation to `addHelpText` to reduce noise in top-level help output.
   - Enforced `.crunes-plugin/` folder naming for remote marketplace plugin resolution.
   - Strict namespaced permissions: migrated all permission declarations to `permissions.use.allow` format in `plugin.json`/`config.json`.
   - Restricted `hostRequire` strictly to pre-approved safe Node.js builtins to prevent sandbox escapes.
   - Resolved V8 isolate memory bloat by switching to `ivm.ExternalCopy` native array transfers across boundaries.
   - Updated CI publish workflow: added a build step before test and publish so TypeDoc-generated `utils-api.json` exists.
   - Updated TypeDoc output path from `src/help` to `src/docs` following the rename.

   ### Fixed
   - Fixed `release` verification rune: corrected `program.js` path resolution, replaced bare `shell(...)` calls with `shell.exec(...)`, and aligned permission capability strings.
   - Fixed `yaml` round-trip to preserve implicit `null` values and flow sequence style on `.modify()`.
   - Fixed plugin uninstall to not delete the source directory when removing a local plugin.
   - Fixed `rune create`, `template create`, and `plugin create` scaffolding to use the `use(args)` lifecycle API.
   - Fixed plugin `create` scaffolding to emit namespaced permissions schema in `plugin.json`.
   - Fixed `isolated-vm` stale `opts` 4th argument removal from isolate execution bridge.
   - Fixed marketplace to correctly enforce `.crunes-plugin` folder for remote marketplace resolution.
   - Fixed plugin update to preserve permissions correctly when bumping a plugin version.
   - Fixed `--cwd` placement in `rune spawn` to correctly propagate the working directory.
   - Fixed security: restricted `hostRequire` to builtins to prevent sandbox escape via dynamic require.
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
