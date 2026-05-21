import { section } from '@utils'

export async function use(args) {
  return section.create('hello', {
    type: 'markdown',
    content: 'Hello, World!',
  })
}
