/* db-check.mjs — быстрая проверка базы: кодировка UTF8 и русский текст без потерь.
   Запуск: node scripts/db-check.mjs  (нужен поднятый Postgres: pnpm db:start) */
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/* читаем .env вручную, чтобы скрипт работал без зависимостей */
function env() {
  const out = {}
  try {
    fs.readFileSync(path.join(root, '.env'), 'utf8')
      .split('\n')
      .forEach((line) => {
        const m = line.match(/^([A-Z_]+)=(.*)$/)
        if (m) out[m[1]] = m[2].trim()
      })
  } catch {}
  return out
}

const cfg = env()
const client = new pg.Client({
  connectionString: cfg.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5433/oge_site',
})

await client.connect()

const info = await client.query(
  `select current_database() as db,
          current_setting('server_encoding') as enc,
          current_setting('client_encoding') as client_enc,
          version() as version`,
)
console.log('база:      ', info.rows[0].db)
console.log('кодировка: ', info.rows[0].enc, '(клиент:', info.rows[0].client_enc + ')')
console.log('сервер:    ', info.rows[0].version.split(',')[0])

const probe = 'Информатика · ОГЭ·ЕГЭ 2026 — «Ёж»'
await client.query('drop table if exists _probe_encoding')
await client.query('create temp table _probe_encoding (x text)')
await client.query('insert into _probe_encoding (x) values ($1)', [probe])
const back = await client.query('select x, length(x) as chars, octet_length(x) as bytes from _probe_encoding')
const got = back.rows[0].x
console.log('русский текст:', got)
console.log('символов:', back.rows[0].chars, '· байт:', back.rows[0].bytes)
const ok = got === probe
console.log(ok ? 'OK: текст вернулся без искажений' : 'ОШИБКА: текст искажён')

await client.end()
process.exit(ok ? 0 : 1)
