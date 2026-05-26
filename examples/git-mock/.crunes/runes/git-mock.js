import { section } from '@utils'

export async function args(b) {
  return b
    .option('--verbose', 'Root verbose flag', false)
    .command('remote', 'Git remote commands', remote => {
      remote
        .command('add', 'Add a new remote link', add => {
          add
            .positional('<name>', 'Name of the remote')
            .positional('<url>', 'URL of the remote')
            .option('--fetch', 'Fetch branch details immediately', true)
        })
        .command('remove', 'Remove remote link', remove => {
          remove.positional('<name>', 'Name of remote to remove')
        })
    })
}

export async function use(args) {
  const lines = []
  
  lines.push(`Root Verbose: ${args.verbose}`)
  lines.push(`Command: ${args.command}`)
  lines.push(`Commands Array: ${JSON.stringify(args.commands)}`)
  
  if (args.command === 'remote') {
    lines.push('Executing: Listing all remotes')
  } else if (args.command === 'remote add') {
    lines.push(`Executing: Adding remote ${args.name} with URL ${args.url} (Fetch: ${args.fetch})`)
  } else if (args.command === 'remote remove') {
    lines.push(`Executing: Removing remote ${args.name}`)
  } else {
    lines.push('Executing: Default base action')
  }
  
  return section.create('git-mock-result', {
    type: 'markdown',
    content: lines.join('\n')
  })
}
