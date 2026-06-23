import { fs, crypt, codec, section, md, help } from '@utils'

export async function args(b) {
  return b
    .option('--file <basename>', 'Filename as stored (e.g. secrets.txt)')
    .option('--password <text>', 'Decryption password')
    .option('--help', 'Show help')
    .build()
}

export async function run(args) {
  if (args.help) return help.section()
  const { file, password } = args

  const key = codec.fromUtf8(password.padEnd(32, '0').slice(0, 32))
  const iv = codec.fromUtf8('crunes-vault-iv!')

  const ciphertext = await fs.readBytes(`vault/${file}.enc`)
  const plaintext = await crypt.decrypt('aes-256-cbc', key, iv, ciphertext)

  const dest = `decrypted/${file}`
  await fs.writeBytes(dest, plaintext)

  return section.create('decrypted', {
    type: 'markdown',
    content: md.p(`Decrypted → ${md.code(dest)} (${plaintext.length} bytes)`),
  })
}
