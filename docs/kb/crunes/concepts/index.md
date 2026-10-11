# Concepts

* [Marketplace](/concepts/marketplace.md) - A named source publishing an index of installable plugins, cached locally for remote sources and read live for local ones, and never refreshed without being asked.
* [Permission](/concepts/permission.md) - A capability a rune may exercise, written as a token and a pattern, granted per lifecycle in configuration and checked at every call rather than assumed.
* [Plugin](/concepts/plugin.md) - A distributable bundle of runes and templates, installed once per machine from a marketplace and enabled per project with permissions the user consented to.
* [Rune](/concepts/rune.md) - A JavaScript module that declares a command line, runs in a sandbox with only the capabilities it was granted, and returns structured sections.
* [Section](/concepts/section.md) - The unit a rune returns — a named, typed container the caller renders, filters or pipes, so a rune never decides how its output is displayed.
