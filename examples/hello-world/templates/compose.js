// Copied from hello-world plugin via: crunes create compose --from hello-world@hello-world
// Demonstrates rune composition — calls other runes and merges their output.
//
// permissions:
//   use:
//     allow: []   — add patterns here if you use utils.shell or utils.fs
//     deny:  []

export async function use(dir, args, utils) {
  // Call other runes by key. Circular calls throw a CircularRuneError automatically.
  const helloSections    = await utils.rune('hello-world:hello')
  const greetingSections = await utils.rune('greeting')

  const summarySections = [
    utils.section.create('compose-summary', {
      type: 'markdown',
      content: utils.md.p('Add your own summary or additional context here.'),
    }),
  ]

  return [...helloSections, ...greetingSections, ...summarySections]
}
