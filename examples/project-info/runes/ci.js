import { fs, yaml, md, section } from '@utils'

export async function use(args) {
  const files = await fs.glob('.github/workflows/*.yml')
  if (files.length === 0) return []

  const sections = []

  for (const file of files) {
    const wf   = await yaml.read(file)
    const name = wf.name ?? file

    const triggers = wf['on']
    const triggerNames = triggers == null
      ? []
      : typeof triggers === 'string'
        ? [triggers]
        : Array.isArray(triggers)
          ? triggers
          : Object.keys(triggers)

    const jobs = Object.keys(wf.jobs ?? {})
    const stem = file.split('/').pop().replace(/\.yml$/, '')

    const lines = [
      md.h3(name),
      md.p(`${md.bold('Triggers:')} ${triggerNames.join(', ') || '(none)'}`),
      jobs.length && (
        md.p(md.bold('Jobs:')) +
        md.ul(jobs)
      ),
    ].filter(Boolean)

    sections.push(section.create(`ci:${stem}`, {
      type: 'markdown',
      content: lines.join('\n'),
    }))
  }

  return sections
}
