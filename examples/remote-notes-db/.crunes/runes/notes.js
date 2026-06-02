import { env, db, section, md } from '@utils'

export async function args(b) {
  return b
    .command("add", "Add a new note", (sub) => {
      sub.option("--title <text>", "Title of the note", "")
      sub.option("--content <text>", "Content of the note", "")
      sub.option("--tags <text>", "Comma-separated tags", "")
    })
    .command("delete", "Soft-delete a note by ID", (sub) => {
      sub.option("--id <number>", "ID of the note to delete", 0)
    })
    .command("list", "List active notes (default)", (sub) => {
      sub.option("--all", "Show all notes including soft-deleted ones", false)
      sub.option("--search <query>", "Search note content case-insensitively", "")
      sub.option("--tag <tag>", "Filter notes by native tag containment", "")
    })
    .build()
}

export async function use(args) {
  const host = await env.read('DB_HOST', 'localhost')
  const port = await env.read('DB_PORT', '5432')
  const user = await env.read('DB_USER', 'postgres')
  const pass = await env.read('DB_PASSWORD', 'password')
  const name = await env.read('DB_NAME', 'notes_db')
  const uri = `postgres://${user}:${pass}@${host}:${port}/${name}`

  const client = await db.connect(uri)

  const cmd = args.$command || 'list'

  // --- ADD NOTE ---
  if (cmd === 'add') {
    const title = args.title || 'Untitled'
    const content = args.content || ''
    const rawTags = args.tags ? args.tags.split(',').map(t => t.trim()) : []

    const insertSql = `
      INSERT INTO notes (title, content, tags) 
      VALUES ($1, $2, $3::text[]) 
      RETURNING id, title;
    `
    const result = await client.get(insertSql, [title, content, rawTags])
    await client.close()

    return section.create('note-added', {
      type: 'markdown',
      content: [
        md.h2('Note Created'),
        md.p(`Successfully created note **${result.title}** (ID: \`${result.id}\`) with tags: ${rawTags.map(t => md.code(t)).join(', ') || '*none*'}`)
      ].join('\n')
    })
  }

  // --- SOFT DELETE ---
  if (cmd === 'delete') {
    const id = Number(args.id)
    if (!id) {
      await client.close()
      throw new Error('Please provide a valid note ID to delete via --id <number>')
    }

    const updateSql = `
      UPDATE notes 
      SET deleted_at = CURRENT_TIMESTAMP 
      WHERE id = $1 
      RETURNING id, title;
    `
    const result = await client.get(updateSql, [id])
    await client.close()

    if (!result) {
      throw new Error(`Note with ID ${id} was not found.`)
    }

    return section.create('note-deleted', {
      type: 'markdown',
      content: [
        md.h2('Note Soft-Deleted'),
        md.p(`Successfully marked note **${result.title}** (ID: \`${result.id}\`) as soft-deleted.`)
      ].join('\n')
    })
  }

  // --- LIST NOTES (DEFAULT) ---
  let querySql = `SELECT id, title, content, tags, created_at, deleted_at FROM notes`
  const conditions = []
  const params = []

  // Soft deletion filter
  if (!args.all) {
    conditions.push('deleted_at IS NULL')
  }

  // Tag filter (Postgres array containment operator)
  if (args.tag) {
    params.push(args.tag)
    conditions.push(`tags @> ARRAY[$${params.length}::text]`)
  }

  // Search filter
  if (args.search) {
    params.push(`%${args.search}%`)
    conditions.push(`(title ILIKE $${params.length} OR content ILIKE $${params.length})`)
  }

  if (conditions.length > 0) {
    querySql += ` WHERE ` + conditions.join(' AND ')
  }

  querySql += ` ORDER BY id ASC;`

  const rows = await client.query(querySql, params)
  await client.close()

  const mdRows = rows.map(row => {
    const isDeleted = row.deleted_at !== null
    const tagsStr = row.tags && row.tags.length > 0
      ? row.tags.map(t => md.code(t)).join(' ')
      : '*none*'
    
    const titleLine = isDeleted 
      ? md.h3(`~~${row.title}~~ (Deleted)`) 
      : md.h3(row.title)

    return [
      titleLine,
      `* **ID:** \`${row.id}\` | **Created:** *${new Date(row.created_at).toLocaleString()}*`,
      `* **Tags:** ${tagsStr}`,
      `* **Content:**`,
      `  > ${row.content}`
    ].join('\n')
  })

  return section.create('notes-list', {
    type: 'markdown',
    content: [
      md.h2('Database Notes'),
      mdRows.length > 0 ? mdRows.join('\n\n---\n\n') : '*No notes found.*'
    ].join('\n')
  })
}
