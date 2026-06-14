import { shell, fs, section, md, help } from '@utils'

export async function args(b) {
  return b
    .option('--since <ref>', 'Git ref (tag or commit hash) to generate log from')
    .option('--help', 'Show help')
    .build()
}

export async function run(args) {
  if (args.help) return help.section()
  const { since } = args
  const { stdout: output } = await shell.exec(`git log ${since}..HEAD --oneline`, { trim: true })

  const commits = output
    .split('\n')
    .filter(Boolean)
    .map(line => `- ${line}`)

  if (commits.length === 0) {
    return section.create('notes', {
      type: 'markdown',
      content: md.p(`No commits found since ${md.code(since)}.`),
    })
  }

  const date = new Date().toISOString().slice(0, 10)
  const entry = `\n## ${date}\n\n${commits.join('\n')}\n`
  await fs.append('CHANGELOG.md', entry)

  return section.create('notes', {
    type: 'markdown',
    content: [
      md.p(`Appended ${md.bold(String(commits.length))} commits to ${md.code('CHANGELOG.md')}:`),
      ...commits.map(c => md.p(c)),
    ].join('\n'),
  })
}
