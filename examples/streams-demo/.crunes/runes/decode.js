import { fs, section } from '@utils'

export const args = (b) => b.build()

export async function run(args) {
  const readStream = fs.readStreamAsBytes('large_data.bin')
  const writeStream = fs.writeStream('processed_data.txt')

  await readStream.pipeThrough(new TextDecoderStream()).pipeTo(writeStream)

  const stats = await fs.stat('processed_data.txt')

  return section.create('result', {
    type: 'markdown',
    content: `Processed data written to \`processed_data.txt\` (${stats.size} bytes)`,
  })
}
