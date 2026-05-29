import { fs, section, md } from '@utils'

export async function use() {
  const files = await fs.glob('@project-cache/vault/*.enc')

  if (files.length === 0) {
    return section.create('vault', {
      type: 'markdown',
      content: md.p('Vault is empty — run `crunes use encrypt` first.'),
    })
  }

  const rows = await Promise.all(
    files.map(async (f) => {
      const stat = await fs.stat(f)
      const name = f.split('/').pop().split('\\').pop()
      return `- ${md.code(name)} (${stat.size} bytes)`
    })
  )

  return section.create('vault', {
    type: 'markdown',
    content: [md.p(`${files.length} file(s) in vault:`), ...rows].join('\n'),
  })
}
