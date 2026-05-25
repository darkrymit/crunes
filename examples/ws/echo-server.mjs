// Simple WebSocket echo server for smoke-testing utils.ws.
// Usage: node echo-server.mjs [port]   (default port: 3099)
import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'

const port = Number(process.argv[2] ?? 3099)
const httpServer = createServer()
const wss = new WebSocketServer({ server: httpServer })

wss.on('connection', (ws) => {
  ws.on('message', (message, isBinary) => {
    if (isBinary) {
      ws.send(message, { binary: true })
    } else {
      ws.send(String(message))
    }
  })
})

httpServer.listen(port, () => {
  console.log(`echo server listening on ws://localhost:${port}`)
})
