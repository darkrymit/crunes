import { fs, section, md } from '@utils'

export async function use() {
  const content = await fs.read('notes.md')
  if (!content) {
    return section.create('notes', {
      type: 'markdown',
      content: md.p('No notes yet. Run `crunes use notes:add` to add one.'),
    })
  }
  return section.create('notes', {
    type: 'markdown',
    content: content,
  })
}
