let count = 0;
const interval = setInterval(() => {
  count++;
  process.stdout.write(`Tick: ${count}\n`);
  if (count >= 5) {
    clearInterval(interval);
    process.exit(0);
  }
}, 200);
