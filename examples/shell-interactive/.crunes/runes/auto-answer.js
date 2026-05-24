import { shell, section, fs } from '@utils';

export async function use(args) {
  const dir = fs.cwd();
  const session = shell.session(`node prompt.js`);
  await session.expect('What is the magic word?');
  session.write('please\n');
  await session.waitForExit();
  return section.create('result', { type: 'markdown', content: session.output() });
}
