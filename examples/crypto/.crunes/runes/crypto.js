import { crypto, md, section } from '@utils'

export async function use(args) {
  const checksum = crypto.hash.hex('sha256', 'hello, crunes')
  const hexToken = crypto.hex(16)
  const b64Token = crypto.base64(24)
  const id       = crypto.uuid()

  return [
    section.create('crypto', {
      type: 'markdown',
      content: [
        md.p(`SHA-256 (hex):    ${md.code(checksum)}`),
        md.p(`Random hex:       ${md.code(hexToken)}`),
        md.p(`Random base64:    ${md.code(b64Token)}`),
        md.p(`UUID:             ${md.code(id)}`),
      ].join(''),
    }),
  ]
}
