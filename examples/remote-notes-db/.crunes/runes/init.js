import { fs, shell, env, db, time, section, md, help } from '@utils'

export async function args(b) {
  return b
    .option("--no-env", "Disable automatic .env creation", false)
    .option("--no-docker", "Disable automatic docker compose startup", false)
    .option("--help", "Show help")
    .build()
}

export async function run(args) {
  if (args.help) return help.section()
  const steps = []

  // 1. Setup environment file
  if (!args.env) {
    const hasEnv = await fs.exists('.env')
    if (!hasEnv) {
      const hasExample = await fs.exists('.env.example')
      if (hasExample) {
        const content = await fs.read('.env.example')
        await fs.write('.env', content)
        steps.push('Created local `.env` configuration file from `.env.example`.')
      }
    }
  }

  // 2. Start Docker Postgres container
  if (!args.docker) {
    steps.push('Executing `docker compose up -d`...')
    await shell.exec('docker compose up -d')
  }

  // 3. Assemble database connection URL
  const host = await env.read('DB_HOST', 'localhost')
  const port = await env.read('DB_PORT', '5432')
  const user = await env.read('DB_USER', 'postgres')
  const pass = await env.read('DB_PASSWORD', 'password')
  const name = await env.read('DB_NAME', 'notes_db')
  const uri = `postgres://${user}:${pass}@${host}:${port}/${name}`

  // 4. Connect with wait retry loop
  let client
  let retries = 15
  steps.push('Waiting for Postgres database server connectivity...')
  
  while (retries > 0) {
    try {
      client = await db.connect(uri)
      break
    } catch (err) {
      retries--
      if (retries === 0) {
        throw new Error(`Failed to connect to database at ${uri} after 15 attempts. Details: ${err.message}`)
      }
      await time.after(1000)
    }
  }
  steps.push('Connected to Postgres database successfully!')

  // 5. Initialize Schema
  const checkTableSql = `
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'notes'
    );
  `
  const tableExistsRow = await client.get(checkTableSql)
  const tableExists = tableExistsRow ? tableExistsRow.exists : false

  if (!tableExists) {
    const createTableSql = `
      CREATE TABLE notes (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        tags TEXT[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL
      );
    `
    await client.exec(createTableSql)
    steps.push('Created structural table `notes` with native `TEXT[]` array tags support.')
  }

  // 6. Seed mock notes if empty
  const checkEmptySql = `SELECT COUNT(*) as count FROM notes;`
  const countRow = await client.get(checkEmptySql)
  const count = countRow ? Number(countRow.count) : 0

  if (count === 0) {
    const seedSql = `
      INSERT INTO notes (title, content, tags) VALUES 
      ('Welcome Note', 'Welcome to the Crunes remote database notes client. You can use standard CRUD flags.', ARRAY['welcome', 'info']::text[]),
      ('Crunes Architecture', 'Crunes utilizes V8 sandboxing to execute remote integration code securely.', ARRAY['ai', 'crunes', 'database']::text[]);
    `
    await client.exec(seedSql)
    steps.push('Seeded database with default sample notes.')
  }

  await client.close()

  return section.create('database-bootstrap', {
    type: 'markdown',
    content: [
      md.h2('Database Bootstrap Success'),
      md.p('All bootstrap operations finished successfully:'),
      steps.map(s => `* ${s}`).join('\n')
    ].join('\n')
  })
}
