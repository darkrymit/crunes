# Decisions

Forks that bind the whole crunes project, each recorded once with what was traded away.

## Documents

* [OKF bundles, one per repository that has something to say](/decisions/knowledge-base-format.md) - Knowledge is an Open Knowledge Format bundle per repository rather than one shared tree, because a repository's knowledge has to travel with the repository.
* [Four repositories with gitignored mounts](/decisions/repo-topology.md) - The umbrella repository holds documentation and examples and mounts the three published repositories as ignored directories rather than submodules.
* [Skills state no API surface](/decisions/skills-state-no-api.md) - The agent skills carry no signatures, namespace lists, flag tables or command inventories, because the installed CLI generates all of it and a copy in a skill would describe a different version.
* [Single invocations are direct](/decisions/direct-single-invocation.md) - A single rune invoked in text mode reaches the caller directly — results on standard output, diagnostics on standard error, a script's own streams and exit code — and the framing that keeps several streams apart is kept for batches, JSONL and the paths that capture output.
* [Shape of a rune entry](/decisions/rune-entry-shape.md) - Lifecycle blocks replace path, each naming its handler with a single command field resolved like a shell resolves one, and nothing is resolved by convention — chosen over keeping path or adding a runtime field.
