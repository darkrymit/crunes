import { fs, json, section, md, help } from '@utils'

export async function args(b) {
  return b
    .option('--name <project-name>', 'Name for the new project')
    .option('--help', 'Show help')
    .build()
}

export async function run(args) {
  if (args.help) return help.section()
  const { name } = args

  if (await fs.exists('.crunes/config.json')) {
    return section.create('init', {
      type: 'markdown',
      content: md.p('Already initialized — `.crunes/config.json` exists.'),
    })
  }

  await json.write('.crunes/config.json', {
    name,
    runes: {},
  })
  await json.write('package.json', {
    name,
    version: '0.1.0',
    type: 'module',
  })
  await fs.mkdir('.github/workflows')

  return section.create('init', {
    type: 'markdown',
    content: [
      md.p(`Initialized ${md.bold(name)}`),
      md.p('Created:'),
      md.p('- `.crunes/config.json`'),
      md.p('- `package.json`'),
      md.p('- `.github/workflows/`'),
    ].join('\n'),
  })
}
