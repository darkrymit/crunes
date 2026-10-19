---
type: spec
title: Knowledge base layout
description: "crunes's layout standard for knowledge bundles, OKF v0.2 stated whole with each rule marked by its source (OKF, KB, EXT): the bundle tree and the four bundles of this project, front matter and trust fields, categories with modules for src/ directories, links, one-level indexes, which bundle a document belongs to across four repositories, registering a bundle with the kb plugin, diagrams and numbers."
tags: [knowledge-base, okf, spec]
generated: { by: claude-code/claude-opus-5-5 }
---

# Knowledge base layout

The directory layout, metadata, cross-referencing and categorization every knowledge bundle in this project follows.

**This is the whole standard, stated rather than diffed**, and nothing else has to be open to read it. It is this project's own reading of what a knowledge base should be, built from what two sources got right. OKF v0.2 means the specification published at `github.com/GoogleCloudPlatform/open-knowledge-format` (SPEC.md); third-party guides such as okf.md are not the source. Each rule is marked with where it comes from, and a rule drawing on two sources carries both marks (**OKF+KB.**):

* **OKF** — Google's Open Knowledge Format v0.2, restated here.
* **KB** — the crunes knowledge-base layout and its `kb` tooling: bundle ids, cross-bundle links, a set of categories with rules for choosing between them, and index bullets that repeat descriptions.
* **EXT** — this project's own addition or choice.

**EXT.** Two things set this project's copy apart, and both follow from what crunes is. The structural category is `modules/`, because `src/<module>/` is what this codebase calls its parts. And a bundle is not merely written but **registered** (section 12), because the reader is the `kb` plugin: crunes reads its own knowledge base through a rune it ships.

How strictly a rule binds is in its wording: MUST, SHOULD and MAY, as OKF uses them. An OKF reader accepts a bundle that ignores every KB and EXT rule; this project's lint does not. Where this document is silent, OKF v0.2 governs.

## 1. Bundle structure

**OKF.** A bundle is a directory tree of markdown files, organized however suits the knowledge in it. Documents may sit at the bundle root or in subdirectories at any depth. Two filenames are reserved at every level and are never documents: `index.md` (section 8) and `log.md` (section 9). Every other `.md` file is a document.

```
<bundle>/
  index.md          # optional: what this folder holds, for progressive disclosure
  log.md            # optional: dated history of this scope
  <document>.md     # a document at the root
  <folder>/         # folders group documents
    index.md
    <document>.md
    <folder>/
      ...
```

**KB.** A bundle lives at `docs/kb/<bundle-id>/`.

**EXT.** This project has four bundles. The directory is named for the identifier, except the proposals bundle:

| Repository | Directory | `kb` identifier |
|---|---|---|
| `crunes` (umbrella) | `docs/kb/crunes/` | `crunes` |
| `crunes` (umbrella), work proposals | `docs/kb/wp/` | `crunes-wp` |
| `crunes-cli` | `docs/kb/crunes-cli/` | `crunes-cli` |
| `crunes-plugins` | `docs/kb/crunes-plugins/` | `crunes-plugins` |

Every cross-bundle link is written against the identifier rather than the path: the directory answers *where do I put this*; the identifier answers *which bundle is meant*.

**EXT.** **A design that is not yet true of any repository lives in `crunes-wp`**, a second bundle in the umbrella at `docs/kb/wp/`. It obeys this standard like any other bundle. What sets it apart is that nothing in it describes shipped behaviour: where it and another bundle disagree, the other bundle describes what exists.

A document there names the documents it would change, in whichever bundle holds them. When its proposal is accepted, the content is written into the bundle that owns it — by section 7, as if it had never been a proposal — and the document leaves `crunes-wp`. A proposal is never accepted by moving its file.

**OKF+KB.** Documents sit in folders named for their kind, using the common category names of section 4, the way OKF's own example keeps its metrics in `metrics/` and types each `Metric`.

**EXT.** Category names are a shared vocabulary, not a fixed top level. A category folder MAY sit at any depth, and folders around it are topic folders with free names; either nests in the other as the bundle needs (`specs/`, `auth/specs/`, `specs/wire/`). Every folder carries an `index.md` (section 8); `log.md` is not used (section 9). A folder is created with its first document, never ahead of use.

```
docs/kb/<bundle-id>/
├── index.md              # root: okf_version, kb, kb_version; one bullet per folder
├── specs/                # a category folder at the top
│   ├── index.md          # H1, one paragraph that is the folder's description, one level of bullets
│   └── wire-format.md    # type: spec
└── auth/                 # a topic folder, free name
    ├── index.md
    ├── specs/            # a category folder under a topic
    │   ├── index.md
    │   └── tokens.md     # type: spec
    └── decisions/
        ├── index.md
        └── sessions.md   # type: decision
```

The categories a bundle uses are listed in its indexes, not drawn here.

## 2. Documents

### 2.1 Front matter

Every document begins with a YAML front matter block between two `---` lines.

```yaml
---
type: <kind>                  # OKF: required
title: <Human-readable title> # OKF: recommended
description: <One sentence>   # OKF+KB: required here
tags: [<tag1>, <tag2>]        # OKF: optional
resource: <url or path>       # OKF: optional, the asset the document describes
# status, sources, generated, verified: section 3
---
```

**OKF.** `type` is the only key OKF requires, and its value is free: a reader treats an unknown type as a generic document. `resource` takes any form from section 6. A producer MAY add keys of its own; a reader keeps keys it does not know and never rejects a document for them.

**OKF+KB.** A document's `type` SHOULD be the singular of the nearest category folder above it (`auth/specs/tokens.md` is a `spec`); a document under no category folder takes any short descriptive type.

**EXT.** A module document carries `resource:`, pointing at the directory it describes (`src/<module>/`). A gotcha carries one where it names a specific file.

**OKF+KB.** `description` is one sentence. OKF recommends it; here it MUST be present, because every index bullet naming the document repeats it exactly (section 8), so it is written once and read wherever the document is listed.

### 2.2 Body

**OKF.** The body is markdown with no required sections; headings, lists, tables and fenced code are preferred over free prose. `Schema` (an asset's fields) and `Examples` are conventional section names.

**EXT.** The body SHOULD open with an H1 equal to `title`, so the title survives when a tool shows the body without its front matter. Sections are `##`, and OKF's conventional names are used at that level (`## Schema`, `## Examples`).

## 3. Provenance, trust and lifecycle

**OKF.** These fields are optional; a document without them is valid and reads as unverified.

```yaml
status: stable                # draft | stable | deprecated; absent means stable
sources:                      # what the document derives from
  - id: <key>                 # needed when the body cites the source
    resource: <url, path or scope>
    title: <label>
generated: { by: <actor> }    # who last changed the content meaningfully
verified:                     # who confirmed it against its sources or resource, and when
  - { by: <actor>, at: <datetime> }
```

**OKF.** In each `sources` entry, `resource` is required: an absolute URL, a bundle path (`/specs/x.md`), a repository path, or a scope a reader cannot follow (`all sessions in October`). A claim cites a source with a markdown footnote whose label is the entry's `id` (`…sharded daily.[^schema]`); the label is the join key, so reordering the list never misattributes a claim. A source that is another document in a bundle carries its own `sources`, and a reader may follow that chain.

**OKF.** `generated.by` is required within `generated`. `verified` is a list of checks, each with `by` and `at`, where `at` is ISO 8601 with an explicit offset (`2026-10-19T14:00:00Z`); a single check may be written as one mapping, and a reader treats it as a one-item list. The two are independent: content can change without being checked again, and be checked again without changing.

**OKF.** A reader derives a trust tier from `verified`: none is unverified; checks only by actors without the `human:` prefix is machine-confirmed; any check by a `human:` actor is human-reviewed. A tier is a signal, not access control.

**OKF.** An actor takes one of three forms: `<producer>/<version>` for an agent or tool, `human:<id>` for a person, `process:<id>` for an automated job. A producer MUST use `human:` for content a person wrote or confirmed.

**EXT.** An agent SHOULD be named `<harness>/<model>` (`claude-code/claude-opus-5-5`), read from the session's own environment rather than recalled. A person SHOULD be named by their public handle, lowercase, never a real name (`human:jdoe`).

**OKF.** `status` is `draft` (not yet reviewed, possibly incomplete), `stable` (ready) or `deprecated` (no longer current, kept for links and history).

**OKF+EXT.** A deprecated document stays in place with its links and index bullet, and its body says what replaced it.

**EXT.** Trust fields record what happened, never a reconstruction: `generated` and `verified` are written when a document is written, edited or checked, and history nobody recorded is left absent rather than guessed.

**EXT.** Not used here: `generated.at` and `stale_after`, since version control dates every change and nothing here expires on a date; the per-source signals `author`, `last_modified`, `usage_count` and `usage_window`; and attested computations.

## 4. Categories: common names for folders and types

**KB.** The categories below are common names, each used for a folder and for the `type` of the documents in it, and each defined by the question it answers and a rule for telling it from its neighbors.

**EXT.** This project uses `modules/` where the template has `subsystems/`, and its rows below say what each category holds here. They are a recommendation, not a fixed layout: a category folder sits wherever the bundle needs it (section 1). A bundle uses the categories it needs, and MAY add one with a row stating its primary question, scope and discrimination rule.

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
| **`log/`** | *What changed, and when?* | **EXT**, optional, for a bundle read without its version control history: one document per dated entry, named `YYYY-MM-DD-<slug>.md`, its index newest first. | **vs. Decision:** a decision records a fork and what was traded away; a log entry records that something changed. **vs. Case:** a case is an episode that taught something; a log entry teaches nothing on its own. |

### 4.1 Choosing when two categories both fit

**KB.** The definitions above separate most documents on sight. Three questions settle the rest, and they are asked in this order.

**Who owes it?** More than one implementation owes a contract, so it is a spec however it is written — a procedure binding several readers is still a contract, and writing it as steps is a choice about clarity rather than about category. One implementation owes its own order, so that is a flow.

**Is its spine a sequence or a boundary?** A document whose shape is *this, then this, then this* is a flow, even where every stage lives in one module. A document whose shape is *this side owns that, and here is what crosses* is a subsystem or module, even where it lists the stages in passing.

**Is it rewritten as the design moves, or never again?** The whole position, kept current, is a vision. One fork at one moment, left standing as a record of what was traded away, is a decision.

A document that answers two of these differently is two documents, and section 5 says how to tell that from a subsection.

**A vision document precedes the categories derived from it.** Where a bundle has one, its specifications, concepts and decisions are written from it rather than transcribed from an implementation, and they say so.

## 5. Granularity: when to create, when to fold

### 5.1 Create a standalone document

**KB.** Create one if the topic meets any of:

* **First-class domain primitive** — independent identity, lifecycle or syntax.
* **System-wide architecture or constraint** — governs multiple modules.
* **Full multi-stage pipeline** — an entire operational lifecycle.
* **Formal protocol or schema** — a verifiable external contract.
* **Discrete historical fork** — competing options with distinct trade-offs.
* **Documented trap** — a non-obvious failure mode citing specific sources.

### 5.2 Fold into an existing document

**KB.** Fold the content as a `##` subsection instead if it is:

* **A sub-mechanism of one entity** — the rule applies to one parent only.
* **A single pipeline stage** — an internal step of a larger pipeline.
* **A field or parameter variation** — flags and options of a broader operation.
* **Tightly-coupled state detail** — timers, thresholds and transitions of one module.

### 5.3 Use the glossary

**KB.** Add a one-paragraph definition to `glossary/` if the term needs orientation rather than architectural rules of its own.

## 6. Links and paths

**OKF.** A document links to another with a standard markdown link, either bundle-absolute (`[Title](/specs/document.md)`, resolved from the bundle root) or relative (`[Title](../specs/document.md)`). A link asserts a relationship; the surrounding prose says which. A reader tolerates a link whose target does not exist yet. A path-valued field (`resource`, `sources[].resource`) takes an absolute URL, a bundle-absolute path or a relative path. A `references/` folder conventionally mirrors outside material inside the bundle, for sources to point at.

**OKF+EXT.** Links SHOULD be bundle-absolute, since they survive moving the linking document. A source file is named in `resource:` by its repository path.

**EXT.** This project's lint reports a broken link as a fault, though an OKF reader would accept it: a producer holds itself to more than a reader may demand.

**KB.** A link into another bundle uses `[Title](kb:<bundle-id>/category/document.md)`, where `<bundle-id>` is the target root index's `kb` key. An OKF reader sees an unknown link scheme and tolerates it as it tolerates a broken link.

**EXT.** **A cross-bundle link is a string nothing checks.** The repositories are separate git repositories mounted as ignored directories, so no tool resolves a `kb:` URI across that boundary and nothing will notice when one rots. The convention that follows: **name bundles and documents, never paths into another repository**, because a name can be searched and a broken path only looks correct.

**KB.** Documents form a navigable graph through these links:

* **Glossary to concepts and specs** — a quick definition links to the full document.
* **Flows to subsystems and specs** — a step links to whatever performs it.
* **Decisions to patterns and specs** — a record links to what resulted from it.
* **Specs to vision** — a derived contract links to the intent it came from.
* **Guides to everything** — a guide is a path and links out at every step, so a reader who wants the whole rule leaves for it. Nothing links back to a guide: a document that needed one would be saying too little on its own.
* **Gotchas to source files** — through `resource:` in front matter.

## 7. Which bundle a document belongs to

**EXT.** This project is four git repositories, three of which are mounted inside the first as ignored directories — see [the repository topology decision](/decisions/repo-topology.md). A repository that has something of its own to say carries its own bundle, and the question of what goes where is answered by section 4's discrimination rule rather than by convenience.

**The umbrella bundle holds what is true of the ecosystem.** The model, the vocabulary every repository uses, the contracts more than one repository implements, the decisions that bind the whole project — and one brief module page per repository, saying what that repository is for and why it exists apart.

**A repository's bundle holds what is true of its code and nowhere else.** The order its passes run in, the shape of its command line, what its toolchain does to it, what a shape there costs. A note there earns its place by being unguessable from the source: if the code says it plainly, the code is the record.

**The cut is the one section 4 already makes.** A spec states an external contract and is written from the vision, so it sits with the umbrella. A module states internal implementation, so it sits with the implementation. A document that is half of each is split, not filed under whichever half is larger.

**A brief points and does not restate.** A module page in the umbrella links into the repository's bundle for the detail; the repository's bundle links back for the intent. Neither copy is checked against the other, which is exactly why neither may become a copy.

**A repository with nothing of its own to say carries no bundle.** `crunes-skills` is four markdown files whose entire contract is that they state no API surface; that contract is one decision, and it lives in the umbrella. A bundle created there would hold a heading and a link.

## 8. Indexes

**OKF.** An `index.md` MAY sit in any folder and lists what that folder holds, so a reader sees what is there before opening anything. It carries no front matter, except `okf_version` at the bundle root. Its body groups bullets under headings, each bullet a link, a dash and a short description.

**EXT.** Every folder holding documents or subfolders SHOULD carry an `index.md`, and each index lists one level: its own documents, then one bullet per subfolder. A reader goes down the tree an index at a time rather than reading the whole bundle at once. An index opens with an H1 naming the folder and one paragraph saying what it holds; that paragraph is the folder's description. Bullets are grouped under `##` headings.

**KB.** A document's bullet repeats its `description` byte for byte. **EXT.** A subfolder's bullet repeats that folder's index paragraph the same way. One fact lives in one place, so a description rewritten with its document cannot leave a stale summary behind in an index nobody thought to open. A bullet that has drifted is a fault, and it is machine-checkable.

The root index declares the bundle:

```markdown
---
okf_version: "0.2"
kb: crunes
kb_version: "0.2"
---

# <Bundle title>

<One paragraph on the bundle's scope and purpose.>

## Categories

* [Specifications](/specs/) - The first paragraph of specs/index.md, repeated exactly.
* [Vision](/vision/) - The first paragraph of vision/index.md, repeated exactly.

## Documents

* [Document title](/document.md) - A root document's description, repeated exactly.
```

**OKF.** `okf_version` is the only front matter OKF permits in an index. **KB.** `kb` is the bundle id that `kb:` links name, and `kb_version` marks the index as a bundle root for the kb tooling. **EXT.** `kb_version` is also the version of this layout the bundle follows (section 11). A strict OKF check flags these two keys; an OKF reader still MUST NOT reject a bundle for unknown front matter keys.

## 9. History

**OKF.** `log.md` is reserved at every level for a dated change history.

**EXT.** `log.md` is not used; version control is the history. A bundle that must carry its history inside itself, for a reader without the repository, uses the `log/` category (section 4).

## 10. Conformance

**OKF.** A bundle conforms to OKF v0.2 when every non-reserved `.md` file has parseable front matter, every front matter has a non-empty `type`, and every `index.md` and `log.md` follows its section. A reader never rejects a bundle for missing optional fields, unknown types or keys, broken links or missing indexes.

**EXT.** A bundle here also follows every KB and EXT rule above, and this project's lint checks them: descriptions repeated in indexes, links resolving, the shape of trust fields, and each bundle extension's own rules. The lint holds the producer to this document; it never decides what an OKF reader accepts.

## 11. Versioning

**OKF.** `okf_version` names the OKF version a bundle targets. A minor version adds without breaking; a major version may rename or retire. A reader that does not know the declared version reads the bundle as best it can.

**EXT.** `kb_version` is the version of this layout. It changes when a bundle written to the old layout would read wrongly under the new one. `0.1` is the layout before this restatement: every document linked from the root index, one level of category folders, and a reading of OKF that did not follow its text. `0.2` is this document.

## 12. Registering a bundle

**EXT.** A bundle nobody registered is invisible rather than broken: the files are there, and `crunes run kb` does not know it exists. Registration is two edits in the project's `.crunes/config.json`, both on the `kb` plugin rune's fully-qualified entry:

```json
{
  "runes": {
    "crunes-plugins@kb:kb": {
      "vars": { "roots": ["docs/kb/crunes"] },
      "permissions": {
        "run": {
          "allow": [
            "fs.glob:docs/kb/crunes/**/*.md",
            "fs.read:docs/kb/crunes/**"
          ]
        }
      }
    }
  }
}
```

**Every root needs its own `fs.glob` and `fs.read` pair, and declaring `allow` replaces the plugin's grants entirely rather than adding to them.** A root listed in `roots` without the matching grants fails at the glob with a permission error naming the pattern; grants without the root are never reached. The two edits are one edit in practice — do one and the bundle is worse off than before, because it now fails loudly instead of being quietly absent.

Roots are configured rather than discovered because a grant is matched against the pattern string the rune passes to `fs.glob`, not against the paths it resolves to: a pattern built at runtime from a directory the rune just found could never have been granted in advance.

## 13. Diagrams

**EXT.** **A diagram is a fenced `mermaid` block**, and there is no second way to draw one. It renders where these documents are read and stays a diff a reader can follow, which an image does not.

**A diagram illustrates and never states.** Every fact it draws is written in prose in the same document, because a reader who cannot render it must lose nothing. A diagram carrying a step, a limit or a rule that appears nowhere else is a fault.

**Where a flow document has one, it comes early**, before the prose that walks the same sequence: a reader who has seen the shape follows the steps more easily than one assembling the shape from them.

**A node's id says what the node is**, in lower snake case, as a name does anywhere else in this project. `A` and `B` make a diagram that has to be rendered before it can be read, which is the one thing a fenced block is supposed to avoid.

**Short, and not one letter.** `resolve_key`, `check_grant` and `spawn_isolate` carry the sequence on their own; a label repeating the whole node text crowds the source it was supposed to make readable. Where a step is a command, the command's name is already the shortest true id it could have.

## 14. Numbers

**EXT.** **A number in a document is either the argument or it is generated.** There is no third kind that survives contact with a change.

**The argument.** Where the number is the point — what a timeout is, how many config layers there are and therefore what overrides what — it stays, and the paragraph names what recomputes it. A reader who cannot check a figure has to believe it, and a figure nobody can check is the first one to go stale.

**Generated.** A total a tool can count — namespaces, subcommands, modules — is stated where a tool checks it, and nowhere else. `crunes docs utils` counts the namespaces; a second copy of that count in a document here is not a convenience, it is the copy that will be wrong. This is not hypothetical: the note that said the `docs` group had ten subcommands while listing twelve had been wrong for months.

**Neither.** A count that is in a sentence making some other point is deleted. *"Thirteen modules, each owning its own commands"* is a sentence about modules owning their commands; the count earns nothing there, and it is wrong the first time a module is added.

**The test: delete the number and read the sentence again.** If it still makes its point, the number was never making it.
