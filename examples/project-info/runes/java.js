import { fs, xml, md, section } from '@utils'

export async function use() {
  if (!(await fs.exists('pom.xml'))) return []

  const doc        = await xml.read('pom.xml')
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
    md.h3(`${groupId}:${artifactId}  v${version}`),
    description && md.p(description),
    md.p(`${md.bold('Dependencies:')} ${depCount}`),
  ].filter(Boolean)

  return [section.create('java', { type: 'markdown', content: lines.join('\n') })]
}
