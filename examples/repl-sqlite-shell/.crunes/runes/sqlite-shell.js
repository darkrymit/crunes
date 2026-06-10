import { sqlite, section, md } from '@utils'

// Module-level db reference — kept alive across runRepl steps.
// Null until first runRepl call; closed on { type: 'done' }.
let replDb = null

export async function args(b) {
  return b
    .option('--db <path>', 'Path to the SQLite database directory', './state')
    .positional('<query>', 'SQL query to execute')
    .example('crunes run sqlite-shell "SELECT * FROM books"', 'List all books')
    .example("crunes run sqlite-shell \"SELECT * FROM books WHERE genre = 'Sci-Fi'\"", 'Filter by genre')
    .build()
}

export async function run(args) {
  const db = await sqlite.open(args.db, 'books')
  let result
  try {
    result = await execQuery(db, args.query)
  } finally {
    await db.close()
  }
  return result
}

export async function argsRepl(b) {
  return b
    .option('--db <path>', 'Path to the SQLite database directory', './state')
    .example('crunes run-repl sqlite-shell', 'Start an interactive SQLite shell')
    .example('crunes run-repl sqlite-shell --db ./other', 'Open a different database directory')
    .build()
}

export async function runRepl(args, input) {
  if (!replDb) {
    replDb = await sqlite.open(args.db, 'books')
    console.log(`Connected to ${args.db}/books.db`)
  }

  const trimmed = input.trim()

  if (!trimmed) return undefined

  if (['\\q', 'exit', 'quit'].includes(trimmed.toLowerCase())) {
    await replDb.close()
    replDb = null
    return { type: 'done', message: 'Disconnected.' }
  }

  const result = await execQuery(replDb, trimmed)

  section.emit(result)

  const rowCount = extractRowCount(result)
  return rowCount !== null ? `[${rowCount} rows]> ` : 'sqlite> '
}

// ---------------------------------------------------------------------------

async function execQuery(db, sql) {
  const upper = sql.trimStart().toUpperCase()
  if (upper.startsWith('SELECT') || upper.startsWith('PRAGMA') || upper.startsWith('WITH')) {
    const rows = await db.query(sql)
    if (rows.length === 0) {
      return section.create('result', {
        type: 'markdown',
        content: md.p('No rows returned.'),
        attrs: { rowCount: '0' },
      })
    }
    const headers = Object.keys(rows[0])
    const tableRows = rows.map(row => headers.map(h => String(row[h] ?? '')))
    return section.create('result', {
      type: 'markdown',
      content: md.table(headers, tableRows),
      attrs: { rowCount: String(rows.length) },
    })
  }

  const { changes } = await db.exec(sql)
  return section.create('result', {
    type: 'markdown',
    content: md.p(`OK — ${changes} row(s) affected.`),
    attrs: { rowCount: '0' },
  })
}

function extractRowCount(sec) {
  const rc = sec?.attrs?.rowCount
  return rc !== undefined ? Number(rc) : null
}
