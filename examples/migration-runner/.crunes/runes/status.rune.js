import { cache, fs, section, md } from '@utils'

export async function run() {
  const h = await cache.open('@local-cache', 'migrations')
  const files = (await fs.glob('*.sql', { cwd: 'migrations' })).sort()

  const rows = await Promise.all(
    files.map(async (file) => {
      const applied = await h.has(file)
      return `- ${applied ? '✓' : '○'} ${md.code(file)}`
    })
  )

  return section.create('status', {
    type: 'markdown',
    content: [md.p('Migration status:'), ...rows].join('\n'),
  })
}
