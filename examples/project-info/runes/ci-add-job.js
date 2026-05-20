export async function use(_dir, args, utils) {
  const [file, job] = args
  if (!file || !job) {
    return [utils.section.create('ci-add-job', {
      type: 'markdown',
      content: utils.md.p(`${utils.md.bold('Error:')} required args: ${utils.md.code('<workflow.yml>')} ${utils.md.code('<job-name>')}`),
    })]
  }

  const filePath = `.github/workflows/${file}`
  if (!(await utils.fs.exists(filePath))) {
    return [utils.section.create('ci-add-job', {
      type: 'markdown',
      content: utils.md.p(`${utils.md.bold('Error:')} ${utils.md.code(filePath)} not found.`),
    })]
  }

  let alreadyExists = false
  await utils.yaml.modify(filePath, (wf) => {
    wf.jobs = wf.jobs ?? {}
    if (wf.jobs[job]) {
      alreadyExists = true
      return wf
    }
    wf.jobs[job] = { 'runs-on': 'ubuntu-latest', steps: [] }
    return wf
  })

  const content = alreadyExists
    ? utils.md.p(`${utils.md.bold('Skipped:')} job ${utils.md.code(job)} already exists in ${utils.md.code(filePath)}.`)
    : utils.md.p(`Added job ${utils.md.code(job)} to ${utils.md.code(filePath)}.`)

  return [utils.section.create('ci-add-job', { type: 'markdown', content })]
}
