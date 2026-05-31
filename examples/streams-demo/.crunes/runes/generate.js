import {crypto, fs, section} from '@utils';

export const args = (b) => b
  .option('--size <value>', 'Size in MB to generate', 1024)
  .build()

export async function use(args) {
  const totalChunks = args.size
  const chunkSize = 1024 * 1024 // 1MB chunk

  const stream = fs.writeStreamAsBytes('large_data.bin')
  const writer = stream.getWriter()

  for (let i = 0; i < totalChunks; i++) {
    const chunk = crypto.randomBytes(chunkSize)
    await writer.write(chunk)
    if ((i + 1) % 100 === 0) {
      console.log(`Written ${i + 1} MB...`)
    }
  }

  await writer.close()

  const stats = await fs.stat('large_data.bin')

  return section.create('result', {
    type: 'markdown',
    content: `Generated \`large_data.bin\` (${stats.size} bytes)`,
  })
}
