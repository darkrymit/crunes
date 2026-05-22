// Copied from hello-world plugin via: crunes create greeting --from hello-world@hello-world
// Customise this rune — it lives in your project and you own it.
//
// permissions:
//   use:
//     allow: []   — add patterns here if you use utils.shell or utils.fs
//     deny:  []

import { md, section } from '@utils'

export async function args(b) {
  return b
    .positional('[who]', 'Name to greet (default: World)')
    .build()
}

export async function use(args) {
  const who = args._[0] ?? 'World'

  const content = [
    md.h3(`Hello, ${who}!`),
    md.p('Add your own context here.'),
  ].join('\n')

  return section.create('greeting', { type: 'markdown', content })
}
