// A plain .js file runs with Node, outside the sandbox; it can use any Node API.
const shown = ['CRUNES_PROJECT_ROOT', 'CRUNES_RUNE_KEY', 'CRUNES_LIFECYCLE', 'CRUNES_VARS', 'CRUNES_ARGS']
for (const name of shown) console.log(`${name}=${process.env[name] ?? '(unset)'}`)
console.log(`argv=${JSON.stringify(process.argv.slice(2))}`)
