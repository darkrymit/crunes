import { greet }       from '../shared/greet.js'
import { projectName } from '@project/src/config.js'
import { md, section } from '@utils'

export async function use() {
  return [
    section.create('local-imports', {
      type: 'markdown',
      content: [
        md.p(greet(projectName)),
        md.p(`Loaded project config via @project/: ${md.bold(projectName)}`),
      ].join('\n'),
    }),
  ]
}
