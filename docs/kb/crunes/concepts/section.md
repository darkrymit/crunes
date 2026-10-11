---
type: concept
title: Section
description: The unit a rune returns — a named, typed container the caller renders, filters or pipes, so a rune never decides how its output is displayed.
tags: [concept, section, output]
---

# Section

A rune does not print. It returns sections, and the CLI renders them.

A section has a name, a type and its data:

```js
section.create('api-endpoints', { type: 'markdown', content: data })
```

The type is what makes a section more than a string. `markdown` carries prose or a table; `tree` carries a hierarchy the renderer draws with box characters and aligned columns. The renderer knows how to display each; the rune knows neither how wide the terminal is nor whether anything is being piped.

## Why the rune does not print

**The caller is not always a terminal.** The same rune is invoked by a person reading colour output, by an agent parsing text, and by a script redirecting to a file. A rune that formatted its own output would have made that decision once, for all three, at the moment it was written.

So colour, box-drawing and plain mode are a process-wide setting applied at render time, and `--plain` changes how everything displays without any rune knowing it exists.

**Sections are addressable.** Because each is named, a caller can ask for one: `crunes run api[-s endpoints]` filters by name after the rune returns. A rune returning one undifferentiated blob could not be narrowed, and an agent that needed one part of it would pay for all of it.

## Markdown fences survive plain mode

A rendered markdown section keeps its triple-backtick fences even when colour is off. The fences are not decoration — they tell whatever reads the output that the content is markdown *source* rather than prose that happens to contain asterisks. Stripping them in plain mode would lose that distinction precisely where it matters most, since plain mode is what a pipe and an agent get.

## An empty section disappears

A section with no title and no renderable data renders to an empty string and is dropped from the output. This is useful — a rune can return a section conditionally without branching its return shape — and it is also a trap, because a section whose data field is misnamed vanishes in exactly the same silent way. An unknown `type` behaves similarly: the body renders as nothing and only the header survives.
