import { fs, section, md } from '@utils'

export async function run() {
  if (await fs.exists('tasks.json')) {
    return section.create('init', {
      type: 'markdown',
      content: md.p('Already initialised — `tasks.json` exists.'),
    })
  }
  await fs.write('tasks.json', '[]\n')
  return section.create('init', {
    type: 'markdown',
    content: md.p('Initialised — created `tasks.json`.'),
  })
}
