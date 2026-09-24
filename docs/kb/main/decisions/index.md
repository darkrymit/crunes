# Decisions

* [OKF bundles, one per repository that has something to say](/decisions/knowledge-base-format.md) - Knowledge is an Open Knowledge Format bundle per repository rather than one shared tree, because a repository's knowledge has to travel with the repository.
* [Four repositories with gitignored mounts](/decisions/repo-topology.md) - The umbrella repository holds documentation and examples and mounts the three published repositories as ignored directories rather than submodules.
* [Skills state no API surface](/decisions/skills-state-no-api.md) - The agent skills carry no signatures, namespace lists, flag tables or command inventories, because the installed CLI generates all of it and a copy in a skill would describe a different version.
