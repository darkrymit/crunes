import { vars, rune, section } from '@utils'

export async function args(b) {
  // Read profile variable (defaulting to readonly for maximum safety)
  const profile = vars.read('profile', 'readonly')

  // Expose 'status' to all profiles
  b.command('status', 'Check deployment health and stack metrics', status => {
    status.option('--service <name>', 'Filter status by service name', 'all')
  })

  // Expose 'deploy' to developer and operator profiles
  if (profile === 'developer' || profile === 'operator') {
    b.command('deploy', 'Deploy application services', deploy => {
      deploy.positional('<service>', 'Service name to deploy')
            .option('--tag <version>', 'Image tag version', 'latest')
    })
  }

  // Expose 'destroy' only to operator profile
  if (profile === 'operator') {
    b.command('destroy', 'Completely tear down the stack', destroy => {
      destroy.option('--force', 'Force destruction without verification', false)
    })
  }

  b.option('--help', 'Show help')

  return b.build()
}

export async function run(args) {
  if (args.help) return rune.helpSection()
  // Intercept unregistered commands passed as positionals due to lenient parser
  if (!args.$command && args._.length > 0) {
    throw new Error(`Command "${args._[0]}" is invalid or not exposed for the active profile.`)
  }

  const sections = []

  switch (args.$command) {
    case 'status': {
      sections.push(section.create('status-report', {
        type: 'markdown',
        content: `### Stack Status\n🟢 Active & Healthy (Filter: ${args.service})`
      }))
      break
    }
    case 'deploy': {
      sections.push(section.create('deploy-progress', {
        type: 'markdown',
        content: `### Deployment Initiated\n- **Target Service**: \`${args.service}\`\n- **Image Tag**: \`${args.tag}\`\n- **Status**: 🚀 Deploying...`
      }))
      break
    }
    case 'destroy': {
      const confirmMsg = args.force ? '⚠️ Forced teardown initiated!' : '⚠️ Infrastructure destruction triggered.'
      sections.push(section.create('destruction-alert', {
        type: 'markdown',
        content: `### Destroy Stack\n${confirmMsg}\n- **Status**: 🔴 Removing all stack resources.`
      }))
      break
    }
    default: {
      throw new Error(`Please specify a subcommand (e.g. "status").`)
    }
  }

  return sections
}
