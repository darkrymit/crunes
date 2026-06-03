import { cache, fs, section, md } from '@utils'

export async function run() {
  const h = await cache.open('@local-project-cache', 'migrations')
  const files = (await fs.glob('migrations/*.sql')).sort()

  const rows = await Promise.all(
    files.map(async (file) => {
      const name = file.split('/').pop().split('\\').pop()
      const applied = await h.has(name)
      return `- ${applied ? '✓' : '○'} ${md.code(name)}`
    })
  )

  return section.create('status', {
    type: 'markdown',
    content: [md.p('Migration status:'), ...rows].join('\n'),
  })
}
