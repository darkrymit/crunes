import { sqlite, section, md } from '@utils'

export async function use() {
  const db = await sqlite.open('@project-sqlite', 'posts')
  const total = await db.get('SELECT COUNT(*) AS count FROM posts')

  if (!total || total.count === 0) {
    await db.close()
    return section.create('report', {
      type: 'markdown',
      content: md.p('No posts stored yet — run `crunes use sync` first.'),
    })
  }

  const recent = await db.query('SELECT id, title FROM posts ORDER BY id DESC LIMIT 5')
  await db.close()

  return section.create('report', {
    type: 'markdown',
    content: [
      md.p(`Total posts stored: ${md.bold(String(total.count))}`),
      md.p('Most recent 5:'),
      ...recent.map(r => md.p(`- [${r.id}] ${r.title}`)),
    ].join('\n'),
  })
}
