import { fs, yaml, md, section } from '@utils'

export async function use(args) {
  const [name, trigger = 'push'] = args
  if (!name) {
    return [section.create('workflow', {
      type: 'markdown',
      content: md.p(`${md.bold('Error:')} required arg: ${md.code('<workflow-stem>')}`),
    })]
  }

  const filePath = `.github/workflows/${name}.yml`
  if (await fs.exists(filePath)) {
    return [section.create('workflow', {
      type: 'markdown',
      content: md.p(`${md.bold('Skipped:')} ${md.code(filePath)} already exists.`),
    })]
  }

  const workflowName = name.charAt(0).toUpperCase() + name.slice(1)
  await yaml.write(filePath, {
    name: workflowName,
    on: trigger,
    jobs: {
      build: {
        'runs-on': 'ubuntu-latest',
        steps: [{ uses: 'actions/checkout@v4' }],
      },
    },
  })

  return [section.create('workflow', {
    type: 'markdown',
    content: md.p(`Created ${md.code(filePath)}.`),
  })]
}
