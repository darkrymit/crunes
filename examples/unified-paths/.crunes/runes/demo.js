import { fs, sqlite, cache, section } from '@utils'

export async function use() {
  const isSeeded = await fs.exists('@project-sqlite/catalog.sqlite')
  if (!isSeeded) {
    const seed = await sqlite.open('./.sit', 'catalog')
    await seed.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)')
    await seed.exec("INSERT INTO items (name) VALUES ('alpha'), ('beta'), ('gamma')")
    await seed.close()
    await fs.copy('./.sit/catalog.sqlite', '@project-sqlite/catalog.sqlite')
  }

  const db = await sqlite.open('@project-sqlite', 'catalog')
  await db.exec('INSERT INTO items (name) VALUES (?)', [`run-${Date.now()}`])
  const rows  = await db.query('SELECT name FROM items ORDER BY id DESC LIMIT 5')
  const total = await db.get('SELECT COUNT(*) AS n FROM items')
  await db.close()

  const slot = await cache.open('@project-cache/slots', 'hits')
  const prev  = await slot.get('count') ?? 0
  await slot.set('count', prev + 1, 3600)

  const seedStatus = isSeeded
    ? `Already seeded — using existing \`@project-sqlite/catalog.sqlite\`.`
    : `First run — built \`.sit/catalog.sqlite\` and copied to \`@project-sqlite/catalog.sqlite\`.`

  const report = [
    `# Unified Paths Demo`,
    ``,
    `## utils.fs.copy — seed to @project-sqlite`,
    seedStatus,
    ``,
    `Total items in store: **${total.n}**`,
    `Last 5 rows:`,
    ...rows.map(r => `- \`${r.name}\``),
    ``,
    `## @project-cache/slots/hits — virtual cache subpath`,
    `Session hit count: **${prev + 1}**`,
    ``,
    `## Dotfile directory support (.sit/, .output/)`,
    `Seed read from \`.sit/\` and report written to \`.output/\`.`,
    `Both require \`{ dot: true }\` in micromatch for \`**\` wildcards to match.`,
  ].join('\n')

  await fs.write('./.output/report.md', report)

  return [
    section.create('unified-paths-demo', {
      type: 'markdown',
      content: report,
    }),
  ]
}
