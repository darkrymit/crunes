import { rune, cache, section, md, time, help } from '@utils'

let activeId = 'default'

// ---------------------------------------------------------------------------
// Registry helpers — single cache entry holds all named servers
// ---------------------------------------------------------------------------

async function openRegistry() {
  return cache.open('@local-project-cache', 'dev-server-registry')
}

async function readRegistry() {
  const c = await openRegistry()
  return (await c.get('servers')) ?? {}
}

async function writeRegistry(servers) {
  const c = await openRegistry()
  await c.set('servers', servers)
}

async function readEntry(id) {
  const servers = await readRegistry()
  return servers[id] ?? null
}

async function writeEntry(id, entry) {
  const servers = await readRegistry()
  servers[id] = entry
  await writeRegistry(servers)
}

async function deleteEntry(id) {
  const servers = await readRegistry()
  delete servers[id]
  await writeRegistry(servers)
}

// ---------------------------------------------------------------------------
// Run mode
// ---------------------------------------------------------------------------

export async function args(b) {
  return b
    .positional('<action>', 'start | stop | reload | restart | status | list')
    .option('--id <name>', 'Server instance name', 'default')
    .option('--port <n>', 'Port (used with start)', '3000')
    .example('crunes run server start', 'Start default server on port 3000')
    .example('crunes run server start --id myapp --port 3001', 'Start named server on port 3001')
    .example('crunes run server reload --id myapp', 'Reload named server')
    .example('crunes run server list', 'List all running servers')
    .option('--help', 'Show help')
    .build()
}

export async function run(args) {
  if (args.help) return help.section()
  const action = args._[0]
  const id = args.id
  const port = args.port

  switch (action) {
    case 'start':   return cmdStart(id, port)
    case 'stop':    return cmdStop(id)
    case 'reload':  return cmdReload(id)
    case 'restart': return cmdRestart(id)
    case 'status':  return cmdStatus(id)
    case 'list':    return cmdList()
    default:
      return section.create('error', {
        type: 'markdown',
        content: md.p(`Unknown action: ${action}. Use start | stop | reload | restart | status | list`),
      })
  }
}

// ---------------------------------------------------------------------------
// Repl mode
// ---------------------------------------------------------------------------

export async function argsRepl(b) {
  return b
    .option('--id <name>', 'Initial active server instance', 'default')
    .example('crunes repl server', 'Start interactive manager')
    .example('crunes repl server --id myapp', 'Start manager targeting myapp')
    .option('--help', 'Show help')
    .build()
}

export async function repl(args) {
  if (args.help) return help.section()
  activeId = args.id
  return prompt()
}

export function commandsRepl(b) {
  return b
    .command('select',  'Switch active server',  sub => sub.positional('<name>', 'Server instance name'))
    .command('list',    'List all server instances')
    .command('start',   'Start active server',   sub => sub.option('--port <n>', 'Port', '3000'))
    .command('stop',    'Stop active server')
    .command('reload',  'Reload active server')
    .command('restart', 'Restart active server')
    .command('status',  'Show status of active server')
}

export async function inputRepl(input) {
  if (input.type === 'eof') return { type: 'done' }
  if (input.type !== 'command') return undefined

  const cmd = input.args.$command

  if (cmd === 'select') {
    activeId = input.args.name
    return { type: 'prompt', text: prompt() }
  }
  if (cmd === 'list')    { section.emit(await cmdList());                              return undefined }
  if (cmd === 'start')   { section.emit(await cmdStart(activeId, input.args.port));   return undefined }
  if (cmd === 'stop')    { section.emit(await cmdStop(activeId));                     return undefined }
  if (cmd === 'reload')  { section.emit(await cmdReload(activeId));                   return undefined }
  if (cmd === 'restart') { section.emit(await cmdRestart(activeId));                  return undefined }
  if (cmd === 'status')  { section.emit(await cmdStatus(activeId));                   return undefined }

  return undefined
}

// ---------------------------------------------------------------------------
// Shared command implementations
// ---------------------------------------------------------------------------

async function cmdStart(id, port) {
  const existing = await readEntry(id)
  if (existing?.jobId && await rune.job.exists(existing.jobId)) {
    return section.create('status', {
      type: 'markdown',
      content: md.p(`Already running (id: ${id}, job: ${existing.jobId}, port: ${existing.port})`),
    })
  }

  const job = await rune.job.start('server-worker', ['--port', String(port)], { repl: true })
  await writeEntry(id, { jobId: job.id, port: String(port), startedAt: new Date().toISOString() })

  return section.create('started', {
    type: 'markdown',
    content: md.p(`Started server "${id}" on port ${port} (job: ${job.id})`),
  })
}

async function cmdStop(id) {
  const entry = await readEntry(id)
  if (!entry?.jobId) {
    return section.create('status', { type: 'markdown', content: md.p(`No server found with id "${id}"`) })
  }
  await rune.job.writeEof(entry.jobId)
  for (let i = 0; i < 10; i++) {
    await time.after(200)
    if (!await rune.job.exists(entry.jobId)) break
  }
  await rune.job.kill(entry.jobId)
  await deleteEntry(id)
  return section.create('stopped', {
    type: 'markdown', content: md.p(`Stopped server "${id}" (job: ${entry.jobId})`),
  })
}

async function cmdReload(id) {
  const entry = await readEntry(id)
  if (!entry?.jobId) {
    return section.create('status', { type: 'markdown', content: md.p(`No server found with id "${id}"`) })
  }
  await rune.job.write(entry.jobId, 'reload')
  return section.create('reloaded', {
    type: 'markdown', content: md.p(`Sent reload to server "${id}" (job: ${entry.jobId})`),
  })
}

async function cmdRestart(id) {
  const entry = await readEntry(id)
  const port = entry?.port ?? '3000'
  if (entry?.jobId) {
    await cmdStop(id)
  }
  return cmdStart(id, port)
}

async function cmdStatus(id) {
  const entry = await readEntry(id)
  if (!entry?.jobId) {
    return section.create('status', { type: 'markdown', content: md.p(`No server found with id "${id}"`) })
  }
  const alive = await rune.job.exists(entry.jobId)
  let lastLine = '(no output yet)'
  if (alive) {
    const sections = await rune.job.sections(entry.jobId)
    const statusSections = sections.filter(s => s.name === 'status' && s.data?.attrs?.status)
    if (statusSections.length > 0) {
      lastLine = statusSections[statusSections.length - 1].data.content.trim()
    }
  }
  return section.create('status', {
    type: 'markdown',
    content: md.table(
      ['id', 'port', 'alive', 'started', 'last status'],
      [[id, entry.port, alive ? 'yes' : 'no', entry.startedAt, lastLine]]
    ),
  })
}

async function cmdList() {
  const servers = await readRegistry()
  const entries = Object.entries(servers)
  if (entries.length === 0) {
    return section.create('list', { type: 'markdown', content: md.p('No servers registered.') })
  }
  const rows = await Promise.all(entries.map(async ([name, entry]) => {
    const alive = entry?.jobId ? await rune.job.exists(entry.jobId) : false
    return [name, entry?.port ?? '?', alive ? 'yes' : 'no', entry?.startedAt ?? '?']
  }))
  return section.create('list', {
    type: 'markdown',
    content: md.table(['id', 'port', 'alive', 'started'], rows),
  })
}

// ---------------------------------------------------------------------------

function prompt() {
  return `[dev-server:${activeId}]> `
}
