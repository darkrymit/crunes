import { sqlite, md, section } from '@utils'

export async function use(args) {
  const db = await sqlite.open('@project-sqlite', 'notes')

  await db.exec('CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, text TEXT, created_at INTEGER)')
  const text = `Note at ${new Date().toISOString()}`
  await db.exec('INSERT INTO notes (text, created_at) VALUES (?, ?)', [text, Date.now()])

  const rows = await db.query('SELECT * FROM notes ORDER BY created_at DESC LIMIT 5')
  const total = await db.get('SELECT COUNT(*) AS count FROM notes')

  await db.close()

  return [
    section.create('notes', {
      type: 'markdown',
      content: [
        md.p(`Total notes: ${md.bold(String(total.count))}`),
        md.p('Last 5:'),
        ...rows.map(r => md.p(`- ${md.code(r.text)}`)),
      ].join('\n'),
    }),
  ]
}
