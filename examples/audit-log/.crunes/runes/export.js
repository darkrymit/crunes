import { fs, codec, section, md } from '@utils'

export async function run() {
  const content = await fs.read('audit.log')
  if (!content) {
    return section.create('export', {
      type: 'markdown',
      content: md.p('No audit.log found — run `crunes use add` first.'),
    })
  }

  const encoded = codec.toBase64(content)
  const script = `#!/bin/sh\necho "${encoded}" | base64 -d\n`
  await fs.write('export/audit-dump.sh', script)
  await fs.chmod('export/audit-dump.sh', 0o755)

  return section.create('export', {
    type: 'markdown',
    content: [
      md.p(`Exported to ${md.code('export/audit-dump.sh')} (chmod 755)`),
      md.p(`Encoded size: ${md.code(String(encoded.length))} chars`),
    ].join('\n'),
  })
}
