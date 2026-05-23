import { rune, json, section, md } from '@utils'

const STATE_FILE = '.crunes/state/spawn-demo.json'

export async function args(b) {
  return b
    .positional('[action]', 'Action: start | stop | status (default: status)')
    .build()
}

export async function use(args) {
  const action = args._[0] ?? 'status'

  if (action === 'start') {
    const existing = await json.read(STATE_FILE, { throw: false })
    if (existing?.id && await rune.exists(existing.id)) {
      return section.create('status', {
        type: 'markdown',
        content: md.p(`Already running (job ${existing.id})`),
      })
    }
    const job = await rune.spawn('worker', [])
    await json.write(STATE_FILE, { id: job.id, startedAt: new Date().toISOString() })
    return section.create('started', {
      type: 'markdown',
      content: md.p(`Started background worker (job ${job.id})`),
    })
  }

  if (action === 'stop') {
    const state = await json.read(STATE_FILE, { throw: false })
    if (!state?.id) {
      return section.create('status', { type: 'markdown', content: md.p('Not running') })
    }
    await rune.kill(state.id)
    return section.create('stopped', {
      type: 'markdown',
      content: md.p(`Stopped job ${state.id}`),
    })
  }

  // status (default action)
  const state = await json.read(STATE_FILE, { throw: false })
  if (!state?.id) {
    return section.create('status', { type: 'markdown', content: md.p('Not running') })
  }
  const alive = await rune.exists(state.id)
  return section.create('status', {
    type: 'markdown',
    content: md.p(
      alive
        ? `Running (job ${state.id}, started ${state.startedAt})`
        : `Stopped (job ${state.id})`
    ),
  })
}
