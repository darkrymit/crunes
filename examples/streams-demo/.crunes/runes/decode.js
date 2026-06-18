import { fs, section, help } from '@utils'

export const args = (b) => b
  .option('--help', 'Show help')
  .build()

export async function run(args) {
  if (args.help) return help.section()
  const readStream = fs.readBytesStream('large_data.bin')
  const writeStream = fs.writeStream('processed_data.txt')

  await readStream.pipeThrough(new TextDecoderStream()).pipeTo(writeStream)

  const stats = await fs.stat('processed_data.txt')

  return section.create('result', {
    type: 'markdown',
    content: `Processed data written to \`processed_data.txt\` (${stats.size} bytes)`,
  })
}
