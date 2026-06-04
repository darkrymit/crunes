import { shell, section } from '@utils'

export async function args(b) {
  return b
    .positional('[limit]', 'Stop after this many ticks (default: 5)')
    .build()
}

export async function run(args) {
  const limit = args._[0] ? parseInt(args._[0]) : 5
  const controller = new AbortController()
  const session = shell.spawn('node counter.js', { signal: controller.signal })
  const ticks = []

  return new Promise((resolve, reject) => {
    let exitCode = null
    let stdoutEnded = false

    const tryResolve = () => {
      if (exitCode !== null && stdoutEnded) {
        resolve(
          section.create('ticks-final', {
            type: 'markdown',
            content: `**Done** — ${ticks.length} ticks received (exit ${exitCode})\n\n${ticks.map(t => `- ${t}`).join('\n')}`,
          })
        )
      }
    }

    session.stdout.on('data', (chunk) => {
      const lines = chunk.split('\n').filter(Boolean)
      for (const line of lines) {
        ticks.push(line)
        section.emit(
          section.create('ticks-progress', {
            type: 'markdown',
            content: `**Ticks received:** ${ticks.length}\n\n**Latest:** \`${line}\`\n\n${ticks.map(t => `- ${t}`).join('\n')}`,
          })
        )
        if (parseInt(line.replace('Tick: ', '')) >= limit) {
          controller.abort()
        }
      }
    })

    session.stdout.on('end', () => {
      stdoutEnded = true
      tryResolve()
    })

    session.on('exit', (code) => {
      exitCode = code
      tryResolve()
    })

    session.on('error', reject)
    session.open()
  })
}
