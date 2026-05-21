import { bold }        from '@plugin/lib/format.js'
import { projectName } from '@project/src/config.js'
import { md, section } from '@utils'

export async function use(args) {
  return [
    section.create('plugin-greet', {
      type: 'markdown',
      content: md.p(`Plugin says: ${bold(projectName)}`),
    }),
  ]
}
