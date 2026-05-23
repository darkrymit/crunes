import { rune } from '@utils'

export async function use() {
  const jsSections   = await rune.use('project-info:js')
  const javaSections = await rune.use('project-info:java')
  const ciSections   = await rune.use('project-info:ci')
  return [...jsSections, ...javaSections, ...ciSections]
}
