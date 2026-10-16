# Decisions

* [Shape of a rune entry](/decisions/rune-entry-shape.md) - Lifecycle blocks replace path, each naming its handler with a single command field resolved like a shell resolves one, and nothing is resolved by convention — chosen over keeping path or adding a runtime field.
* [Single invocations are direct](/decisions/direct-single-invocation.md) - A single rune invoked in text mode reaches the caller directly — results on standard output, diagnostics on standard error, a script's own streams and exit code — and the framing that keeps several streams apart is kept for batches, JSONL and the paths that capture output.
