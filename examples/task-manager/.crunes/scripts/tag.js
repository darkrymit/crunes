export async function handleTag(args, fs, section, md) {
  const tasks = await readTasks(fs)
  const id = Number(args.id)
  const task = tasks.find(t => t.id === id)
  if (!task) {
    return section.create('task-tag', {
      type: 'markdown',
      content: md.p(`Task ${md.code(String(id))} not found.`),
    })
  }

  const sub = args.$command // 'tag add', 'tag remove', 'tag list'

  if (sub === 'tag list') {
    return section.create('task-tag', {
      type: 'markdown',
      content: task.tags.length
        ? md.p(`Tags on task ${md.code(String(id))}: ${task.tags.map(t => md.code(t)).join(', ')}`)
        : md.p(`Task ${md.code(String(id))} has no tags.`),
    })
  }

  if (sub === 'tag add') {
    if (!task.tags.includes(args.tag)) task.tags.push(args.tag)
    await writeTasks(fs, tasks)
    return section.create('task-tag', {
      type: 'markdown',
      content: md.p(`Added tag ${md.code(args.tag)} to task ${md.code(String(id))}.`),
    })
  }

  if (sub === 'tag remove') {
    task.tags = task.tags.filter(t => t !== args.tag)
    await writeTasks(fs, tasks)
    return section.create('task-tag', {
      type: 'markdown',
      content: md.p(`Removed tag ${md.code(args.tag)} from task ${md.code(String(id))}.`),
    })
  }

  return section.create('task-tag', {
    type: 'markdown',
    content: md.p('Usage: `crunes run task tag <id> add|remove|list [<tag>]`'),
  })
}

async function readTasks(fs) {
  const raw = await fs.read('tasks.json')
  return raw ? JSON.parse(raw) : []
}

async function writeTasks(fs, tasks) {
  await fs.write('tasks.json', JSON.stringify(tasks, null, 2) + '\n')
}
