import { http, ws, section, md, help } from '@utils'

export async function args(b) {
  return b
    .option('--jobs <n>', 'Number of jobs to submit', '3')
    .option('--port <p>', 'Worker port', '3700')
    .option('--help', 'Show help')
    .build()
}

export async function run(args) {
  if (args.help) return help.section()
  const jobCount = parseInt(args.jobs, 10)
  const port = parseInt(args.port, 10)
  const base = `http://127.0.0.1:${port}`
  const wsBase = `ws://127.0.0.1:${port}`

  // 1. Poll /health until ready (5s timeout)
  let ready = false
  for (let i = 0; i < 25; i++) {
    try {
      const res = await http.fetch(`${base}/health`)
      const body = await res.json()
      if (body.ok) { ready = true; break }
    } catch {}
    await new Promise(r => setTimeout(r, 200))
  }
  if (!ready) throw new Error('Worker did not become ready within 5s — run: crunes run server start')

  // 2. Submit N jobs
  const submitResults = await Promise.all(
    Array.from({ length: jobCount }, () =>
      http.fetch(`${base}/jobs`, { method: 'POST' }).then(r => r.json())
    )
  )
  const ids = submitResults.map(r => r.id)

  // 3. Per-job completion promises and log collectors
  const completions = new Map()   // jobId → { promise, resolve }
  const logLines = new Map()      // jobId → string[]
  for (const id of ids) {
    logLines.set(id, [])
    const entry = { promise: null, resolve: null }
    entry.promise = new Promise(resolve => { entry.resolve = resolve })
    completions.set(id, entry)
  }

  // 4. Open /jobs WS — watches for completion events
  const jobsConn = ws.client(`${wsBase}/jobs`)
  jobsConn.on('message', (msg) => {
    try {
      const evt = JSON.parse(msg)
      if (evt.event === 'completed' && completions.has(evt.id)) {
        completions.get(evt.id).resolve()
      }
    } catch {}
  })
  await jobsConn.open()

  // 5. Open /logs/:jobId WS per job
  const logConns = await Promise.all(ids.map(async (id) => {
    const conn = ws.client(`${wsBase}/logs/${id}`)
    conn.on('message', (line) => {
      logLines.get(id).push(line)
    })
    await conn.open()
    return conn
  }))

  // 6. Wait for all completions
  await Promise.all(ids.map(id => completions.get(id).promise))

  // 7. Close all WS connections
  await jobsConn.close()
  await Promise.all(logConns.map(c => c.close()))

  // 8. Build report table
  const header = '| Job ID | Status | Logs |'
  const separator = '|--------|--------|------|'
  const rows = ids.map(id => {
    const logs = logLines.get(id).join(' → ')
    return `| ${id} | done | ${logs} |`
  })
  const table = [header, separator, ...rows].join('\n')

  return section.create('report', {
    type: 'markdown',
    content: [
      md.p(`Submitted ${jobCount} job(s) to ${base}`),
      '',
      table,
    ].join('\n'),
  })
}
