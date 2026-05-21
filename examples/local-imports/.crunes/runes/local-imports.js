import { greet }       from '../shared/greet.js'           // .crunes/ shared lib via ./
import { projectName } from '@project/src/config.js'       // outside .crunes/ via @project/

export async function use(_dir, _args, utils) {
  return [
    utils.section.create('local-imports', {
      type: 'markdown',
      content: [
        utils.md.p(greet(projectName)),
        utils.md.p(`Loaded project config via @project/: ${utils.md.bold(projectName)}`),
      ].join('\n'),
    }),
  ]
}
