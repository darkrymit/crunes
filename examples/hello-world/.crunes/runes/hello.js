import { section } from '@utils'

export async function use() {
  return section.create('hello', {
    type: 'markdown',
    content: 'Hello, World!',
  })
}
