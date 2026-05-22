import { cache, md, section } from '@utils'

export async function use() {
  const h = await cache.open('@project-cache', 'timestamps')
  const cached = await h.get('ts')
  const now = Date.now()

  if (cached !== null) {
    const age = Math.round((now - cached) / 1000)
    return [
      section.create('timestamp', {
        type: 'markdown',
        content: md.p(
          `Cache hit — first run was ${md.bold(age + 's')} ago. TTL 60s.`
        ),
      }),
    ]
  }

  await h.set('ts', now, 60)
  return [
    section.create('timestamp', {
      type: 'markdown',
      content: md.p(
        `Cache miss — stored ${md.code(new Date(now).toISOString())}. Run again within 60s to see a cache hit.`
      ),
    }),
  ]
}
