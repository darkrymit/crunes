# Specifications

Contracts the open proposals would add or change.

## Documents

* [Rune configuration v2](/specs/rune-config-v2.md) - The proposed shape of a rune entry — one block per lifecycle crunes executes in its own context, each naming its handler with command, with nothing resolved by convention — and the migration from the path-and-permissions entry.
* [Script rune contract](/specs/script-rune-contract.md) - The MVP0 contract between crunes and a Node, Python or bash script registered as a rune — how the interpreter is found, what the script receives and what crunes does with what it returns.
* [Invocation output](/specs/invocation-output.md) - Where each stream of a crunes run invocation goes — standard output, standard error, standard input and the exit status — for isolate and script runes, in a direct single invocation and in the framed modes that batches, JSONL, jobs and bench use.
