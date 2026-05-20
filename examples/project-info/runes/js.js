export async function use(dir, args, utils) {
  if (!(await utils.fs.exists('package.json'))) return []

  const pkg = await utils.json.read('package.json')
  const name        = pkg.name        ?? '(unnamed)'
  const version     = pkg.version     ?? '(no version)'
  const description = pkg.description ?? ''
  const scripts     = pkg.scripts     ?? {}
  const depCount    = Object.keys(pkg.dependencies    ?? {}).length
  const devCount    = Object.keys(pkg.devDependencies ?? {}).length

  const scriptEntries = Object.entries(scripts)

  const lines = [
    utils.md.h3(`${name}  v${version}`),
    description && utils.md.p(description),
    utils.md.p(`${utils.md.bold('Dependencies:')} ${depCount} prod, ${devCount} dev`),
    scriptEntries.length && (
      utils.md.p(utils.md.bold('Scripts:')) +
      utils.md.ul(scriptEntries.map(([k, v]) => `${utils.md.code(k)}: ${v}`))
    ),
  ].filter(Boolean)

  return [utils.section.create('js', { type: 'markdown', content: lines.join('\n') })]
}
