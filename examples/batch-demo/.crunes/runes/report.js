import { shell, fs, rune, section, md } from '@utils'

export async function args(b) {
  return b
    .command('read', 'Show recent commits (batch-safe)')
    .command('generate', 'Write recent commits to report.md (not batch-safe)')
    .option('--help', 'Show help')
    .build()
}

export async function run(args) {
  if (args.help) return rune.helpSection()
  const { stdout } = await shell.exec('git log --oneline -10 --no-decorate', { throw: false, trim: true })
  const lines = stdout ? stdout.split('\n').map(l => `- ${l}`) : ['- (no commits found)']
  const content = lines.join('\n')

  if (args.$command === 'generate') {
    await fs.write('./report.md', `# Recent Commits\n\n${content}\n`)
    return section.create('report', {
      type: 'markdown',
      title: 'Report Generated',
      content: md.p('Written to `./report.md`.'),
    })
  }

  return section.create('report', {
    type: 'markdown',
    title: 'Recent Commits',
    content,
  })
}
