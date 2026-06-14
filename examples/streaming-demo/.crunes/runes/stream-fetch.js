import { http, section, help } from '@utils'

export const args = (b) => b
  .positional('[url]', 'URL to stream from (default: httpbin.org/stream/3)')
  .option('--help', 'Show help')
  .build()

export async function run(args) {
  if (args.help) return help.section()
  const url = args._[0] ?? 'https://httpbin.org/stream/3'
  const res = await http.fetch(url)

  if (!res.ok) {
    return section.create('error', {
      type: 'markdown',
      content: `**Error** — HTTP ${res.status} ${res.statusText}`,
    })
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  const chunks = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const text = decoder.decode(value)
    chunks.push(text)
    console.log(`[chunk ${chunks.length}] ${text.trim()}`)
  }

  return section.create('stream-final', {
    type: 'markdown',
    content: `**Done** — ${chunks.length} chunks received\n\n\`\`\`\n${chunks.join('')}\n\`\`\``,
  })
}
