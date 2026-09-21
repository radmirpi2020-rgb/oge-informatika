/* create-admin.ts — создаёт первого пользователя админки Payload.

   Запуск: pnpm admin:create
   Логин и пароль берутся из .env (ADMIN_EMAIL, ADMIN_PASSWORD), по умолчанию —
   admin@local.test / oge-admin-2026. Смените пароль после первого входа. */
import { getPayload } from 'payload'

import config from '../payload.config'

const email = process.env.ADMIN_EMAIL || 'admin@local.test'
const password = process.env.ADMIN_PASSWORD || 'oge-admin-2026'

const payload = await getPayload({ config })

const existing = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1 })

if (existing.docs[0]) {
  console.log(`Пользователь ${email} уже есть — пароль не меняю.`)
  console.log('Сменить пароль: в админке, раздел «Пользователи».')
} else {
  await payload.create({
    collection: 'users',
    data: { email, password },
  })
  console.log(`Создан пользователь админки: ${email}`)
  console.log(`Пароль: ${password}`)
  console.log('Вход: http://localhost:3000/admin')
}

const total = await payload.count({ collection: 'users' })
console.log(`Всего пользователей: ${total.totalDocs}`)
process.exit(0)
