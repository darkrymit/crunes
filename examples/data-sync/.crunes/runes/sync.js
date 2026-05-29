import { http, cache, sqlite, section, md } from '@utils'

export async function use() {
  const h = await cache.open('@project-cache', 'data-sync')

  if (await h.has('last-fetch')) {
    return section.create('sync', {
      type: 'markdown',
      content: md.p('Already synced recently. Run `crunes use report` to see stored data, or wait for cache to expire (5 min).'),
    })
  }

  const res = await http.fetch('https://jsonplaceholder.typicode.com/posts')
  const posts = await res.json()

  const db = await sqlite.open('@project-sqlite', 'posts')
  await db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT
    )
  `)

  let inserted = 0
  for (const post of posts) {
    const result = await db.exec(
      'INSERT OR IGNORE INTO posts (id, user_id, title, body) VALUES (?, ?, ?, ?)',
      [post.id, post.userId, post.title, post.body]
    )
    inserted += result.changes
  }

  await db.close()
  await h.set('last-fetch', Date.now(), 300)

  return section.create('sync', {
    type: 'markdown',
    content: md.p(`Synced ${md.bold(String(inserted))} new posts from JSONPlaceholder.`),
  })
}
