import { http, ws, time, section, md } from '@utils'

export async function use() {
  const jobs = new Map()          // jobId → { id, status, logConn, pendingLogs }
  const jobsWatchers = new Set()  // active /jobs WS connections

  function broadcast(set, payload) {
    const msg = JSON.stringify(payload)
    for (const conn of set) conn.sendText(msg)
  }

  function sendLog(job, line) {
    if (job.logConn) {
      job.logConn.sendText(line)
    } else {
      job.pendingLogs.push(line)
    }
  }

  function runJob(job) {
    const { id } = job
    job.status = 'running'
    broadcast(jobsWatchers, { event: 'started', id, queueDepth: jobs.size })
    sendLog(job, `Job ${id} started`)

    setTimeout(() => {
      sendLog(job, `Job ${id} processing...`)
    }, 700)

    setTimeout(() => {
      sendLog(job, `Job ${id} almost done`)
    }, 1400)

    setTimeout(() => {
      job.status = 'done'
      broadcast(jobsWatchers, { event: 'completed', id, queueDepth: jobs.size })
      sendLog(job, `Job ${id} done`)
      if (job.logConn) { job.logConn.close(); job.logConn = null }
    }, 2000)
  }

  function handleRequest(req) {
    const { method, pathname } = req

    if (method === 'GET' && pathname === '/health') {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'content-type': 'application/json' },
      })
    }

    if (method === 'GET' && pathname === '/jobs') {
      const snapshot = [...jobs.values()].map(({ id, status }) => ({ id, status }))
      return new Response(JSON.stringify(snapshot), {
        headers: { 'content-type': 'application/json' },
      })
    }

    if (method === 'POST' && pathname === '/jobs') {
      const id = Math.random().toString(16).slice(2, 10)
      const job = { id, status: 'queued', logConn: null, pendingLogs: [] }
      jobs.set(id, job)
      runJob(job)
      return new Response(JSON.stringify({ id }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      })
    }

    return new Response('Not Found', { status: 404 })
  }

  const srv = http.server(3700)
  srv.on('request', handleRequest)

  const jobsWs = ws.server(srv, { path: '/jobs' })
  jobsWs.on('connection', (conn) => {
    jobsWatchers.add(conn)
    conn.on('close', () => jobsWatchers.delete(conn))
  })

  const logsWs = ws.server(srv, { path: '/logs/:jobId' })
  logsWs.on('connection', (conn) => {
    const jobId = conn.pathParams.get('jobId')
    const job = jobs.get(jobId)
    if (!job) {
      conn.close(4004, 'job not found')
      return
    }
    job.logConn = conn
    conn.on('close', () => { job.logConn = null })
    for (const line of job.pendingLogs) conn.sendText(line)
    job.pendingLogs = []
  })

  await srv.open()
  await jobsWs.open()
  await logsWs.open()

  console.log('[task-queue-server] worker ready on port 3700')

  await time.after(3_600_000)

  return section.create('done', { type: 'markdown', content: md.p('Worker exited after 1 hour') })
}
