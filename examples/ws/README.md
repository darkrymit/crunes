# WebSocket Echo

Connect to a WebSocket echo server, send messages, and collect replies.

## What it demonstrates

Uses `ws.client` to open a WebSocket connection, `socket.on('message')` to handle incoming frames, `socket.sendText` to send messages, and a Promise-based done barrier to wait for all replies before closing.

## Setup

```bash
cd examples/ws
npm install
```

Start the echo server in a separate terminal:

```bash
node echo-server.mjs
```

## How to run

```bash
crunes run echo
crunes run echo ws://localhost:3099    # explicit URL
```

## What to expect

Three messages are sent and echoed back. The rune waits for all three replies, then closes the connection and returns a section listing the received messages.
