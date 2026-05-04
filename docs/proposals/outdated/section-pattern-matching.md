---
tags:
  - completed
---

# Proposal: Section Pattern Matching

## Overview
Currently, the section selection syntax in both the CLI (`crunes use rune::section1,section2`) and the ACI plugin (`$rune::section1,section2`) strictly matches exact section names. This proposal introduces support for **glob pattern matching** within the section syntax. 

This enhancement will allow users and AI agents to request multiple dynamic sections at once, using wildcard patterns such as `*` or `prefix-*` (e.g., `crunes use myrune::endpoint-*`).

---

## Nomenclature & Syntax
The section syntax remains `::` followed by a comma-separated list. However, each item in the list will now be evaluated as a glob pattern using `micromatch`.

| Input | Behavior |
| :--- | :--- |
| `crunes use docs::endpoints` | Strict match for the `endpoints` section (backward compatible) |
| `crunes use docs::api-*` | Matches any section starting with `api-` (e.g. `api-auth`, `api-users`) |
| `crunes use docs::*` | Matches all sections (effectively equivalent to omitting the section filter) |
| `$docs::model-*,errors` | ACI plugin prompt syntax combining glob matching and strict matching |

---

## Implementation Groundwork

### 1. `crunes-cli`
The CLI manages section filtering in `src/commands/use.js`. We will replace the strict `Array.prototype.includes` check with pattern matching using the `micromatch` library (already present as a project dependency).

**Current:**
```javascript
const filtered = sectionFilter
  ? sections.filter(s => sectionFilter.includes(s.name))
  : sections
```

**Proposed:**
```javascript
import micromatch from 'micromatch'

// ...

const filtered = sectionFilter
  ? sections.filter(s => micromatch.isMatch(s.name, sectionFilter))
  : sections
```

### 2. `crunes-aci`
The AI Context Interface (ACI) plugin passes `$key::section` syntax directly to the CLI hook wrapper (`crunes-aci/scripts/hook-wrapper.js`).

1. **Regex Validation:** Verify that the token regex `(?:=([^:$\\s]*))?(?:::([^$\\s]*))?` correctly captures wildcard characters (like `*`). Since `*` is neither a `$` nor whitespace, the regex natively supports passing the glob pattern through to the CLI.
2. **Skill Documentation:** Update `crunes-aci/skills/crunes-use/SKILL.md` to document glob pattern capabilities so that AI agents know they can use `$key::prefix-*` to explore contextual domains effectively.

### 3. Utility for Rune Authors
To ensure rune authors (API consumers) can efficiently skip generating expensive sections without reinventing pattern matching logic inside the isolated sandbox, we will introduce a new `utils.section.match()` method available directly on the `utils` object passed to runes.

**API Usage inside a Rune:**
```javascript
export async function use(dir, args, utils) { // Note: opts is removed
  const sections = [];

  // You can still access the raw array of requested patterns (previously opts.sections)
  const requested = utils.section.selected(); // null | string[]

  // Automatically checks against the requested glob patterns
  // (utils.section.match knows the patterns internally, but you can override by passing an array as the second arg)
  if (utils.section.match('expensive-data')) {
    const data = await performHeavyComputation();
    sections.push(utils.section.create('expensive-data', { type: 'markdown', content: data }));
  }

  return sections;
}
```

**Implementation:**
Since runes can run in both trusted (plugin) and untrusted (isolated project) environments, we need to implement this in two places:
1. **Host `utils` (`src/api/utils/index.js`):** Refactor the `section` utility from a function to an object containing `create` (the original function) and `match` (using `micromatch.isMatch`).
2. **Isolated `utils` (`src/isolation/runner.js` & `utils-bootstrap.js`):** Expose `$__utils_section_match` as an `ivm.Reference` to the isolated V8 instance, which delegates to the host's `micromatch`. Then, in `utils-bootstrap.js`, update `utils.section` to be an object with `create` and `match` methods using `applySync`.

---

## Breaking Changes
To maintain consistency across the `utils` API (where utilities like `fs`, `json`, and `env` are objects with methods), `utils.section` will no longer be a callable function.
- **Before:** `utils.section('name', data)`
- **After:** `utils.section.create('name', data)`
All existing runes that call `utils.section()` will need to be migrated to `utils.section.create()`.

---

## Benefits
- **AI Agent Autonomy:** AI agents can flexibly request variations of a section without needing to know the exact strict name ahead of time.
- **Enhanced UX:** Users can type shorthand globs to fetch batches of related context (e.g., pulling all test-related sections using `::test-*`).
- **Developer Experience:** Provides a seamless API utility `utils.section.match()` for rune authors to cleanly optimize their execution paths.
- **Low Cost & High Impact:** Utilizes existing `micromatch` infrastructure in the `crunes-cli`, requiring no new dependencies and minimal code churn.
