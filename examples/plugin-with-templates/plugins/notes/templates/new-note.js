import { fs, rune, section } from '@utils'

export const args = (b) => b
  .positional('<title>', 'Note title')
  .option('--help', 'Show help')
  .build()

export async function run(args) {
  if (args.help) return rune.helpSection()
  const title = args.title
  const date = new Date().toISOString()
  const entry = `\n## ${title}\n\n_${date}_\n\n<!-- Write your note here -->\n`

  await fs.append('notes.md', entry)

  return section.create('note-created', {
    type: 'markdown',
    content: `Created note **${title}** in \`notes.md\``,
  })
}
