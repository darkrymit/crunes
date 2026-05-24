import { env, md, section } from '@utils'

export async function args(b) {
  const defaultLimit = await env.read('SEARCH_DEFAULT_LIMIT') ?? 10
  return b
    .positional('<query>',  'Search query string (required)')
    .positional('[scope]',  'Narrow to a specific scope: src, docs, all (default: all)')
    .option('-c, --count <number>',  'Maximum results to return',              defaultLimit)
    .option('-f, --format <string>', 'Output format: table, json, csv',        'table')
    .option('--since <string>',      'Only include results after this date',   '')
    .option('--strict',              'Exact match only — no fuzzy search',     false)
    .option('-v, --verbose',         'Show raw parsed args and full metadata', false)
    .option('--dry-run',             'Show what would run without executing',  false)
    .example('crunes use search=hello',                          'Basic search with defaults')
    .example('crunes use search=hello,src,-c,5,--strict',        'Strict search in src, limit 5')
    .example('crunes use search=api,docs,-f,json,--dry-run',     'Dry-run JSON search in docs')
    .build()
}

export async function use(args) {
  const query   = args._[0] ?? '(none)'
  const scope   = args._[1] ?? 'all'
  const count   = args.count
  const format  = args.format
  const since   = args.since
  const strict  = args.strict
  const verbose = args.verbose
  const dryRun  = args['dry-run']

  const parsed = md.table(
    ['Arg', 'Value', 'Source'],
    [
      ['query',    md.code(String(query)),  'positional [0]  (required)'],
      ['scope',    md.code(String(scope)),  'positional [1]  (optional, default: all)'],
      ['count',    md.code(String(count)),  '-c / --count    (number, env-driven default)'],
      ['format',   md.code(String(format)), '-f / --format   (string, default: table)'],
      ['since',    md.code(since || '—'),   '--since         (string, default: empty)'],
      ['strict',   md.code(String(strict)), '--strict        (boolean, default: false)'],
      ['verbose',  md.code(String(verbose)),'-v / --verbose  (boolean, default: false)'],
      ['dry-run',  md.code(String(dryRun)), '--dry-run       (boolean, default: false)'],
    ]
  )

  const lines = [parsed]

  if (dryRun) {
    lines.push(md.p(`${md.bold('Dry-run:')} would search ${md.code(scope)} for ${md.code(query)}, returning up to ${md.bold(String(count))} results as ${md.code(format)}.`))
  }

  if (verbose) {
    lines.push(md.p(`${md.bold('Raw $raw:')} ${md.code(JSON.stringify(args.$raw))}`))
  }

  return [section.create('search', { type: 'markdown', content: lines.join('\n') })]
}
