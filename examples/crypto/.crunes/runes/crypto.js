import { crypto, md, section } from '@utils'

export async function use() {
  // 1. Hashing options (convenient string returns and raw bytes)
  const hashHex = await crypto.hashAsHex('sha256', 'hello, crunes')
  const hashB64 = await crypto.hashAsBase64('sha256', 'hello, crunes')
  const hashRaw = await crypto.hash('sha256', 'hello, crunes') // returns Uint8Array

  // 2. Randomizers
  const hexToken = crypto.randomHex(16)
  const b64Token = crypto.randomBase64(24)
  const id       = crypto.uuid()

  // 3. Flat composable conversions (sync inside isolate)
  const originalText = 'Secret agent intelligence report.'
  const bytes = crypto.fromUtf8(originalText)
  const hexEncoded = crypto.toHex(bytes)
  const b64Encoded = crypto.toBase64(bytes)

  // 4. Pure symmetric encryption & decryption (pure byte-to-byte operation, sync inside isolate)
  const key = new Uint8Array(32).fill(7) // 256-bit key
  const iv = new Uint8Array(16).fill(9)  // 128-bit iv
  const plaintextBytes = crypto.fromUtf8('Crunes is extremely secure!')
  
  // Encrypt to raw bytes
  const ciphertextBytes = await crypto.encrypt('aes-256-cbc', key, iv, plaintextBytes)
  // Convert cipher to hex for transmission/storage representation
  const cipherHex = crypto.toHex(ciphertextBytes)
  
  // Decrypt from raw bytes back to raw bytes
  const decryptedBytes = await crypto.decrypt('aes-256-cbc', key, iv, crypto.fromHex(cipherHex))
  const decryptedText = crypto.toUtf8(decryptedBytes)

  return [
    section.create('hashes-randoms', {
      type: 'markdown',
      title: 'Hashes & Randomizers',
      content: [
        md.p(`SHA-256 (Hex):       ${md.code(hashHex)}`),
        md.p(`SHA-256 (Base64):    ${md.code(hashB64)}`),
        md.p(`SHA-256 (Raw Len):   ${md.code(String(hashRaw.length))} bytes`),
        md.p(`Random Hex:          ${md.code(hexToken)}`),
        md.p(`Random Base64:       ${md.code(b64Token)}`),
        md.p(`UUID:                ${md.code(id)}`),
      ].join('\n'),
    }),
    section.create('conversions', {
      type: 'markdown',
      title: 'Flat Conversions',
      content: [
        md.p(`Original Text:       ${md.bold(originalText)}`),
        md.p(`Hex Representation:  ${md.code(hexEncoded)}`),
        md.p(`B64 Representation:  ${md.code(b64Encoded)}`),
      ].join('\n'),
    }),
    section.create('symmetric-encryption', {
      type: 'markdown',
      title: 'Symmetric Encrypt / Decrypt',
      content: [
        md.p(`Plaintext:           ${md.bold('Crunes is extremely secure!')}`),
        md.p(`Ciphertext (Hex):    ${md.code(cipherHex)}`),
        md.p(`Decrypted Cleartext: ${md.bold(decryptedText)}`),
      ].join('\n'),
    }),
  ]
}
