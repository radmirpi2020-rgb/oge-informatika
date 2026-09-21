/* dev-db.mjs — портативный PostgreSQL для разработки: без установки сервера и без прав администратора.

   Зачем: PostgreSQL в системе нет, Docker тоже. Пакет embedded-postgres приносит бинарники
   Postgres (пакет @embedded-postgres/windows-x64) и умеет initdb + запуск.

   Две особенности Windows, из-за которых всё сделано именно так:
     1. Каталог данных нельзя держать внутри пути с кириллицей: initdb передаёт путь
        в ANSI-кодировке, и Postgres падает с «invalid byte sequence for encoding "UTF8"».
        Поэтому данные по умолчанию лежат в профиле пользователя (см. PG_DATA_DIR).
     2. На системе с русской локалью initdb НЕЛЬЗЯ просить --encoding=UTF8: post-bootstrap
        падает на той же ошибке. Поэтому кластер инициализируется со штатной кодировкой,
        а рабочая база oge_site создаётся отдельно — из template0 с ENCODING 'UTF8'.

   Команды:
     node scripts/dev-db.mjs start    # поднять Postgres на порту 5433 и создать базу oge_site (UTF8)
     node scripts/dev-db.mjs stop     # остановить
     node scripts/dev-db.mjs status   # проверить, отвечает ли порт
     node scripts/dev-db.mjs daemon   # внутреннее: долгоживущий процесс, который держит сервер */
import EmbeddedPostgres from 'embedded-postgres'
import net from 'node:net'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const dir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dir, '..')
const dataDir = process.env.PG_DATA_DIR || path.join(os.homedir(), '.oge-pgdata')
/* логи и pid — отдельно от каталога данных: initdb требует пустой каталог */
const runDir = path.join(root, '.pglogs')
const pidFile = path.join(runDir, 'daemon.pid')
const logFile = path.join(runDir, 'server.log')

const PORT = Number(process.env.PG_PORT || 5433)
const USER = process.env.PG_USER || 'postgres'
const PASSWORD = process.env.PG_PASSWORD || 'postgres'
const DB = process.env.PG_DATABASE || 'oge_site'

function makePg() {
  return new EmbeddedPostgres({
    databaseDir: dataDir,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
    /* initdbFlags намеренно пустые: см. особенность 2 в шапке файла */
    onLog: (message) => {
      try { fs.appendFileSync(logFile, message + '\n') } catch {}
    },
  })
}

function portOpen(port, timeout = 700) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port })
    const done = (ok) => { socket.destroy(); resolve(ok) }
    socket.setTimeout(timeout)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
  })
}

async function waitForPort(port, tries = 60) {
  for (let i = 0; i < tries; i++) {
    if (await portOpen(port)) return true
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** создаёт рабочую базу в UTF8, если её ещё нет */
async function ensureDatabase() {
  const client = new pg.Client({
    host: '127.0.0.1',
    port: PORT,
    user: USER,
    password: PASSWORD,
    database: 'postgres',
  })
  await client.connect()
  const exists = await client.query('select 1 from pg_database where datname = $1', [DB])
  if (!exists.rowCount) {
    await client.query(
      `CREATE DATABASE "${DB}" WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`,
    )
    console.log(`база ${DB} создана с кодировкой UTF8`)
  }
  const enc = await client.query(
    'select pg_encoding_to_char(encoding) as enc from pg_database where datname = $1',
    [DB],
  )
  await client.end()
  return enc.rows[0]?.enc
}

async function start() {
  if (await portOpen(PORT)) {
    console.log(`Postgres уже слушает 127.0.0.1:${PORT} — ничего не делаю.`)
    console.log(`DATABASE_URL=postgres://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DB}`)
    return
  }

  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'daemon'], {
    cwd: root,
    detached: true,
    stdio: 'ignore',
    env: process.env,
  })
  child.unref()

  if (!(await waitForPort(PORT))) {
    console.error('Postgres не поднялся за 30 секунд. Смотри лог: ' + logFile)
    process.exit(1)
  }
  console.log(`Postgres поднят: 127.0.0.1:${PORT}, данные в ${dataDir}`)
  console.log(`DATABASE_URL=postgres://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DB}`)
}

async function daemon() {
  fs.mkdirSync(runDir, { recursive: true })
  fs.writeFileSync(pidFile, String(process.pid))
  const server = makePg()

  const shutdown = async (code = 0) => {
    try { await server.stop() } catch {}
    try { fs.rmSync(pidFile, { force: true }) } catch {}
    process.exit(code)
  }
  process.on('SIGTERM', () => shutdown(0))
  process.on('SIGINT', () => shutdown(0))

  try {
    if (!fs.existsSync(path.join(dataDir, 'PG_VERSION'))) {
      fs.mkdirSync(dataDir, { recursive: true })
      await server.initialise()
    }
    await server.start()
    const enc = await ensureDatabase()
    try { fs.appendFileSync(logFile, `ready: ${DB} encoding=${enc}\n`) } catch {}
    setInterval(() => {}, 1 << 30) /* держим процесс живым */
  } catch (e) {
    try { fs.appendFileSync(logFile, 'daemon error: ' + (e && e.stack ? e.stack : e) + '\n') } catch {}
    await shutdown(1)
  }
}

async function stop() {
  let pid = null
  try { pid = Number(fs.readFileSync(pidFile, 'utf8').trim()) } catch {}
  if (pid) {
    try { process.kill(pid, 'SIGTERM') } catch {}
    for (let i = 0; i < 40; i++) {
      await sleep(250)
      if (!(await portOpen(PORT))) break
    }
  }
  try { fs.rmSync(pidFile, { force: true }) } catch {}
  console.log((await portOpen(PORT)) ? 'Порт всё ещё занят — остановите вручную.' : 'Postgres остановлен.')
}

async function status() {
  const alive = await portOpen(PORT)
  let pid = null
  try { pid = fs.readFileSync(pidFile, 'utf8').trim() } catch {}
  console.log(alive
    ? `работает: 127.0.0.1:${PORT} (pid ${pid || '?'}), база ${DB}`
    : `не запущен: 127.0.0.1:${PORT} свободен`)
  if (!alive) process.exitCode = 1
}

const cmd = process.argv[2] || 'status'
if (cmd === 'start') await start()
else if (cmd === 'stop') await stop()
else if (cmd === 'status') await status()
else if (cmd === 'daemon') await daemon()
else {
  console.log('Использование: node scripts/dev-db.mjs [start|stop|status]')
  process.exit(1)
}
