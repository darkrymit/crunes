import { fs, xml, md, section } from '@utils'

export async function args(b) {
  return b
    .positional('<version>', 'New version string to set in pom.xml (e.g. 1.2.3)')
    .build()
}

export async function use(args) {
  if (!(await fs.exists('pom.xml'))) {
    return [section.create('java-set-version', {
      type: 'markdown',
      content: md.p(`${md.bold('Error:')} pom.xml not found.`),
    })]
  }

  const [version] = args._
  if (!version) {
    return [section.create('java-set-version', {
      type: 'markdown',
      content: md.p(`${md.bold('Error:')} required arg: ${md.code('<version>')}`),
    })]
  }

  let oldVersion
  await xml.modify('pom.xml', (doc) => {
    const p = doc.project ?? {}
    oldVersion = p.version ?? '(none)'
    p.version = version
    doc.project = p
    return doc
  })

  return [section.create('java-set-version', {
    type: 'markdown',
    content: md.p(`Set version: ${md.code(oldVersion)} → ${md.code(version)} in ${md.code('pom.xml')}.`),
  })]
}
