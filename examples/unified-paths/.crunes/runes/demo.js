export async function use(_dir, _args, utils) {
  // --- Seed database: copy to store on first run only ---
  // .sit/ is a local dotfile dir (gitignored) — requires { dot: true } in permission matching
  const isSeeded = await utils.fs.exists('@project-sqlite/catalog.sqlite')
  if (!isSeeded) {
    const seed = await utils.sqlite.open('./.sit', 'catalog')
    await seed.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)')
    await seed.exec("INSERT INTO items (name) VALUES ('alpha'), ('beta'), ('gamma')")
    await seed.close()  // checkpoints WAL before copy
    await utils.fs.copy('./.sit/catalog.sqlite', '@project-sqlite/catalog.sqlite')
  }

  // Open the store DB (seeded on first run, accumulated on subsequent runs)
  const db = await utils.sqlite.open('@project-sqlite', 'catalog')
  await db.exec('INSERT INTO items (name) VALUES (?)', [`run-${Date.now()}`])
  const rows  = await db.query('SELECT name FROM items ORDER BY id DESC LIMIT 5')
  const total = await db.get('SELECT COUNT(*) AS n FROM items')
  await db.close()

  // --- Virtual subpath in cache: @project-cache/slots ---
  const cache = await utils.cache.open('@project-cache/slots', 'hits')
  const prev  = await cache.get('count') ?? 0
  await cache.set('count', prev + 1, 3600)

  // --- Write report to .output/ (dotfile dir) ---
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

  await utils.fs.write('./.output/report.md', report)

  return [
    utils.section.create('unified-paths-demo', {
      type: 'markdown',
      content: report,
    }),
  ]
}
