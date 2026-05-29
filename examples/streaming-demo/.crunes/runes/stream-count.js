import { shell, section } from '@utils'

export async function args(b) {
  return b
    .positional('[limit]', 'Stop after this many ticks (default: 5)')
    .build()
}

export async function use(args) {
  const limit = args._[0] ? parseInt(args._[0]) : 5
  const controller = new AbortController()
  const decoder = new TextDecoder('utf-8')
  const session = shell.execInSession('node counter.js', { signal: controller.signal })
  const ticks = []

  return new Promise((resolve, reject) => {
    session.stdout.on('data', (chunk) => {
      const lines = decoder.decode(chunk).split('\n').filter(Boolean)
      for (const line of lines) {
        ticks.push(line)
        section.emit(
          section.create('ticks-progress', {
            type: 'markdown',
            content: `**Ticks received:** ${ticks.length}\n\n**Latest:** \`${line}\`\n\n${ticks.map(t => `- ${t}`).join('\n')}`,
          })
        )
        // AbortController stop: signals the session to terminate the subprocess
        if (parseInt(line.replace('Tick: ', '')) >= limit) {
          controller.abort()
        }
      }
    })

    session.on('exit', (code) => {
      resolve(
        section.create('ticks-final', {
          type: 'markdown',
          content: `**Done** — ${ticks.length} ticks received (exit ${code})\n\n${ticks.map(t => `- ${t}`).join('\n')}`,
        })
      )
    })

    session.on('error', reject)
  })
}
