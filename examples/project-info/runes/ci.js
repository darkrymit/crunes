export async function use(dir, args, utils) {
  const files = await utils.fs.glob('.github/workflows/*.yml')
  if (files.length === 0) return []

  const sections = []

  for (const file of files) {
    const wf   = await utils.yaml.read(file)
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
      utils.md.h3(name),
      utils.md.p(`${utils.md.bold('Triggers:')} ${triggerNames.join(', ') || '(none)'}`),
      jobs.length && (
        utils.md.p(utils.md.bold('Jobs:')) +
        utils.md.ul(jobs)
      ),
    ].filter(Boolean)

    sections.push(utils.section.create(`ci:${stem}`, {
      type: 'markdown',
      content: lines.join('\n'),
    }))
  }

  return sections
}
