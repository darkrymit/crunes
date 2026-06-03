# Streaming Demo

Stream data in real time — from a subprocess or an HTTP response body.

## What it demonstrates

### `stream-count`

Uses `shell.spawn` to start a subprocess and listen to its stdout, `section.emit` to push intermediate updates before the rune resolves, `TextDecoder` to decode binary chunks, and `AbortController` to stop the subprocess when a condition is met.

### `stream-fetch`

Uses `http.fetch` and `res.body().getReader()` to consume an HTTP response body as a live `ReadableStream<Uint8Array>`. Each chunk is logged with `console.log` as it arrives. Demonstrates the Web Fetch-aligned streaming API.

## How to run

```bash
crunes use stream-count        # stream 5 ticks (default)
crunes use stream-count 10     # stream 10 ticks

crunes use stream-fetch                            # stream from httpbin.org/stream/3
crunes use stream-fetch https://httpbin.org/stream/5  # custom URL
```

## What to expect

**stream-count:** Output updates progressively as each tick arrives. After the limit is reached, the subprocess is aborted and a final summary section is returned. The `counter.js` script must be in the working directory (it's committed alongside the rune).

**stream-fetch:** Each chunk is printed to the console as it arrives. A final section is returned when the stream closes.
