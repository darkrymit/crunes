import { fs, xml, md, section } from '@utils'

export async function use(args) {
  const filePath = 'src/main/resources/logback.xml'

  if (await fs.exists(filePath)) {
    return [section.create('logback', {
      type: 'markdown',
      content: md.p(`${md.bold('Skipped:')} ${md.code(filePath)} already exists.`),
    })]
  }

  await xml.write(filePath, {
    configuration: {
      appender: {
        '@_name': 'STDOUT',
        '@_class': 'ch.qos.logback.core.ConsoleAppender',
        encoder: {
          pattern: '%d{HH:mm:ss} %-5level %logger{36} - %msg%n',
        },
      },
      root: {
        '@_level': 'INFO',
        'appender-ref': {
          '@_ref': 'STDOUT',
        },
      },
    },
  })

  return [section.create('logback', {
    type: 'markdown',
    content: md.p(`Created ${md.code(filePath)}.`),
  })]
}
