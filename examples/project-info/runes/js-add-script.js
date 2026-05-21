import { fs, json, md, section } from '@utils'

export async function use(args) {
  if (!(await fs.exists('package.json'))) {
    return [section.create('js-add-script', {
      type: 'markdown',
      content: md.p(`${md.bold('Error:')} package.json not found.`),
    })]
  }

  const [name, cmd] = args
  if (!name || !cmd) {
    return [section.create('js-add-script', {
      type: 'markdown',
      content: md.p(`${md.bold('Error:')} required args: ${md.code('<name>')} ${md.code('<command>')}`),
    })]
  }

  await json.modify('package.json', (pkg) => {
    pkg.scripts = pkg.scripts ?? {}
    pkg.scripts[name] = cmd
    return pkg
  })

  return [section.create('js-add-script', {
    type: 'markdown',
    content: md.p(`Added script ${md.code(name)} → ${md.code(cmd)} to ${md.code('package.json')}.`),
  })]
}
