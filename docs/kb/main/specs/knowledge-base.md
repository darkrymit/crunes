---
type: spec
title: Knowledge base layout
description: This project's layout standard for knowledge bundles — ten categories and how to choose between two that both fit, the front matter contract, which bundle a document belongs to across four repositories, the rule that an index bullet repeats its document's description, and how a bundle is registered with the kb plugin.
tags: [knowledge-base, okf, spec]
---

# Knowledge base layout

The directory layout, metadata schema, cross-referencing model and categorization rules every knowledge bundle in this project obeys.

**This is the whole standard, stated rather than diffed**, and nothing else has to be open to read it. It is adapted from the Boxwire project's bundle standard, which began as an application of OKF v0.2: where this document is silent, OKF v0.2 governs, and where the two differ this document is what the bundles here obey.

Two things make this project's copy differ from the one it came from, and both follow from what crunes is. The structural category is called `modules/`, because `src/<module>/` is what this codebase has always called its parts. And a bundle is not merely written but **registered**, because the reader is the `kb` plugin — crunes reads its own knowledge base through a rune it ships.

## 1. Bundle directory layout

A knowledge base is a self-describing bundle under `docs/kb/<bundle-dir>/`, containing a root `index.md` and up to ten top-level category directories:

```
docs/kb/<bundle-dir>/
├── index.md        # bundle root index — OKF metadata and a grouped table of contents
├── vision/         # what the thing is meant to be, and why that shape
├── guides/         # how a person gets from nothing to a working thing
├── specs/          # formal contracts, protocols, schemas, wire formats
├── modules/        # module architectures, responsibilities and boundaries
├── flows/          # end-to-end execution paths and lifecycle sequences
├── patterns/       # architectural idioms, design rules and system constraints
├── concepts/       # deep explanations of domain entities and model primitives
├── decisions/      # architecture decision records, with their trade-offs
├── gotchas/        # traps, non-obvious failure modes and platform quirks
└── glossary/       # vocabulary and quick terminology definitions
```

A bundle activates the categories it needs and no others. An empty directory is not created against future use.

### 1.1 Directory name and bundle identifier are not the same thing

**The directory is `main`. The identifier is not.** Every repository here keeps its bundle at `docs/kb/main/`, so the path is the same wherever you are standing, and the identifier is qualified by the repository it describes:

| Repository | Directory | `kb:` identifier |
|---|---|---|
| `crunes` (umbrella) | `docs/kb/main/` | `crunes-main` |
| `crunes-cli` | `docs/kb/main/` | `crunes-cli-main` |
| `crunes-plugins` | `docs/kb/main/` | `crunes-plugins-main` |

A bare `main` would collide the moment a second bundle was mounted beside the first, and every cross-bundle link in the project is written against the identifier rather than the path. The directory answers *where do I put this*; the identifier answers *which bundle is meant*.

### 1.2 The directory index

**A category directory holding documents carries an `index.md` listing them**, in the same bullet form as the root index. It carries no YAML front matter, because it is a table of contents rather than a document about anything.

The root index links documents directly. A directory index is a second way in for a reader who opened the folder, not a level the root routes through.

## 2. Front matter and metadata

### 2.1 Bundle root

The root `index.md` of every bundle MUST declare:

```yaml
---
okf_version: 0.2
kb_version: 0.1
kb: <bundle-identifier>
---
```

### 2.2 Category documents

Every markdown document in a category folder MUST begin with valid YAML front matter:

```yaml
---
type: <category>              # required: guide | vision | spec | module | flow |
                              #           pattern | concept | decision | gotcha | glossary
title: <Human-readable title> # required: matches the document's top-level heading
description: <Summary>        # required: one sentence, and the text every index uses
tags: [<tag1>, <tag2>]        # optional: topic and keyword tags
resource: <repo-path>         # optional: relative path to source code
---
```

**`description` is a contract, not a convenience.** Every index bullet naming the document repeats it exactly — see section 7 — so it is written once and read wherever the document is listed.

**A module document carries `resource:`**, pointing at the directory it describes (`src/<module>/`). A gotcha carries one where it names a specific file.

## 3. Category taxonomy

| Category | Primary question | Definition and scope | Discrimination rule |
| :--- | :--- | :--- | :--- |
| **`guides/`** | *How does a person get from nothing to a working thing?* | An ordered path through what is already documented, written for a reader who has read none of it. It teaches rather than states, and it says plainly what does not work yet. | **vs. Flow:** a flow traces what the system does; a guide traces what a person does. **vs. Concept:** a concept explains one primitive; a guide puts several to work in an order. **vs. Spec:** a spec is the contract; a guide is a path through it, and repeats only as much as the path needs. |
| **`vision/`** | *What is this meant to be, and why this shape?* | Intent, the model taken whole, and the reasoning that produced it. What the design refuses is as much its business as what it allows. | **vs. Decision:** a vision holds the whole position and is rewritten as it changes; a decision records one fork at one moment and is never rewritten. **vs. Concept:** a concept explains a primitive as it stands; a vision says what the model is for. |
| **`specs/`** | *What is the formal contract or wire format?* | Contracts more than one implementation owes: the plugin and marketplace manifest schemas, the permission token grammar, the config file shape, the rune lifecycle exports, this document. | **vs. Module:** defines the external interface; a module document defines internal implementation. **vs. Flow:** binds every implementation, and stays a spec when it is written as a procedure rather than as a layout. |
| **`modules/`** | *What are the module boundaries and responsibilities?* | One document per top-level directory under `src/` — its responsibility, the boundary it defends, what state it owns, and which modules it depends on and why. | **vs. Flow:** static module architecture; a flow traces a lifecycle across modules over time. **vs. Concept:** a concept is the thing; a module is the code that owns it. |
| **`flows/`** | *What is the end-to-end runtime execution path?* | Multi-stage execution sequences crossing more than one module — a command from argument to output, an install from source to registry. | **vs. Spec:** traces what one implementation does in order; a spec states what every implementation owes. **vs. Module:** a sequence over time, where a module is a boundary that holds still. |
| **`patterns/`** | *What design rules must all code follow?* | Universal idioms and system-wide constraints: the sandbox boundary, the feature-first layout, the storage split, the shape a new capability is expected to take. | **vs. Decision:** a permanent guideline; a decision is a point-in-time evaluation. |
| **`concepts/`** | *What are the domain primitives?* | Core model entities that outlive any one module — a rune, a plugin, a marketplace, a permission, a section. | **vs. Glossary:** in-depth semantics; a glossary entry is one paragraph. **vs. Module:** a concept is the thing; a module is the code that owns it. |
| **`decisions/`** | *Why this approach over that one?* | Decision records capturing context, alternatives and trade-offs. | **vs. Pattern:** historical rationale; a pattern is the actionable rule. |
| **`gotchas/`** | *What non-obvious trap will bite you?* | Edge cases, subtle bugs, tooling and platform quirks found during development. | **vs. Pattern:** a specific trap; a pattern is the practice that avoids traps. |
| **`glossary/`** | *What does this term mean at a glance?* | Terminology and quick definitions linking to deeper documents. | **vs. Concept:** a quick definition and a link; a concept is the canonical guide. |

### 3.1 Choosing when two categories both fit

The definitions above separate most documents on sight. Three questions settle the rest, and they are asked in this order.

**Who owes it?** More than one implementation owes a contract, so it is a spec however it is written — a procedure binding several readers is still a contract, and writing it as steps is a choice about clarity rather than about category. One implementation owes its own order, so that is a flow.

**Is its spine a sequence or a boundary?** A document whose shape is *this, then this, then this* is a flow, even where every stage lives in one module. A document whose shape is *this side owns that, and here is what crosses* is a module, even where it lists the stages in passing.

**Is it rewritten as the design moves, or never again?** The whole position, kept current, is a vision. One fork at one moment, left standing as a record of what was traded away, is a decision.

A document that answers two of these differently is two documents, and section 4 says how to tell that from a subsection.

**A vision document precedes the categories derived from it.** Where a bundle has one, its specifications, concepts and decisions are written from it rather than transcribed from an implementation, and they say so.

## 4. Granularity: when to create, when to fold

### 4.1 Create a standalone document

Create one if the topic meets any of:

* **First-class domain primitive** — independent identity, lifecycle or syntax.
* **System-wide architecture or constraint** — governs multiple modules.
* **Full multi-stage pipeline** — an entire operational lifecycle.
* **Formal protocol or schema** — a verifiable external contract.
* **Discrete historical fork** — competing options with distinct trade-offs.
* **Documented trap** — a non-obvious failure mode citing specific sources.

### 4.2 Fold into an existing document

Fold the content as a `##` subsection instead if it is:

* **A sub-mechanism of one entity** — the rule applies to one parent only.
* **A single pipeline stage** — an internal step of a larger pipeline.
* **A field or parameter variation** — flags and options of a broader operation.
* **Tightly-coupled state detail** — timers, thresholds and transitions of one module.

### 4.3 Use the glossary

Add a one-paragraph definition to `glossary/` if the term needs orientation rather than architectural rules of its own.

## 5. Cross-referencing and link resolution

Documents form a navigable graph through explicit links:

* **Glossary to concepts and specs** — a quick definition links to the full document.
* **Flows to modules and specs** — a step links to whatever performs it.
* **Decisions to patterns and specs** — a record links to what resulted from it.
* **Specs to vision** — a derived contract links to the intent it came from.
* **Guides to everything** — a guide is a path and links out at every step, so a reader who wants the whole rule leaves for it. Nothing links back to a guide: a document that needed one would be saying too little on its own.
* **Gotchas to source files** — through `resource:` in front matter.

Link syntax:

* **Within a bundle** — root-relative, `[Title](/category/document.md)`.
* **Across bundles** — the OKF URI, `[Title](kb:<bundle-id>/category/document.md)`.
* **Source code** — a repository-relative path in `resource:`.

**A cross-bundle link is a string nothing checks.** The repositories are separate git repositories mounted as ignored directories, so no tool resolves a `kb:` URI across that boundary and nothing will notice when one rots. The convention that follows: **name bundles and documents, never paths into another repository**, because a name can be searched and a broken path only looks correct.

## 6. Which bundle a document belongs to

This project is four git repositories, three of which are mounted inside the first as ignored directories — see [the repository topology decision](/decisions/repo-topology.md). A repository that has something of its own to say carries its own bundle, and the question of what goes where is answered by section 3's discrimination rule rather than by convenience.

**The umbrella bundle holds what is true of the ecosystem.** The model, the vocabulary every repository uses, the contracts more than one repository implements, the decisions that bind the whole project — and one brief module page per repository, saying what that repository is for and why it exists apart.

**A repository's bundle holds what is true of its code and nowhere else.** The order its passes run in, the shape of its command line, what its toolchain does to it, what a shape there costs. A note there earns its place by being unguessable from the source: if the code says it plainly, the code is the record.

**The cut is the one section 3 already makes.** A spec states an external contract and is written from the vision, so it sits with the umbrella. A module states internal implementation, so it sits with the implementation. A document that is half of each is split, not filed under whichever half is larger.

**A brief points and does not restate.** A module page in the umbrella links into the repository's bundle for the detail; the repository's bundle links back for the intent. Neither copy is checked against the other, which is exactly why neither may become a copy.

**A repository with nothing of its own to say carries no bundle.** `crunes-skills` is four markdown files whose entire contract is that they state no API surface; that contract is one decision, and it lives in the umbrella. A bundle created there would hold a heading and a link.

## 7. The index

The root `index.md` groups every document under level-2 headings matching the active categories:

```markdown
---
okf_version: 0.2
kb_version: 0.1
kb: <bundle-identifier>
---

# <Bundle title>

<Brief overview of scope and purpose>

## Concepts

* [Document title](/concepts/document.md) - The document's description, repeated exactly.

## Specifications

* [Document title](/specs/document.md) - The document's description, repeated exactly.
```

**A bullet's text is the target document's `description`, byte for byte.** One fact in one place: a description rewritten when its document changes cannot leave a stale summary behind in an index nobody thought to open. A bullet that has drifted is a fault, and it is machine-checkable.

A directory index carries the same bullets for its own documents, under a single heading naming the category, and no front matter.

## 8. Registering a bundle

A bundle nobody registered is invisible rather than broken: the files are there, and `crunes run kb` does not know it exists. Registration is two edits in the project's `.crunes/config.json`, both on the `kb` plugin rune's fully-qualified entry:

```json
{
  "runes": {
    "crunes-plugins@kb:kb": {
      "vars": { "roots": ["docs/kb/main"] },
      "permissions": {
        "run": {
          "allow": [
            "fs.glob:docs/kb/main/**/*.md",
            "fs.read:docs/kb/main/**"
          ]
        }
      }
    }
  }
}
```

**Every root needs its own `fs.glob` and `fs.read` pair, and declaring `allow` replaces the plugin's grants entirely rather than adding to them.** A root listed in `roots` without the matching grants fails at the glob with a permission error naming the pattern; grants without the root are never reached. The two edits are one edit in practice — do one and the bundle is worse off than before, because it now fails loudly instead of being quietly absent.

Roots are configured rather than discovered because a grant is matched against the pattern string the rune passes to `fs.glob`, not against the paths it resolves to: a pattern built at runtime from a directory the rune just found could never have been granted in advance.

## 9. Diagrams

**A diagram is a fenced `mermaid` block**, and there is no second way to draw one. It renders where these documents are read and stays a diff a reader can follow, which an image does not.

**A diagram illustrates and never states.** Every fact it draws is written in prose in the same document, because a reader who cannot render it must lose nothing. A diagram carrying a step, a limit or a rule that appears nowhere else is a fault.

**Where a flow document has one, it comes early**, before the prose that walks the same sequence: a reader who has seen the shape follows the steps more easily than one assembling the shape from them.

**A node's id says what the node is**, in lower snake case, as a name does anywhere else in this project. `A` and `B` make a diagram that has to be rendered before it can be read, which is the one thing a fenced block is supposed to avoid.

**Short, and not one letter.** `resolve_key`, `check_grant` and `spawn_isolate` carry the sequence on their own; a label repeating the whole node text crowds the source it was supposed to make readable. Where a step is a command, the command's name is already the shortest true id it could have.

## 10. Numbers

**A number in a document is either the argument or it is generated.** There is no third kind that survives contact with a change.

**The argument.** Where the number is the point — what a timeout is, how many config layers there are and therefore what overrides what — it stays, and the paragraph names what recomputes it. A reader who cannot check a figure has to believe it, and a figure nobody can check is the first one to go stale.

**Generated.** A total a tool can count — namespaces, subcommands, modules — is stated where a tool checks it, and nowhere else. `crunes docs utils` counts the namespaces; a second copy of that count in a document here is not a convenience, it is the copy that will be wrong. This is not hypothetical: the note that said the `docs` group had ten subcommands while listing twelve had been wrong for months.

**Neither.** A count that is in a sentence making some other point is deleted. *"Thirteen modules, each owning its own commands"* is a sentence about modules owning their commands; the count earns nothing there, and it is wrong the first time a module is added.

**The test: delete the number and read the sentence again.** If it still makes its point, the number was never making it.
