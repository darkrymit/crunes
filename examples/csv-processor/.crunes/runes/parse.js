import { csv, section, md } from '@utils'

export async function run() {
  // In-memory API: no file I/O needed
  const raw = `name,score\nAlice,95\nBob,82\nCarol,91\n`

  const data = csv.parseObjects(raw, { cast: true })
  const sorted = [...data.rows].sort((a, b) => b.score - a.score)

  // Modify and re-serialize with rank column
  const ranked = sorted.map((r, i) => ({ ...r, rank: i + 1 }))
  const output = csv.stringifyObjects({
    columns: [...data.columns, 'Rank'],
    aliases: { ...data.aliases, rank: 'Rank' },
    rows: ranked,
  })

  return section.create('parse', {
    type: 'markdown',
    content: [
      md.p('Sorted and ranked in-memory (no file I/O):'),
      md.codeBlock(output, 'csv'),
    ].join('\n'),
  })
}
