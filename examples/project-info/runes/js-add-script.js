export async function use(_dir, args, utils) {
  if (!(await utils.fs.exists('package.json'))) {
    return [utils.section.create('js-add-script', {
      type: 'markdown',
      content: utils.md.p(`${utils.md.bold('Error:')} package.json not found.`),
    })]
  }

  const [name, cmd] = args
  if (!name || !cmd) {
    return [utils.section.create('js-add-script', {
      type: 'markdown',
      content: utils.md.p(`${utils.md.bold('Error:')} required args: ${utils.md.code('<name>')} ${utils.md.code('<command>')}`),
    })]
  }

  await utils.json.modify('package.json', (pkg) => {
    pkg.scripts = pkg.scripts ?? {}
    pkg.scripts[name] = cmd
    return pkg
  })

  return [utils.section.create('js-add-script', {
    type: 'markdown',
    content: utils.md.p(`Added script ${utils.md.code(name)} → ${utils.md.code(cmd)} to ${utils.md.code('package.json')}.`),
  })]
}
