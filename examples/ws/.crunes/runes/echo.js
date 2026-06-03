import { ws, section, md } from '@utils'

export async function args(b) {
  return b
    .positional('[url]', 'WebSocket URL (default: ws://localhost:3099)')
    .build()
}

export async function run(args) {
  const url = args._[0] ?? 'ws://localhost:3099'
  const socket = ws.client(url)
  const replies = []

  // done barrier: resolves once all expected replies have arrived
  let resolveDone
  const done = new Promise((resolve) => { resolveDone = resolve })

  socket.on('message', (msg) => {
    replies.push(msg)
    if (replies.length >= 3) resolveDone()
  })

  await socket.open()
  await socket.sendText('hello')
  await socket.sendText('from')
  await socket.sendText('utils.ws')
  await done
  await socket.close()

  return section.create('result', {
    type: 'markdown',
    content: [
      md.p(`Connected to ${md.code(url)}`),
      md.p('Echo replies:'),
      ...replies.map((r) => md.p(`  - ${md.code(r)}`)),
    ].join('\n'),
  })
}
