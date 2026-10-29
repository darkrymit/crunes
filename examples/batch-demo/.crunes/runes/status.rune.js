import { json, section, md } from '@utils'

export async function run() {
  const pkg = await json.read('package.json', { throw: false })

  if (!pkg) {
    return section.create('status', {
      type: 'markdown',
      title: 'Status',
      content: md.p('No `package.json` found in current directory.'),
    })
  }

  const scriptLines = Object.entries(pkg.scripts ?? {})
    .map(([k, v]) => `  - ${md.code(k)}: ${v}`)

  return section.create('status', {
    type: 'markdown',
    title: 'Status',
    content: [
      md.p(`${md.bold(pkg.name ?? '(unnamed)')} v${md.code(pkg.version ?? '0.0.0')}`),
      pkg.description ? md.p(pkg.description) : null,
      scriptLines.length > 0
        ? md.p(`Scripts:\n${scriptLines.join('\n')}`)
        : md.p('No scripts defined.'),
    ].filter(Boolean).join('\n'),
  })
}
