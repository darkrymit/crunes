# Streaming Demo

Stream subprocess output in real time with progressive section updates.

## What it demonstrates

Uses `shell.execInSession` to start a subprocess and listen to its stdout, `section.emit` to push intermediate updates before the rune resolves, `TextDecoder` to decode binary chunks, and `AbortController` to stop the subprocess when a condition is met.

## How to run

```bash
crunes use stream-count        # stream 5 ticks (default)
crunes use stream-count 10     # stream 10 ticks
```

## What to expect

The output updates progressively as each tick arrives. After the limit is reached, the subprocess is aborted and a final summary section is returned. The `counter.js` script must be in the working directory (it's committed alongside the rune).
