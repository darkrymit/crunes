import { fs, json, md, section } from '@utils'

export async function use() {
  if (!(await fs.exists('package.json'))) return []

  const pkg = await json.read('package.json')
  const name        = pkg.name        ?? '(unnamed)'
  const version     = pkg.version     ?? '(no version)'
  const description = pkg.description ?? ''
  const scripts     = pkg.scripts     ?? {}
  const depCount    = Object.keys(pkg.dependencies    ?? {}).length
  const devCount    = Object.keys(pkg.devDependencies ?? {}).length

  const scriptEntries = Object.entries(scripts)

  const lines = [
    md.h3(`${name}  v${version}`),
    description && md.p(description),
    md.p(`${md.bold('Dependencies:')} ${depCount} prod, ${devCount} dev`),
    scriptEntries.length && (
      md.p(md.bold('Scripts:')) +
      md.ul(scriptEntries.map(([k, v]) => `${md.code(k)}: ${v}`))
    ),
  ].filter(Boolean)

  return [section.create('js', { type: 'markdown', content: lines.join('\n') })]
}
