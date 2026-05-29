# Remote Notes Database Example

A sample project showcasing `utils.db` for Postgres inside sandboxed Crunes runes.

## Quick Start

1. Initialize the project environment and database:
   ```bash
   crunes use init
   ```

2. Manage notes:
   ```bash
   # List notes (default active list)
   crunes use notes

   # Filter by tag
   crunes use notes list --tag database

   # Search note content
   crunes use notes list --search "vectors"

   # Add a new note with native array tags
   crunes use notes add --title "AI Study" --content "Research embedding models" --tags ai,research

   # Soft-delete a note
   crunes use notes delete --id 1

   # View all notes including soft-deleted ones
   crunes use notes list --all
   ```
