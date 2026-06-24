import { fs, rune, section, md } from '@utils'
import { handleAdd } from '../scripts/add.js'
import { handleList } from '../scripts/list.js'
import { handleDone } from '../scripts/done.js'
import { handleRm } from '../scripts/rm.js'
import { handleTag } from '../scripts/tag.js'

export async function args(b) {
  return b
    .example('crunes run task add "Buy milk" --priority high --tag shopping', 'Add a high-priority task')
    .example('crunes run task list --status open --tag shopping', 'List open tasks tagged shopping')
    .example('crunes run task tag add 1 urgent', 'Add the urgent tag to task 1')
    .command('add', 'Add a new task', add => {
      add
        .positional('<title>', 'Task title')
        .option('--priority <level>', 'Priority: high, medium, or low', 'medium')
        .option('--tag <tag>', 'Initial tag')
        .example('crunes run task add "Fix bug" --priority high', 'Add a high-priority task')
        .example('crunes run task add "Write docs" --tag docs', 'Add a task with a tag')
    })
    .command('list', 'List tasks', list => {
      list
        .option('--status <status>', 'Filter by status: open or done')
        .option('--priority <level>', 'Filter by priority')
        .option('--tag <tag>', 'Filter by tag')
        .example('crunes run task list', 'List all tasks')
        .example('crunes run task list --status open --tag docs', 'List open docs tasks')
    })
    .command('done', 'Mark a task as done', done => {
      done.positional('<id>', 'Task ID')
    })
    .command('rm', 'Remove a task', rm => {
      rm.positional('<id>', 'Task ID')
    })
    .command('tag', 'Manage tags on a task', tag => {
      tag
        .example('crunes run task tag add 1 urgent', 'Add urgent tag to task 1')
        .example('crunes run task tag remove 1 urgent', 'Remove urgent tag from task 1')
        .example('crunes run task tag list 1', 'List all tags on task 1')
        .command('add', 'Add a tag to a task', tagAdd => {
          tagAdd.positional('<id>', 'Task ID').positional('<tag>', 'Tag name to add')
        })
        .command('remove', 'Remove a tag from a task', tagRemove => {
          tagRemove.positional('<id>', 'Task ID').positional('<tag>', 'Tag name to remove')
        })
        .command('list', 'List tags on a task', tagList => {
          tagList.positional('<id>', 'Task ID')
        })
    })
    .option('--help', 'Show help')
    .build()
}

export async function run(args) {
  if (args.help) return rune.helpSection()
  const cmd = args.$command ?? ''
  if (cmd === 'add')         return handleAdd(args, fs, section, md)
  if (cmd === 'list')        return handleList(args, fs, section, md)
  if (cmd === 'done')        return handleDone(args, fs, section, md)
  if (cmd === 'rm')          return handleRm(args, fs, section, md)
  if (cmd.startsWith('tag')) return handleTag(args, fs, section, md)
  return section.create('usage', {
    type: 'markdown',
    content: md.p('Usage: `crunes run task <add|list|done|rm|tag> ...`'),
  })
}
