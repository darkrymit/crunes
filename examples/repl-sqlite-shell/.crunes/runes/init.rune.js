import { sqlite, section, md } from '@utils'

export async function run() {
  const db = await sqlite.open('./state', 'books')

  await db.run(`
    CREATE TABLE IF NOT EXISTS books (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT    NOT NULL,
      author TEXT   NOT NULL,
      year  INTEGER,
      genre TEXT
    );
    INSERT OR IGNORE INTO books (id, title, author, year, genre) VALUES
      (1, 'The Pragmatic Programmer', 'David Thomas', 1999, 'Programming'),
      (2, 'Clean Code',              'Robert Martin', 2008, 'Programming'),
      (3, 'Dune',                    'Frank Herbert', 1965, 'Sci-Fi'),
      (4, 'Sapiens',                 'Yuval Harari',  2011, 'History'),
      (5, 'The Hobbit',              'J.R.R. Tolkien', 1937, 'Fantasy');
  `)

  await db.close()

  return section.create('init', {
    type: 'markdown',
    content: md.p('Database ready — `books` table seeded with 5 rows.'),
  })
}
