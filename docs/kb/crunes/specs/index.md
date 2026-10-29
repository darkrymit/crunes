# Specifications

The contracts more than one crunes repository implements.

## Documents

* [Knowledge base layout](/specs/knowledge-base.md) - crunes's layout standard for knowledge bundles, OKF v0.2 stated whole with each rule marked by its source (OKF, KB, EXT): the bundle tree and the four bundles of this project, front matter and trust fields, categories with modules for src/ directories, links, one-level indexes, which bundle a document belongs to across four repositories, registering a bundle with the kb plugin, diagrams and numbers.
* [Rune configuration](/specs/rune-config.md) - The shape of a rune entry — one block per lifecycle crunes executes in its own context, each naming its handler with command, with nothing resolved by convention — and the migration from the path-and-permissions entry.
* [Script rune contract](/specs/script-rune-contract.md) - The contract between crunes and a Node, Python or bash script registered as a rune — how the interpreter is found, what the script receives and what crunes does with what it returns.
* [Invocation output](/specs/invocation-output.md) - Where each stream of a crunes run invocation goes — standard output, standard error, standard input and the exit status — for isolate and script runes, in a direct single invocation and in the framed modes that batches, JSONL, jobs and bench use.
