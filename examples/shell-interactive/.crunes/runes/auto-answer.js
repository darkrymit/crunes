import { shell, section } from '@utils';

export async function use(args) {
  return new Promise((resolve, reject) => {
    const session = shell.execInSession('node prompt.js');
    let output = '';
    const decoder = new TextDecoder();

    session.stdout.on('data', (chunk) => {
      const text = decoder.decode(chunk);
      output += text;

      if (output.includes('What is the magic word?')) {
        session.stdin.write('please\n');
      }
    });

    session.on('exit', (code) => {
      resolve(
        section.create('result', {
          type: 'markdown',
          content: `### Interactive Execution Result\n\n**Output Captured:**\n\`\`\`\n${output.trim()}\n\`\`\`\n\n**Exit Code:** ${code}`
        })
      );
    });

    session.on('error', (err) => {
      reject(err);
    });
  });
}
