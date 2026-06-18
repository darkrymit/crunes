import { archive, codec, crypto, fs, section, help } from '@utils'

export const args = (b) => b.option('--help', 'Show help').build()

export async function run(args) {
  if (args.help) return help.section()
  // 1. Scaffolding mock directory and files
  console.log('Creating mock source directory temp_upload_source/ with files...')
  await fs.mkdir('temp_upload_source')
  await fs.write('temp_upload_source/readme.txt', 'Hello! This is a mock readme inside a streaming zip archive.')
  await fs.write('temp_upload_source/config.json', JSON.stringify({ name: 'crunes-stream-demo', status: 'streaming' }, null, 2))
  
  // 2. Generate symmetric keys and save for decryption
  console.log('Generating symmetric keys (AES-256-GCM)...')
  const key = crypto.randomBytes(32)
  const iv = crypto.randomBytes(12)
  await fs.write('secret.json', JSON.stringify({
    key: codec.toHex(key),
    iv: codec.toHex(iv)
  }, null, 2))
  console.log('Saved encryption metadata to secret.json')

  // 3. Stream Pipeline 1: Zip -> Encrypt -> Base64 -> Write to disk
  console.log('Streaming: Zipping temp_upload_source/ -> Encrypting (AES-256-GCM) -> Base64 -> writing packed_payload.b64...')
  
  const filePipeline = archive.zipStream('temp_upload_source')
    .pipeThrough(crypto.encryptStream('aes-256-gcm', key, iv))
    .pipeThrough(codec.base64EncoderStream())
    .pipeThrough(new TextEncoderStream())
  
  await filePipeline.pipeTo(fs.writeBytesStream('packed_payload.b64'))
  const stats = await fs.stat('packed_payload.b64')
  console.log(`Successfully wrote packed_payload.b64 (${stats.size} bytes)`)

  // 4. Stream Pipeline 2: Zip -> Encrypt -> Base64 -> Upload to HTTP POST
  console.log('Streaming: Zipping temp_upload_source/ -> Encrypting (AES-256-GCM) -> Base64 -> POSTing directly to httpbin.org...')
  
  const uploadPipeline = archive.zipStream('temp_upload_source')
    .pipeThrough(crypto.encryptStream('aes-256-gcm', key, iv))
    .pipeThrough(codec.base64EncoderStream())
    .pipeThrough(new TextEncoderStream())
    
  const response = await fetch('https://httpbin.org/post', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/base64',
    },
    body: uploadPipeline
  })
  
  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}: ${response.statusText}`)
  }
  
  const jsonResponse = await response.json()
  await fs.write('http_response.json', JSON.stringify(jsonResponse, null, 2))
  console.log('Successfully wrote HTTP response to http_response.json')

  return section.create('results', {
    type: 'markdown',
    content: [
      '### 🎉 Streaming Pack, Encrypt & Upload Successful!',
      '',
      `*   **Secure Encrypted Archive**: Zipped and securely encrypted on-the-fly via \`aes-256-gcm\`.`,
      `*   **Base64 Encoded Zip Archive**: Created \`packed_payload.b64\` (${stats.size} bytes) on disk.`,
      `*   **Direct HTTP Stream Upload**: Streamed encrypted zip archive bytes directly to \`https://httpbin.org/post\` with zero intermediate buffering.`,
      `*   **HTTP Response**: Captured server reply in \`http_response.json\`.`,
      '',
      'Run \`crunes run download-and-unpack\` to decode, decrypt, and extract the payload!'
    ].join('\n')
  })
}
