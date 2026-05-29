export async function handleAdd(args, fs, section, md) {
  const tasks = await readTasks(fs)
  const id = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1
  const task = {
    id,
    title: args.title,
    priority: args.priority ?? 'medium',
    tags: args.tag ? [args.tag] : [],
    status: 'open',
    createdAt: new Date().toISOString(),
  }
  tasks.push(task)
  await writeTasks(fs, tasks)
  return section.create('task-added', {
    type: 'markdown',
    content: [
      md.p(`Added task ${md.code(String(id))}: ${md.bold(task.title)}`),
      md.p(`Priority: ${md.code(task.priority)} | Tags: ${task.tags.length ? task.tags.map(t => md.code(t)).join(', ') : 'none'}`),
    ].join('\n'),
  })
}

async function readTasks(fs) {
  const raw = await fs.read('tasks.json')
  return raw ? JSON.parse(raw) : []
}

async function writeTasks(fs, tasks) {
  await fs.write('tasks.json', JSON.stringify(tasks, null, 2) + '\n')
}
