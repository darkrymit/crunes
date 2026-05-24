# ws example

Demonstrates `utils.ws.client()` — connects to a local WebSocket echo server, sends
3 messages, and returns the echoed replies as a section.

## Run it

**Terminal 1** — start the echo server (requires `ws` in node_modules):

```bash
# from crunes-cli/ directory (where ws is installed):
node ../examples/ws/echo-server.mjs
# or pass a custom port:
node ../examples/ws/echo-server.mjs 3100
```

**Terminal 2** — run the rune:

```bash
crunes use echo                        # connects to ws://localhost:3099 (default)
crunes use echo ws://localhost:3100    # custom URL
```

## Permissions

The rune declares `ws.client:ws://localhost:**` to allow connecting to any port on localhost.
Change this in `.crunes/config.json` to match your server URL.
