// Copied from hello-world plugin via: crunes create greeting --from hello-world@hello-world
// Customise this rune — it lives in your project and you own it.
//
// permissions:
//   use:
//     allow: []   — add patterns here if you use utils.shell or utils.fs
//     deny:  []

export async function use(dir, args, utils) {
  const who = args[0] ?? 'World'

  const content = [
    utils.md.h3(`Hello, ${who}!`),
    utils.md.p('Add your own context here.'),
  ].join('\n')

  return utils.section.create('greeting', { type: 'markdown', content })
}
