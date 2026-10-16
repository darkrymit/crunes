import { json, yaml, fs, section, md } from '@utils'

export async function run() {
  const pkg = await json.read('package.json')
  const workflows = await fs.glob('*.yml', { cwd: '.github/workflows' })

  const scriptLines = Object.entries(pkg.scripts ?? {}).map(
    ([k, v]) => `  - ${md.code(k)}: ${v}`
  )

  const workflowSections = await Promise.all(
    workflows.map(async (f) => {
      const wf = await yaml.read(`.github/workflows/${f}`)
      const triggers = Object.keys(wf.on ?? {}).join(', ')
      return `  - ${md.code(f)}: triggers on ${md.bold(triggers)}`
    })
  )

  return [
    section.create('package', {
      type: 'markdown',
      title: 'Package',
      content: [
        md.p(`${md.bold(pkg.name)} v${md.code(pkg.version)}`),
        pkg.description ? md.p(pkg.description) : null,
        scriptLines.length > 0 ? md.p(`Scripts:\n${scriptLines.join('\n')}`) : null,
      ].filter(Boolean).join('\n'),
    }),
    section.create('workflows', {
      type: 'markdown',
      title: 'CI Workflows',
      content: workflowSections.length > 0
        ? [md.p('Workflows:'), ...workflowSections].join('\n')
        : md.p('No workflows found.'),
    }),
  ]
}
