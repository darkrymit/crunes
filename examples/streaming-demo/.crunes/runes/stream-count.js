import { shell, section } from '@utils';

export async function use(args) {
  const limit = args._[0] ? parseInt(args._[0]) : 5;
  
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const decoder = new TextDecoder('utf-8');
    
    // Spawn standard counter process with timeout AbortSignal bound
    const session = shell.execInSession('node counter.js', { signal: controller.signal });
    let ticks = [];

    session.stdout.on('data', (chunk) => {
      const text = decoder.decode(chunk);
      const lines = text.split('\n').filter(Boolean);
      
      for (const line of lines) {
        ticks.push(line);
        
        // Progressively emit dynamic real-time section updates
        section.emit(
          section.create('ticks-progress', {
            type: 'markdown',
            content: `### Progressive Tick Stream\n\n* **Status:** Stream active...\n* **Latest tick:** \`${line}\`\n\n**All Received Ticks:**\n${ticks.map(t => `- ${t}`).join('\n')}`
          })
        );
        
        // Trigger abort if we exceed the user-defined limit
        const tickNum = parseInt(line.replace('Tick: ', ''));
        if (tickNum >= limit) {
          controller.abort();
        }
      }
    });

    session.on('exit', (code) => {
      resolve(
        section.create('ticks-final', {
          type: 'markdown',
          content: `### Stream Finished\n\n* **Final Exit Code:** ${code} (SIGTERM/aborted if limit < 5)\n\n**Final Result Logs:**\n${ticks.map(t => `- ${t}`).join('\n')}`
        })
      );
    });

    session.on('error', (err) => {
      reject(err);
    });
  });
}
