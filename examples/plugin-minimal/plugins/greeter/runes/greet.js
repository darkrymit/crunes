import { rune, section, md } from '@utils'

export async function args(b) {
  return b.positional('<name>', 'Name to greet').option('--help', 'Show help').build()
}

export async function run(args) {
  if (args.help) return rune.helpSection()
  const name = args._[0]
  return section.create('greeting', {
    type: 'markdown',
    content: md.p(`Hello, ${md.bold(name)}! Greetings from the local marketplace.`),
  })
}
