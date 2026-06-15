import { sqlite, cache, fs, section, md } from '@utils'

export async function run() {
  const db = await sqlite.open('@local-sqlite', 'app')
  const h = await cache.open('@local-cache', 'migrations')

  const files = (await fs.glob('*.sql', { cwd: 'migrations' })).sort()
  const applied = []
  const skipped = []

  for (const file of files) {
    if (await h.has(file)) {
      skipped.push(file)
      continue
    }
    const sql = await fs.read(`migrations/${file}`)
    await db.run(sql)
    await h.set(name, true)
    applied.push(file)
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
