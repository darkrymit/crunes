import { fs, section, md } from '@utils'
import { handleAdd } from '../scripts/add.js'
import { handleList } from '../scripts/list.js'
import { handleDone } from '../scripts/done.js'
import { handleRm } from '../scripts/rm.js'
import { handleTag } from '../scripts/tag.js'

export async function args(b) {
  return b
    .example('crunes use task add "Buy milk" --priority high --tag shopping', 'Add a high-priority task')
    .example('crunes use task list --status open --tag shopping', 'List open tasks tagged shopping')
    .example('crunes use task tag 1 add urgent', 'Add the urgent tag to task 1')
    .command('add', 'Add a new task', add => {
      add
        .positional('<title>', 'Task title')
        .option('--priority <level>', 'Priority: high, medium, or low', 'medium')
        .option('--tag <tag>', 'Initial tag')
        .example('crunes use task add "Fix bug" --priority high', 'Add a high-priority task')
        .example('crunes use task add "Write docs" --tag docs', 'Add a task with a tag')
    })
    .command('list', 'List tasks', list => {
      list
        .option('--status <status>', 'Filter by status: open or done')
        .option('--priority <level>', 'Filter by priority')
        .option('--tag <tag>', 'Filter by tag')
        .example('crunes use task list', 'List all tasks')
        .example('crunes use task list --status open --tag docs', 'List open docs tasks')
    })
    .command('done', 'Mark a task as done', done => {
      done.positional('<id>', 'Task ID')
    })
    .command('rm', 'Remove a task', rm => {
      rm.positional('<id>', 'Task ID')
    })
    .command('tag', 'Manage tags on a task', tag => {
      tag
        .positional('<id>', 'Task ID')
        .example('crunes use task tag 1 add urgent', 'Add urgent tag to task 1')
        .example('crunes use task tag 1 remove urgent', 'Remove urgent tag from task 1')
        .example('crunes use task tag 1 list', 'List all tags on task 1')
        .command('add', 'Add a tag to a task', tagAdd => {
          tagAdd.positional('<tag>', 'Tag name to add')
        })
        .command('remove', 'Remove a tag from a task', tagRemove => {
          tagRemove.positional('<tag>', 'Tag name to remove')
        })
        .command('list', 'List tags on a task')
    })
    .build()
}

export async function use(args) {
  const cmd = args.$command ?? ''
  if (cmd === 'add')         return handleAdd(args, fs, section, md)
  if (cmd === 'list')        return handleList(args, fs, section, md)
  if (cmd === 'done')        return handleDone(args, fs, section, md)
  if (cmd === 'rm')          return handleRm(args, fs, section, md)
  if (cmd.startsWith('tag')) return handleTag(args, fs, section, md)
  return section.create('usage', {
    type: 'markdown',
    content: md.p('Usage: `crunes use task <add|list|done|rm|tag> ...`'),
  })
}
