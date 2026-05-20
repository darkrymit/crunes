export async function use(dir, args, utils) {
  const jsSections   = await utils.rune('project-info:js')
  const javaSections = await utils.rune('project-info:java')
  const ciSections   = await utils.rune('project-info:ci')
  return [...jsSections, ...javaSections, ...ciSections]
}
