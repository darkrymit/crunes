export async function use(_dir, _args, utils) {
  const checksum = utils.crypto.hash.hex('sha256', 'hello, crunes')
  const hexToken = utils.crypto.hex(16)
  const b64Token = utils.crypto.base64(24)
  const id       = utils.crypto.uuid()

  return [
    utils.section.create('crypto', {
      type: 'markdown',
      content: [
        utils.md.p(`SHA-256 (hex):    ${utils.md.code(checksum)}`),
        utils.md.p(`Random hex:       ${utils.md.code(hexToken)}`),
        utils.md.p(`Random base64:    ${utils.md.code(b64Token)}`),
        utils.md.p(`UUID:             ${utils.md.code(id)}`),
      ].join(''),
    }),
  ]
}
