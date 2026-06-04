import { fs, crypto, codec, section, md } from '@utils'

export async function args(b) {
  return b
    .option('--file <path>', 'Path to the file to encrypt')
    .option('--password <text>', 'Encryption password (padded to 32 bytes)')
    .build()
}

export async function run(args) {
  const { file, password } = args

  // Demo-only key derivation: pad/truncate password to 32 bytes
  const key = codec.fromUtf8(password.padEnd(32, '0').slice(0, 32))
  // Demo-only fixed IV: never reuse a fixed IV in production
  const iv = codec.fromUtf8('crunes-vault-iv!')

  const bytes = await fs.readAsBytes(file)
  const ciphertext = await crypto.encrypt('aes-256-cbc', key, iv, bytes)

  const basename = file.split('/').pop().split('\\').pop()
  const dest = `vault/${basename}.enc`
  await fs.writeAsBytes(dest, ciphertext)

  return section.create('encrypted', {
    type: 'markdown',
    content: [
      md.p(`Encrypted ${md.code(file)} → ${md.code(dest)}`),
      md.p(`Plaintext: ${md.code(String(bytes.length))} bytes → Ciphertext: ${md.code(String(ciphertext.length))} bytes`),
    ].join('\n'),
  })
}
