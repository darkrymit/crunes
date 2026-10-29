import { fs, rune, section, md } from '@utils'

export async function args(b) {
  return b.positional('<note>', 'Note text to append').option('--help', 'Show help').build()
}

export async function run(args) {
  if (args.help) return rune.helpSection()
  const note = args._[0]
  const line = `- [${new Date().toISOString()}] ${note}\n`
  await fs.append('notes.md', line)
  return section.create('added', {
    type: 'markdown',
    content: md.p(`Added: ${md.code(note)}`),
  })
}
