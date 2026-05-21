import { rune } from '@utils'

export async function use(args) {
  const jsSections   = await rune('project-info:js')
  const javaSections = await rune('project-info:java')
  const ciSections   = await rune('project-info:ci')
  return [...jsSections, ...javaSections, ...ciSections]
}
