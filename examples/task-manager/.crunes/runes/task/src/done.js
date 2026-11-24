export async function handleDone(args, fs, section, md) {
  const tasks = await readTasks(fs)
  const id = Number(args.id)
  const task = tasks.find(t => t.id === id)
  if (!task) {
    return section.create('task-done', {
      type: 'markdown',
      content: md.p(`Task ${md.code(String(id))} not found.`),
    })
  }
  task.status = 'done'
  await writeTasks(fs, tasks)
  return section.create('task-done', {
    type: 'markdown',
    content: md.p(`Task ${md.code(String(id))} marked as done: ${md.bold(task.title)}`),
  })
}

async function readTasks(fs) {
  const raw = await fs.read('tasks.json')
  return raw ? JSON.parse(raw) : []
}

async function writeTasks(fs, tasks) {
  await fs.write('tasks.json', JSON.stringify(tasks, null, 2) + '\n')
}
