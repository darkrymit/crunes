import http from 'node:http'
import readline from 'node:readline'

const port = parseInt(process.env.PORT ?? '3000', 10)
let requests = 0

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      requests++
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, requests }))
    })
    server.listen(port, '127.0.0.1', () => {
      process.stdout.write(`[server] listening on :${port}\n`)
      resolve(server)
    })
  })
}

let server = await startServer()

process.on('SIGTERM', () => {
  process.stdout.write('[server] stopped\n')
  server.close(() => process.exit(0))
})

if (process.stdin.isTTY === false) {
  const rl = readline.createInterface({ input: process.stdin })

  rl.on('line', async (line) => {
    if (line.trim() === 'r') {
      process.stdout.write('[server] reloading...\n')
      server.close(async () => {
        server = await startServer()
      })
    } else {
      process.stdout.write('[server] stopped\n')
      server.close(() => process.exit(0))
    }
  })

  rl.on('close', () => {
    process.stdout.write('[server] stopped\n')
    server.close(() => process.exit(0))
  })
}
