export async function use(_dir, _args, utils) {
  const h = await utils.cache.open('@project-cache', 'timestamps')
  const cached = await h.get('ts')
  const now = Date.now()

  if (cached !== null) {
    const age = Math.round((now - cached) / 1000)
    return [
      utils.section.create('timestamp', {
        type: 'markdown',
        content: utils.md.p(
          `Cache hit — first run was ${utils.md.bold(age + 's')} ago. TTL 60s.`
        ),
      }),
    ]
  }

  await h.set('ts', now, 60)
  return [
    utils.section.create('timestamp', {
      type: 'markdown',
      content: utils.md.p(
        `Cache miss — stored ${utils.md.code(new Date(now).toISOString())}. Run again within 60s to see a cache hit.`
      ),
    }),
  ]
}
