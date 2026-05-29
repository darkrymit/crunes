import { section, md } from '@utils'

export async function use() {
  return section.create('hello', {
    type: 'markdown',
    content: md.p('Hello, World!'),
  })
}
