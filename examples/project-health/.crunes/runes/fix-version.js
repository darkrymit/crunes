import { json, section, md } from '@utils'

export async function args(b) {
  return b
    .option('--version <semver>', 'New version string (e.g. 1.2.3)')
    .build()
}

export async function run(args) {
  const { version } = args
  if (!/^\d+\.\d+\.\d+/.test(version)) {
    return section.create('error', {
      type: 'markdown',
      content: md.p(`Invalid version: ${md.code(version)}. Expected semver (e.g. 1.2.3).`),
    })
  }

  const pkg = await json.read('package.json')
  const prev = pkg.version
  await json.modify('package.json', (data) => { data.version = version })

  return section.create('updated', {
    type: 'markdown',
    content: md.p(`Version updated: ${md.code(prev)} → ${md.code(version)}`),
  })
}
