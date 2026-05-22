---
tags:
  - closed
---

# Proposal: Replace Equals with Colon in Rune Syntax

## Overview
This proposal details a structural change to the AI Context Interface (ACI) markdown syntax. We propose replacing the equals sign (`=`) used for argument assignment with a single colon (`:`).

**Current:** `$rune=args::sections`
**Proposed:** `$rune:args::sections`

## Motivation

1. **Semantic Accuracy:** The `=` operator universally implies variable assignment. However, in the context of a Rune invocation, we are *passing an argument* or *targeting a domain*. The `:` symbol is standard for namespaces, labels, and URI paths (e.g., `urn:crunes:docs`), making it semantically accurate.
2. **Eliminating Visual Collisions:** As runes evolve to accept CLI-style flags, passing an option like `-c=500` creates a jarring visual collision in the current syntax: `$rune=-c=500::tree`. By switching to a colon, the syntax becomes highly readable and unambiguous: `$rune:-c=500::tree`.
3. **Hierarchical Consistency:** The colon (`:`) and double-colon (`::`) belong to the same visual family (scope/path resolution). `$rune:args::sections` visually flows as a unified hierarchical path, whereas mixing `=` and `::` looks disjointed.

## Implementation Groundwork

1. **Regex Update:** The ACI token regex must be updated to capture the first colon as the argument separator without eagerly matching the double-colon section separator.
2. **Prompt Migration:** Update the AI system prompts (e.g., in `crunes-aci/skills/crunes-use/SKILL.md`) to instruct the AI models to use the new colon syntax.
3. **Documentation:** Update all user-facing READMEs and documentation to reflect the new syntax.

## Impact on Future Expansion
By adopting `:` for arguments and keeping `::` for sections, we maintain a highly compact DSL string. This deliberately reserves other syntactical wrappers (like `[...]`) for future, overarching ACI framework directives (e.g., background execution flags, specific model targeting), preventing syntax bloat for basic command arguments.
