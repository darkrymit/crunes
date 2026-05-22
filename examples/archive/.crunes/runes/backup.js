import { archive, fs, md, section } from '@utils'

export async function use() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const dest = `backups/${timestamp}.zip`

  await archive.zip('src', dest)

  const files = await fs.glob('src/**')

  return [
    section.create('backup', {
      type: 'markdown',
      content: [
        md.p(`Packed ${md.code('src/')} → ${md.code(dest)}`),
        md.p('Files archived:'),
        md.ul(files.map(f => md.code(f))),
      ].join('\n'),
    }),
  ]
}
