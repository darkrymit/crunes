export async function use(_dir, _args, utils) {
  if (!(await utils.fs.exists('package.json'))) {
    return [utils.section.create('js-bump-version', {
      type: 'markdown',
      content: utils.md.p(`${utils.md.bold('Error:')} package.json not found.`),
    })]
  }

  let oldVersion, newVersion
  await utils.json.modify('package.json', (pkg) => {
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
    ? utils.md.p(`Bumped version: ${utils.md.code(oldVersion)} → ${utils.md.code(newVersion)}`)
    : utils.md.p(`${utils.md.bold('Skipped:')} version ${utils.md.code(oldVersion)} is not a standard semver string.`)

  return [utils.section.create('js-bump-version', { type: 'markdown', content })]
}
