export async function handleRm(args, fs, section, md) {
  const tasks = await readTasks(fs)
  const id = Number(args.id)
  const idx = tasks.findIndex(t => t.id === id)
  if (idx === -1) {
    return section.create('task-rm', {
      type: 'markdown',
      content: md.p(`Task ${md.code(String(id))} not found.`),
    })
  }
  const [removed] = tasks.splice(idx, 1)
  await writeTasks(fs, tasks)
  return section.create('task-rm', {
    type: 'markdown',
    content: md.p(`Removed task ${md.code(String(id))}: ${md.bold(removed.title)}`),
  })
}

async function readTasks(fs) {
  const raw = await fs.read('tasks.json')
  return raw ? JSON.parse(raw) : []
}

async function writeTasks(fs, tasks) {
  await fs.write('tasks.json', JSON.stringify(tasks, null, 2) + '\n')
}
