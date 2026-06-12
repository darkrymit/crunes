import { section, md } from '@utils'

export async function run() {
  const steps = [
    'Building artefacts...',
    'Pushing to registry...',
    'Rolling out to production...',
  ]

  const log = steps.map((s, i) => `${i + 1}. ${s}`).join('\n')

  return section.create('deploy', {
    type: 'markdown',
    title: 'Deploy',
    content: [
      md.p('Simulated deployment complete.'),
      log,
    ].join('\n'),
  })
}
