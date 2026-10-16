import { section, md } from '@utils'

export async function run() {
  return section.create('hello', {
    type: 'markdown',
    content: md.p('Hello, World!'),
  })
}
