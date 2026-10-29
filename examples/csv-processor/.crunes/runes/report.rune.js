import { csv, section, md } from '@utils'

export async function run() {
  // Read with header normalization: 'Product Name' → name, 'Unit Price' → price, 'Quantity' → qty
  const data = await csv.readObjects('data.csv', {
    aliases: { 'Product Name': 'name', 'Unit Price': 'price', 'Quantity': 'qty' },
    cast: true,
  })

  const rows = data.rows.map(r => ({ ...r, total: (r.price * r.qty).toFixed(2) }))

  // Round-trip: writeObjects restores original headers; extra column added to schema
  await csv.writeObjects('summary.csv', {
    columns: [...data.columns, 'Total'],
    aliases: { ...data.aliases, total: 'Total' },
    rows,
  })

  const tableRows = rows.map(r => [r.name, String(r.price), String(r.qty), r.total])
  return section.create('report', {
    type: 'markdown',
    content: [
      md.p(`${rows.length} rows processed. Summary written to ${md.code('summary.csv')}.`),
      md.table([...data.columns, 'Total'], tableRows),
    ].join('\n'),
  })
}
