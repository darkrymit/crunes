export async function handleList(args, fs, section, md) {
  const raw = await fs.read('tasks.json')
  let tasks = raw ? JSON.parse(raw) : []

  if (args.status)   tasks = tasks.filter(t => t.status === args.status)
  if (args.priority) tasks = tasks.filter(t => t.priority === args.priority)
  if (args.tag)      tasks = tasks.filter(t => t.tags.includes(args.tag))

  if (tasks.length === 0) {
    return section.create('task-list', {
      type: 'markdown',
      content: md.p('No tasks found.'),
    })
  }

  const rows = tasks.map(t =>
    `| ${t.id} | ${t.title} | ${t.priority} | ${t.status} | ${t.tags.join(', ') || '—'} |`
  )
  const table = [
    '| ID | Title | Priority | Status | Tags |',
    '|---|---|---|---|---|',
    ...rows,
  ].join('\n')

  return section.create('task-list', { type: 'markdown', content: table })
}
