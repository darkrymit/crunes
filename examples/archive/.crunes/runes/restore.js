export async function use(_dir, _args, utils) {
  const backups = (await utils.fs.glob('backups/*.zip')).sort()

  if (backups.length === 0) {
    return [
      utils.section.create('restore', {
        type: 'markdown',
        content: utils.md.p(`${utils.md.bold('No backups found.')} Run the ${utils.md.code('backup')} rune first.`),
      }),
    ]
  }

  const latest = backups.at(-1)
  await utils.archive.unzip(latest, 'restore')

  const restored = await utils.fs.glob('restore/**')

  return [
    utils.section.create('restore', {
      type: 'markdown',
      content: [
        utils.md.p(`Extracted ${utils.md.code(latest)} → ${utils.md.code('restore/')}`),
        utils.md.p('Restored files:'),
        utils.md.ul(restored.map(f => utils.md.code(f))),
      ].join('\n'),
    }),
  ]
}
