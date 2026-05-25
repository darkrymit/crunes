import { archive, fs, md, section } from '@utils'

export async function use() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

  // 1. Tar.Gz Archive (default: gzip compressed)
  const targzDest = `backups/${timestamp}.tar.gz`
  await archive.tar('src', targzDest)

  // 2. Plain Tar Archive (opt out of gzip)
  const tarDest = `backups/${timestamp}.tar`
  await archive.tar('src', tarDest, { gzip: false })

  // 3. Extract — auto-detects gzip from magic bytes
  const targzExtractPath = `restore/targz-${timestamp}`
  await archive.untar(targzDest, targzExtractPath)

  const tarExtractPath = `restore/tar-${timestamp}`
  await archive.untar(tarDest, tarExtractPath)

  const targzFiles = await fs.glob(`${targzExtractPath}/**`)
  const tarFiles   = await fs.glob(`${tarExtractPath}/**`)

  return [
    section.create('targz-results', {
      type: 'markdown',
      title: 'Tar.Gz Operations (Gzip Compressed, default)',
      content: [
        md.p(`Packed ${md.code('src/')} → ${md.code(targzDest)}`),
        md.p(`Extracted ${md.code(targzDest)} → ${md.code(targzExtractPath)} (auto-detected)`),
        md.p('Extracted files count: ' + md.bold(String(targzFiles.length))),
      ].join('\n'),
    }),
    section.create('tar-results', {
      type: 'markdown',
      title: 'Tar Operations (Uncompressed)',
      content: [
        md.p(`Packed ${md.code('src/')} → ${md.code(tarDest)} (gzip: false)`),
        md.p(`Extracted ${md.code(tarDest)} → ${md.code(tarExtractPath)} (auto-detected)`),
        md.p('Extracted files count: ' + md.bold(String(tarFiles.length))),
      ].join('\n'),
    }),
  ]
}
