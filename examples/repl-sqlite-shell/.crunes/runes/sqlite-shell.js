import { sqlite, section, md } from '@utils'

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

export async function runRepl(args) {
  replDb = await sqlite.open(args.db, 'books')
  return 'sqlite> '
}

export function bannerRepl(args) {
  return `Connected to ${args.db}/books.db — /help for commands, Ctrl+D to quit`
}

export function commandsRepl(b) {
  return b
    .command('tables', 'List all tables in the database')
    .command('schema', 'Show schema for a table', sub => sub.positional('<table>', 'Table name'))
    .command('exit',   'Disconnect and quit')
}

export async function disposeRepl() {
  if (replDb) { await replDb.close(); replDb = null }
}

export async function inputRepl(input) {
  if (input.type === 'eof' || input.type === 'interrupt') {
    return { type: 'done', message: 'Disconnected.' }
  }

  if (input.type === 'command') {
    if (input.args.$command === 'exit') {
      return { type: 'done', message: 'Disconnected.' }
    }
    if (input.args.$command === 'tables') {
      const rows = await replDb.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      section.emit(section.create('tables', {
        type: 'markdown',
        content: rows.length === 0 ? md.p('No tables found.') : md.table(['table'], rows.map(r => [r.name])),
      }))
      return undefined
    }
    if (input.args.$command === 'schema') {
      const table = input.args.table
      const rows = await replDb.query(`PRAGMA table_info(${table})`)
      section.emit(section.create('schema', {
        type: 'markdown',
        content: rows.length === 0
          ? md.p(`Table "${table}" not found.`)
          : md.table(['cid', 'name', 'type', 'notnull', 'dflt_value', 'pk'],
              rows.map(r => [String(r.cid), r.name, r.type, String(r.notnull), String(r.dflt_value ?? ''), String(r.pk)])),
      }))
      return undefined
    }
    return undefined
  }

  const trimmed = input.text.trim()
  if (!trimmed) return undefined

  const result = await execQuery(replDb, trimmed)
  section.emit(result)

  const rowCount = extractRowCount(result)
  return rowCount !== null ? `[${rowCount} rows]> ` : 'sqlite> '
}

export async function completeInputRepl(tokens) {
  const partial = tokens[tokens.length - 1] ?? ''
  const keywords = ['SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'UPDATE', 'SET', 'DELETE',
                    'CREATE', 'DROP', 'TABLE', 'INDEX', 'PRAGMA', 'WITH', 'ORDER', 'BY',
                    'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'JOIN', 'LEFT', 'INNER', 'ON']
  return keywords.filter(k => k.startsWith(partial.toUpperCase()))
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
