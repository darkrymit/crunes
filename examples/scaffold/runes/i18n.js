export async function use(_dir, args, utils) {
  const [locale = 'en'] = args
  const filePath = `locales/${locale}.json`

  if (await utils.fs.exists(filePath)) {
    return [utils.section.create('i18n', {
      type: 'markdown',
      content: utils.md.p(`${utils.md.bold('Skipped:')} ${utils.md.code(filePath)} already exists.`),
    })]
  }

  await utils.json.write(filePath, {
    common: {
      ok: 'OK',
      cancel: 'Cancel',
      error: 'An error occurred',
    },
  })

  return [utils.section.create('i18n', {
    type: 'markdown',
    content: utils.md.p(`Created ${utils.md.code(filePath)}.`),
  })]
}
