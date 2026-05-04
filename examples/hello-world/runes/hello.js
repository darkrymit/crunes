export async function use(_dir, _args, utils) {
  return utils.section.create('hello', {
    type: 'markdown',
    content: 'Hello, World!',
  })
}
