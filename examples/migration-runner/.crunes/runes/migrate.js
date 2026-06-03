import { sqlite, cache, fs, section, md } from '@utils'

export async function run() {
  const db = await sqlite.open('@local-project-sqlite', 'app')
  const h = await cache.open('@local-project-cache', 'migrations')

  const files = (await fs.glob('migrations/*.sql')).sort()
  const applied = []
  const skipped = []

  for (const file of files) {
    const name = file.split('/').pop().split('\\').pop()
    if (await h.has(name)) {
      skipped.push(name)
      continue
    }
    const sql = await fs.read(file)
    await db.run(sql)
    await h.set(name, true)
    applied.push(name)
  }

  await db.close()

  return section.create('migrate', {
    type: 'markdown',
    content: [
      applied.length > 0
        ? md.p(`Applied (${applied.length}): ${applied.map(f => md.code(f)).join(', ')}`)
        : md.p('No new migrations.'),
      skipped.length > 0
        ? md.p(`Skipped (${skipped.length}): ${skipped.map(f => md.code(f)).join(', ')}`)
        : null,
    ].filter(Boolean).join('\n'),
  })
}
