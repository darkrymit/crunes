import { ws, md, section } from '@utils'

export async function args(b) {
  return b
    .positional('[url]', 'WebSocket URL to connect to (default: ws://localhost:3099)')
    .build()
}

export async function use(args) {
  const url = args._[0] ?? 'ws://localhost:3099'
  const socket = ws.client(url)
  const replies = []
  let count = 0

  socket.on('message', async (msg) => {
    replies.push(msg)
    count++
    if (count >= 3) socket.close()
  })

  await socket.open()
  await socket.send('hello')
  await socket.send('from')
  await socket.send('utils.ws')
  await socket.close()

  return [
    section.create('result', {
      type: 'markdown',
      content: [
        md.p(`Connected to ${md.code(url)}`),
        md.p('Echo replies:'),
        ...replies.map((r) => md.p(`  - ${md.code(r)}`)),
      ].join('\n'),
    }),
  ]
}
