---
tags:
  - completed
---

# Proposal: Interactive Shell Namespace (`utils.shell`)

## Motivation
The current `utils.shell(cmd, opts)` API is too simplistic. It behaves purely as a fire-and-forget, run-to-completion function returning a buffered string. Developers have identified major gaps in this model:
1. **Interactive Prompts ("Quiz" use cases):** It's difficult to programmatically answer CLI prompts based on dynamic output.
2. **Background Servers:** There is no controllable handle to spawn a process, let it run in the background, and coordinate with it via external events or worker approaches.

## Proposed API Surface

To solve this, `utils.shell` will migrate from a single function to a namespace containing two primary methods.

### 1. `shell.exec(cmd, opts)`
Maintains the existing behaviour for simple, run-to-completion tasks.
- **Returns:** `Promise<string | object>` (depending on `throw` option, like the current API)
- **Behaviour:** Spawns the process, buffers stdout/stderr, strips ANSI codes, throws on non-zero exit codes (by default), and returns the trimmed output.

### 2. `shell.execInSession(cmd, opts)`
The new interactive background API. It spawns the process and immediately returns a stateful `ShellSession` object.
- **Returns:** `ShellSession`
- **Behaviour:** Does not block or await completion. The process runs continuously in the background.

#### `ShellSession` Methods

*   **`session.write(text: string): void`**
    Writes the provided string directly to the child process's `stdin`.

*   **`session.expect(pattern: string | RegExp, timeoutMs?: number): Promise<string>`**
    Suspends the current async execution until the process outputs a string matching the pattern. 
    - Resolves with the chunk of output that matched.
    - Throws/Rejects if the `timeoutMs` is reached before the pattern appears.

*   **`session.output(): string`**
    A synchronous method that returns the entire buffer of output (stdout + stderr combined, ANSI-stripped) that the process has emitted up to this exact millisecond. Implemented as a method to maintain consistency with other actions and to allow future options (e.g., `{ clear: true }`).

*   **`session.waitForExit(): Promise<number>`**
    Returns a Promise that resolves with the `exitCode` when the process naturally terminates or is killed.

*   **`session.kill(): void`**
    Forcefully terminates the underlying child process.

---

## Usage Examples

### 1. Interactive CLI Automation
```javascript
const session = shell.session('npm init');

// Wait for the specific prompt and inject an answer
await session.expect(/package name:/);
session.write('my-awesome-package\\n');

await session.expect(/version:/);
session.write('1.0.0\\n');

// Wait for the tool to finish and check the exit code
const code = await session.waitForExit();
```

### 2. Background Server & External Signals
```javascript
// Start the database worker in the background
const db = shell.session('database-worker --interactive');
await db.expect('Ready for queries');

// Export an interface that uses the long-running session
export async function handleExternalSignal(queryStr) {
    db.write(`EXECUTE ${queryStr}\\n`);
    
    // Wait specifically for the result of this query
    const result = await db.expect(/RESULT: (.*)/);
    return result;
}
```
