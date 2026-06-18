import { shell, section, help } from '@utils'

export async function args(b) {
  return b
    .option('--help', 'Show help')
    .build()
}

export async function run(args) {
  if (args.help) return help.section()
  const steps = []

  // 1. Showcase: shell.exec with stdin as a ReadableStream
  console.log('--- Step 1: Passing a Web ReadableStream directly to shell.exec stdin ---')
  const textStream = new ReadableStream({
    start(controller) {
      controller.enqueue('Line 1: Hello from standard web stream!\n')
      controller.enqueue('Line 2: Streaming features are awesome.\n')
      controller.enqueue('Line 3: Text-by-default, binary-by-choice.\n')
      controller.close()
    }
  })

  // We run a cross-platform command that echoes stdin back to stdout
  const execResult = await shell.exec('node pipe.js', {
    stdin: textStream,
    trim: false
  })

  steps.push({
    title: '1. `shell.exec` with `stdin` Web Stream',
    description: 'We passed a standard browser-compatible `ReadableStream<string>` as `stdin` directly into `shell.exec`.',
    output: execResult.stdout
  })

  // 2. Showcase: shell.execBinary returning raw Uint8Array
  console.log('--- Step 2: Running shell.execBinary ---')
  const { stdout: binaryResult } = await shell.execBinary('node binary.js')

  steps.push({
    title: '2. `shell.execBinary`',
    description: 'Used `shell.execBinary` to get direct, uncorrupted raw byte array output instead of a string.',
    isBinary: binaryResult instanceof Uint8Array,
    length: binaryResult.length,
    hex: Array.from(binaryResult).map(b => b.toString(16).padStart(2, '0')).join(' ')
  })

  // 3. Showcase: shell.spawn with Web Streams (getReader)
  console.log('--- Step 3: Running interactive session with standard Web Streams ---')
  const session = shell.spawn('node counter.js')

  const reader = session.stdout.getReader()
  session.open()
  let sessionOutput = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    sessionOutput += value
  }

  steps.push({
    title: '3. `shell.spawn` Web Streams consumption',
    description: 'Consumed interactive `session.stdout` using standard `getReader()` with asynchronous stream reading loops.',
    output: sessionOutput
  })

  // Render a gorgeous markdown presentation report
  const mdContent = [
    '# 🚀 Sandboxed Shell Streaming & Binary Capabilities',
    '',
    'This rune demonstrates the newly implemented premium standard streaming features inside the sandboxed `shell` namespace.',
    '',
    '---',
    '',
    steps.map(step => {
      let content = `### ${step.title}\n\n${step.description}\n\n`
      if (step.isBinary !== undefined) {
        content += `- **Is Uint8Array?**: \`${step.isBinary}\`\n`
        content += `- **Byte Length**: \`${step.length} bytes\`\n`
        content += `- **Hex Representation**: \`${step.hex}\`\n`
      } else {
        content += `**Command Output:**\n\`\`\`text\n${step.output}\n\`\`\`\n`
      }
      return content
    }).join('\n---\n\n'),
    '',
    'These features are built to be **fully type-safe**, compliant with **WHATWG Web Streams specifications**, and seamlessly backwards-compatible.'
  ].join('\n')

  return section.create('report', {
    type: 'markdown',
    content: mdContent
  })
}
