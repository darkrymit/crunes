import { bold }        from '@plugin/lib/format.js'        // plugin-bundled lib via @plugin/
import { projectName } from '@project/src/config.js'       // project file via @project/

export async function use(_dir, _args, utils) {
  return [
    utils.section.create('plugin-greet', {
      type: 'markdown',
      content: utils.md.p(`Plugin says: ${bold(projectName)}`),
    }),
  ]
}
