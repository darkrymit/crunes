export async function use(dir, args, utils) {
  if (!(await utils.fs.exists('pom.xml'))) return []

  const doc        = await utils.xml.read('pom.xml')
  const p          = doc.project ?? {}
  const groupId    = p.groupId    ?? '(unknown)'
  const artifactId = p.artifactId ?? '(unknown)'
  const version    = p.version    ?? '(no version)'
  const description = p.description ?? ''

  const rawDeps = p.dependencies?.dependency
  const depCount = rawDeps == null
    ? 0
    : Array.isArray(rawDeps) ? rawDeps.length : 1

  const lines = [
    utils.md.h3(`${groupId}:${artifactId}  v${version}`),
    description && utils.md.p(description),
    utils.md.p(`${utils.md.bold('Dependencies:')} ${depCount}`),
  ].filter(Boolean)

  return [utils.section.create('java', { type: 'markdown', content: lines.join('\n') })]
}
