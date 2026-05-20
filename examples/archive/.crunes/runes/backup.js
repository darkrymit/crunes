export async function use(_dir, _args, utils) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const dest = `backups/${timestamp}.zip`

  await utils.archive.zip('src', dest)

  const files = await utils.fs.glob('src/**')

  return [
    utils.section.create('backup', {
      type: 'markdown',
      content: [
        utils.md.p(`Packed ${utils.md.code('src/')} → ${utils.md.code(dest)}`),
        utils.md.p('Files archived:'),
        utils.md.ul(files.map(f => utils.md.code(f))),
      ].join('\n'),
    }),
  ]
}
