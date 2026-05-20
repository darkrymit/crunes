export async function use(_dir, args, utils) {
  if (!(await utils.fs.exists('pom.xml'))) {
    return [utils.section.create('java-set-version', {
      type: 'markdown',
      content: utils.md.p(`${utils.md.bold('Error:')} pom.xml not found.`),
    })]
  }

  const [version] = args
  if (!version) {
    return [utils.section.create('java-set-version', {
      type: 'markdown',
      content: utils.md.p(`${utils.md.bold('Error:')} required arg: ${utils.md.code('<version>')}`),
    })]
  }

  let oldVersion
  await utils.xml.modify('pom.xml', (doc) => {
    const p = doc.project ?? {}
    oldVersion = p.version ?? '(none)'
    p.version = version
    doc.project = p
    return doc
  })

  return [utils.section.create('java-set-version', {
    type: 'markdown',
    content: utils.md.p(`Set version: ${utils.md.code(oldVersion)} → ${utils.md.code(version)} in ${utils.md.code('pom.xml')}.`),
  })]
}
