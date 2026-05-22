import { fs, json, md, section } from '@utils'

export async function args(b) {
  return b
    .positional('[locale]', 'Locale code to scaffold (default: en)')
    .build()
}

export async function use(args) {
  const [locale = 'en'] = args._
  const filePath = `locales/${locale}.json`

  if (await fs.exists(filePath)) {
    return [section.create('i18n', {
      type: 'markdown',
      content: md.p(`${md.bold('Skipped:')} ${md.code(filePath)} already exists.`),
    })]
  }

  await json.write(filePath, {
    common: {
      ok: 'OK',
      cancel: 'Cancel',
      error: 'An error occurred',
    },
  })

  return [section.create('i18n', {
    type: 'markdown',
    content: md.p(`Created ${md.code(filePath)}.`),
  })]
}
