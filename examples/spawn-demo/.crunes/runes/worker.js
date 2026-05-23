import { time, section } from '@utils'

export async function use() {
  // Keep alive for up to 1 hour; killed via rune.kill() long before that in normal usage.
  await time.after(3_600_000)
  return section.create('done', { type: 'markdown', content: 'Worker exited' })
}
