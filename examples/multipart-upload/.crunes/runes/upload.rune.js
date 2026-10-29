import { fs, http, rune, section, md } from '@utils'

export function args(builder) {
  return builder
    .positional('<file>', 'Relative path to the file to upload')
    .option('--field', 'Form field name for the file', 'file')
    .example('crunes run upload sample.txt', 'Upload sample.txt under the "file" field')
    .example('crunes run upload data.json --field payload', 'Upload with a custom field name')
    .option('--help', 'Show help')
}

export async function run(args) {
  if (args.help) return rune.helpSection()
  const { file, field } = args
  const bytes = await fs.readBytes(file)
  if (!bytes) {
    return section.create('upload', {
      type: 'markdown',
      content: md.p(`File not found: ${md.code(file)}`),
    })
  }

  // Wrap bytes in a Blob so FormData serialises it with the correct content-type
  const blob = new Blob([bytes], { type: 'application/octet-stream' })
  const form = new FormData()
  form.append(field, blob, file)

  const res = await http.fetch('https://httpbin.org/post', {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    return section.create('upload', {
      type: 'markdown',
      content: md.p(`Upload failed: HTTP ${res.status} ${res.statusText}`),
    })
  }

  // Stream the response body chunk by chunk, emitting progress as we go
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let received = 0
  let rawText = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    received += value.byteLength
    rawText += decoder.decode(value)

    section.emit(section.create('upload-progress', {
      type: 'markdown',
      content: md.p(`Received ${received} bytes…`),
    }))
  }

  // httpbin echoes the request back as JSON — pretty-print the form fields
  let summary
  try {
    const parsed = JSON.parse(rawText)
    const formKeys = Object.keys(parsed.files ?? {})
    summary = md.ul([
      `Field: ${md.code(field)}`,
      `File: ${md.code(file)} (${bytes.byteLength} bytes)`,
      `Server saw files: ${formKeys.map(k => md.code(k)).join(', ')}`,
      `Status: ${md.code(String(res.status))}`,
    ])
  } catch {
    summary = md.p('Response was not JSON — raw body logged above.')
  }

  return section.create('upload', {
    type: 'markdown',
    content: summary,
  })
}
