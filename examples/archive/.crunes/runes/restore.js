import { archive, fs, md, section } from '@utils'

export async function use(args) {
  const backups = (await fs.glob('backups/*.zip')).sort()

  if (backups.length === 0) {
    return [
      section.create('restore', {
        type: 'markdown',
        content: md.p(`${md.bold('No backups found.')} Run the ${md.code('backup')} rune first.`),
      }),
    ]
  }

  const latest = backups.at(-1)
  await archive.unzip(latest, 'restore')

  const restored = await fs.glob('restore/**')

  return [
    section.create('restore', {
      type: 'markdown',
      content: [
        md.p(`Extracted ${md.code(latest)} → ${md.code('restore/')}`),
        md.p('Restored files:'),
        md.ul(restored.map(f => md.code(f))),
      ].join('\n'),
    }),
  ]
}
