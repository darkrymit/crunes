import { fs, yaml, section, md, help } from '@utils'

export async function args(b) {
  return b
    .option('--name <workflow-name>', 'Name of the workflow (used as filename)')
    .option('--help', 'Show help')
    .build()
}

export async function run(args) {
  if (args.help) return help.section()
  const { name } = args
  const path = `.github/workflows/${name}.yml`

  if (await fs.exists(path)) {
    return section.create('workflow', {
      type: 'markdown',
      content: md.p(`Workflow ${md.code(path)} already exists.`),
    })
  }

  await yaml.write(path, {
    name,
    on: { push: { branches: ['main'] }, pull_request: null },
    jobs: {
      ci: {
        'runs-on': 'ubuntu-latest',
        steps: [
          { uses: 'actions/checkout@v4' },
          { uses: 'actions/setup-node@v4', with: { 'node-version': 20 } },
          { run: 'npm ci' },
          { run: 'npm test' },
        ],
      },
    },
  })

  return section.create('workflow', {
    type: 'markdown',
    content: md.p(`Created ${md.code(path)}`),
  })
}
