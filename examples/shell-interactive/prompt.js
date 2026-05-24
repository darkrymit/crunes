process.stdout.write('What is the magic word? ');
process.stdin.on('data', d => {
  if (d.toString().trim() === 'please') {
    console.log('Access granted!');
    process.exit(0);
  } else {
    console.log('Access denied!');
    process.exit(1);
  }
});
