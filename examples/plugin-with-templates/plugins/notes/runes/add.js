import { fs, section, md } from '@utils'

export async function args(b) {
  return b.positional('<note>', 'Note text to append').build()
}

export async function use(args) {
  const note = args._[0]
  const line = `- [${new Date().toISOString()}] ${note}\n`
  await fs.append('notes.md', line)
  return section.create('added', {
    type: 'markdown',
    content: md.p(`Added: ${md.code(note)}`),
  })
}
