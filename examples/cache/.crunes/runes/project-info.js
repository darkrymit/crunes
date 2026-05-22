import { projectName, projectVersion } from '@project/project-meta.js'
import { md, section } from '@utils'

export async function use() {
  return [
    section.create('project-info', {
      type: 'markdown',
      content: md.p(
        `Project: ${md.bold(projectName)} v${md.code(projectVersion)}`
      ),
    }),
  ]
}
