import { csv, section, md } from '@utils'

export async function args(b) {
  return b
    .option('--min-price <number>', 'Minimum unit price to include', 10)
    .build()
}

export async function run(args) {
  const minPrice = args['min-price']

  // Stream large CSVs row-by-row without loading into memory
  const { columns, aliases, rows } = csv.readObjectsStream('data.csv', {
    aliases: { 'Unit Price': 'price' },
    cast: true,
  })

  const writeStream = csv.writeStream('filtered.csv')
  const writer = writeStream.getWriter()

  // Write header row first
  const cols = await columns
  await writer.write(cols)

  const resolvedAliases = await aliases
  let kept = 0
  for await (const row of rows) {
    if (row.price >= minPrice) {
      // Re-map aliases back to original column order for raw row write
      await writer.write(cols.map(col => {
        const alias = Object.entries(resolvedAliases).find(([, orig]) => orig === col)?.[0] ?? col
        return String(row[alias] ?? '')
      }))
      kept++
    }
  }

  await writer.close()

  return section.create('filter', {
    type: 'markdown',
    content: md.p(`Kept ${md.bold(String(kept))} rows with unit price ≥ ${md.bold(String(minPrice))}. Written to ${md.code('filtered.csv')}.`),
  })
}
