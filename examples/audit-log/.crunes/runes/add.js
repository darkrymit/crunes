import { fs, cache, section, md } from '@utils'

export async function args(b) {
  return b
    .positional('<message>', 'Message to append to the audit log')
    .build()
}

export async function use(args) {
  const message = args._[0]
  const h = await cache.open('@local-project-cache', 'audit-log')

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
