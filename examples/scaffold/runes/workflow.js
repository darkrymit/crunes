export async function use(_dir, args, utils) {
  const [name, trigger = 'push'] = args
  if (!name) {
    return [utils.section.create('workflow', {
      type: 'markdown',
      content: utils.md.p(`${utils.md.bold('Error:')} required arg: ${utils.md.code('<workflow-stem>')}`),
    })]
  }

  const filePath = `.github/workflows/${name}.yml`
  if (await utils.fs.exists(filePath)) {
    return [utils.section.create('workflow', {
      type: 'markdown',
      content: utils.md.p(`${utils.md.bold('Skipped:')} ${utils.md.code(filePath)} already exists.`),
    })]
  }

  const workflowName = name.charAt(0).toUpperCase() + name.slice(1)
  await utils.yaml.write(filePath, {
    name: workflowName,
    on: trigger,
    jobs: {
      build: {
        'runs-on': 'ubuntu-latest',
        steps: [{ uses: 'actions/checkout@v4' }],
      },
    },
  })

  return [utils.section.create('workflow', {
    type: 'markdown',
    content: utils.md.p(`Created ${utils.md.code(filePath)}.`),
  })]
}
