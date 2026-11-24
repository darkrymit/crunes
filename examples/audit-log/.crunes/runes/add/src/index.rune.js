import { fs, cache, rune, section, md } from '@utils'

export async function args(b) {
  return b
    .positional('<message>', 'Message to append to the audit log')
    .option('--help', 'Show help')
    .build()
}

export async function run(args) {
  if (args.help) return rune.helpSection()
  const message = args._[0]
  const h = await cache.open('@local-cache', 'audit-log')

  if (!(await h.has('initialized'))) {
    await fs.append('audit.log', `# Audit Log — initialized ${new Date().toISOString()}\n`)
    await h.set('initialized', true)
  }

  const line = `[${new Date().toISOString()}] ${message}\n`
  await fs.append('audit.log', line)

  return section.create('added', {
    type: 'markdown',
    content: md.p(`Appended: ${md.code(line.trim())}`),
  })
}
