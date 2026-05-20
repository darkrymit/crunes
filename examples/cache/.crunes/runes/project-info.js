import { projectName, projectVersion } from '@project/project-meta.js'

export async function use(_dir, _args, utils) {
  return [
    utils.section.create('project-info', {
      type: 'markdown',
      content: utils.md.p(
        `Project: ${utils.md.bold(projectName)} v${utils.md.code(projectVersion)}`
      ),
    }),
  ]
}
