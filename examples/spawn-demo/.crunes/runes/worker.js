import { time, section } from '@utils'

export async function use() {
  // Stays alive for up to 1 hour; terminated earlier via rune.kill() in normal usage
  await time.after(3_600_000)
  return section.create('done', { type: 'markdown', content: 'Worker exited' })
}
