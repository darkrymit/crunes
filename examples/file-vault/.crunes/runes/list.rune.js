import { fs, section, md } from '@utils'

export async function run() {
  const files = await fs.glob('*.enc', { cwd: 'vault' })

  if (files.length === 0) {
    return section.create('vault', {
      type: 'markdown',
      content: md.p('Vault is empty — run `crunes run encrypt` first.'),
    })
  }

  const rows = await Promise.all(
    files.map(async (f) => {
      const stat = await fs.stat(`vault/${f}`)
      return `- ${md.code(f)} (${stat.size} bytes)`
    })
  )

  return section.create('vault', {
    type: 'markdown',
    content: [md.p(`${files.length} file(s) in vault:`), ...rows].join('\n'),
  })
}
