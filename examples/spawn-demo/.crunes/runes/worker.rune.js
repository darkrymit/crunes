import { time, section } from '@utils'

export async function run() {
  // Stays alive for up to 1 hour; terminated earlier via rune.job.kill() in normal usage
  await time.after(3_600_000)
  return section.create('done', { type: 'markdown', content: 'Worker exited' })
}
