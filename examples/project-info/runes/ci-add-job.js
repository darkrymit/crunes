import { fs, yaml, md, section } from '@utils'

export async function use(args) {
  const [file, job] = args
  if (!file || !job) {
    return [section.create('ci-add-job', {
      type: 'markdown',
      content: md.p(`${md.bold('Error:')} required args: ${md.code('<workflow.yml>')} ${md.code('<job-name>')}`),
    })]
  }

  const filePath = `.github/workflows/${file}`
  if (!(await fs.exists(filePath))) {
    return [section.create('ci-add-job', {
      type: 'markdown',
      content: md.p(`${md.bold('Error:')} ${md.code(filePath)} not found.`),
    })]
  }

  let alreadyExists = false
  await yaml.modify(filePath, (wf) => {
    wf.jobs = wf.jobs ?? {}
    if (wf.jobs[job]) {
      alreadyExists = true
      return wf
    }
    wf.jobs[job] = { 'runs-on': 'ubuntu-latest', steps: [] }
    return wf
  })

  const content = alreadyExists
    ? md.p(`${md.bold('Skipped:')} job ${md.code(job)} already exists in ${md.code(filePath)}.`)
    : md.p(`Added job ${md.code(job)} to ${md.code(filePath)}.`)

  return [section.create('ci-add-job', { type: 'markdown', content })]
}
