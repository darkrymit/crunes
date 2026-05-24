// Copied from hello-world plugin via: crunes create compose --from hello-world@hello-world
// Demonstrates rune composition — calls other runes and merges their output.
//
// permissions:
//   use:
//     allow: []   — add patterns here if you use utils.exec or utils.fs
//     deny:  []

import { rune, section, md } from '@utils'

export async function use() {
  // Call other runes by key. Circular calls throw a CircularRuneError automatically.
  const helloSections    = await rune.use('hello-world:hello')
  const greetingSections = await rune.use('greeting')

  const summarySections = [
    section.create('compose-summary', {
      type: 'markdown',
      content: md.p('Add your own summary or additional context here.'),
    }),
  ]

  return [...helloSections, ...greetingSections, ...summarySections]
}
