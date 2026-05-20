export async function use(_dir, _args, utils) {
  const filePath = 'src/main/resources/logback.xml'

  if (await utils.fs.exists(filePath)) {
    return [utils.section.create('logback', {
      type: 'markdown',
      content: utils.md.p(`${utils.md.bold('Skipped:')} ${utils.md.code(filePath)} already exists.`),
    })]
  }

  await utils.xml.write(filePath, {
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

  return [utils.section.create('logback', {
    type: 'markdown',
    content: utils.md.p(`Created ${utils.md.code(filePath)}.`),
  })]
}
