import { shell, section, md, time, help } from '@utils'

let shellJobId = null
let pollOffset = 0
let polling = false
let lastStatus = null

export async function argsRepl(b) {
  return b
    .option('--port <n>', 'Port for the HTTP server', '3000')
    .example('crunes repl server-worker --port 3001', 'Start worker on port 3001')
    .option('--help', 'Show help')
    .build()
}

export async function repl(args) {
  if (args.help) return help.section()
  const job = await shell.job.start('node .crunes/scripts/http-server.js', {
    repl: true,
    env: { PORT: String(args.port) },
  })
  shellJobId = job.id
  pollOffset = 0
  lastStatus = null
  polling = true
  schedulePoll()
  return 'worker> '
}

export async function inputRepl(input) {
  if (input.type === 'eof') {
    await cleanup()
    return { type: 'done', message: 'Worker stopped.' }
  }

  if (input.type === 'line') {
    if (input.text === 'reload') {
      await shell.job.write(shellJobId, 'r')
      return undefined
    }
    if (input.text === 'stop') {
      await cleanup()
      return { type: 'done', message: 'Worker stopped.' }
    }
  }

  return undefined
}

export async function disposeRepl() {
  polling = false
  if (shellJobId) await cleanup()
}

// ---------------------------------------------------------------------------

async function cleanup() {
  polling = false
  if (!shellJobId) return
  await shell.job.kill(shellJobId)
  await shell.job.writeEof(shellJobId)
  await time.after(200)
}

function schedulePoll() {
  time.after(500).then(poll)
}

async function poll() {
  if (!polling || !shellJobId) return
  try {
    const stdout = await shell.job.stdout(shellJobId)
    const newText = stdout.slice(pollOffset)
    if (newText.length > 0) {
      pollOffset = stdout.length
      const lines = newText.split('\n').filter(Boolean)
      for (const line of lines) {
        let status = null
        if (line.includes('listening on')) status = 'ready'
        else if (line.includes('reloading')) status = 'reloading'
        else if (line.includes('stopped')) status = 'stopped'

        if (status && status !== lastStatus) {
          lastStatus = status
          section.emit(section.create('status', {
            type: 'markdown',
            content: md.p(`[worker] ${line.trim()}`),
            attrs: { status },
          }))
        }
      }
    }
  } catch {}
  if (polling) schedulePoll()
}
