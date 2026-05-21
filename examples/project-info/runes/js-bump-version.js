import { fs, json, md, section } from '@utils'

export async function use(args) {
  if (!(await fs.exists('package.json'))) {
    return [section.create('js-bump-version', {
      type: 'markdown',
      content: md.p(`${md.bold('Error:')} package.json not found.`),
    })]
  }

  let oldVersion, newVersion
  await json.modify('package.json', (pkg) => {
    oldVersion = pkg.version ?? '(none)'
    const parts = (pkg.version ?? '').split('.')
    if (parts.length === 3 && parts.every(p => !isNaN(p) && p !== '')) {
      newVersion = [...parts.slice(0, 2), String(Number(parts[2]) + 1)].join('.')
      pkg.version = newVersion
    } else {
      newVersion = null
    }
    return pkg
  })

  const content = newVersion
    ? md.p(`Bumped version: ${md.code(oldVersion)} → ${md.code(newVersion)}`)
    : md.p(`${md.bold('Skipped:')} version ${md.code(oldVersion)} is not a standard semver string.`)

  return [section.create('js-bump-version', { type: 'markdown', content })]
}
