import { archive, codec, crypto, fs, section, help } from '@utils'

export const args = (b) => b.option('--help', 'Show help').build()

export async function run(args) {
  if (args.help) return help.section()
  // 1. Check if payload and secret exist
  const hasPayload = await fs.exists('packed_payload.b64')
  if (!hasPayload) {
    throw new Error('packed_payload.b64 not found. Run "crunes run pack-and-upload" first to generate the payload!')
  }
  const hasSecret = await fs.exists('secret.json')
  if (!hasSecret) {
    throw new Error('secret.json not found. Run "crunes run pack-and-upload" first to generate the symmetric keys!')
  }

  // 2. Load symmetric keys
  console.log('Loading encryption keys from secret.json...')
  const secret = JSON.parse(await fs.read('secret.json'))
  const key = codec.fromHex(secret.key)
  const iv = codec.fromHex(secret.iv)

  // 3. Stream Pipeline: Read from disk (Base64 string) -> Base64 Decode -> Decrypt -> Unzip straight to disk
  console.log('Streaming: Reading packed_payload.b64 -> Base64 Decoding -> Decrypting (AES-256-GCM) -> Unzipping to temp_extracted/...');
  
  const pipeline = fs.readStream('packed_payload.b64')
    .pipeThrough(codec.base64DecoderStream())
    .pipeThrough(crypto.decryptStream('aes-256-gcm', key, iv))
    .pipeTo(archive.unzipStream('temp_extracted'))
    
  await pipeline
  console.log('Decryption & extraction complete!')

  // 4. Verify extracted files
  const readme = await fs.read('temp_extracted/readme.txt')
  const configContent = await fs.read('temp_extracted/config.json')
  
  return section.create('results', {
    type: 'markdown',
    content: [
      '### 📦 Streaming Decode, Decrypt & Unpack Successful!',
      '',
      'Successfully read, decoded, decrypted, and extracted the Base64 zip archive on-the-fly.',
      '',
      '#### 📄 Extracted Files & Contents:',
      `*   **\`temp_extracted/readme.txt\`**:`,
      `    > ${readme}`,
      `*   **\`temp_extracted/config.json\`**:`,
      '    ```json',
      configContent.split('\n').map(l => '    ' + l).join('\n').trim(),
      '    ```'
    ].join('\n')
  })
}
