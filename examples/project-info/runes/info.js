import { rune } from '@utils'

export async function use() {
  const jsSections   = await rune('project-info:js')
  const javaSections = await rune('project-info:java')
  const ciSections   = await rune('project-info:ci')
  return [...jsSections, ...javaSections, ...ciSections]
}
