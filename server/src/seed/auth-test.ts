/* auth-test.ts — проверка авторизации учеников: регистрация → подтверждение почты →
   вход → доступ к прогрессу → запрет на чтение чужого прогресса → сброс пароля.

   Запуск (сервер Payload поднимать не нужно — работаем через Local API):
     pnpm auth:test        (из папки server)

   Это единственный способ проверить подтверждение почты без реального SMTP: письмо
   в консоль мы не читаем, а токен подтверждения берём прямо из базы (поле _verificationToken),
   потому что письмо с ним уходит ученику, а не нам. */
import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'

const stamp = Date.now()
const email = `prover-ka-${stamp}@example.ru`
const password = 'Uchebnyi-2026-parol'
const newPassword = 'Novyj-parol-2026'

let failures = 0
function check(name: string, ok: boolean, extra = '') {
  console.log(`${ok ? '  ок  ' : '  ✗  '}${name}${extra ? ' — ' + extra : ''}`)
  if (!ok) failures++
}

async function main() {
  const payload = await getPayload({ config })
  console.log('Проверка авторизации ученика:\n')

  /* 1. регистрация */
  const created = await payload.create({
    collection: 'students',
    data: { email, password, name: 'Проверка', grade: '9', course: 'oge', consent: true } as never,
  })
  check('регистрация создаёт ученика', Boolean(created.id), 'id ' + created.id)
  check('пароль и соль не отдаются наружу', !('password' in created) && !('salt' in (created as object)))

  /* 2. вход до подтверждения почты должен быть закрыт */
  const loginBeforeVerify = await payload
    .login({ collection: 'students', data: { email, password } })
    .then(() => true)
    .catch(() => false)
  check('без подтверждения почты вход закрыт', !loginBeforeVerify)

  /* 3. токен подтверждения из базы (в жизни он уходит в письме).
     Колонка называется _verificationtoken — так её создаёт Payload в Postgres. */
  const pdb = payload.db as unknown as {
    pool?: { query: (q: string, p?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> }
  }
  const raw = await pdb.pool!.query('select _verificationtoken from students where email = $1', [email])
  const verifyToken = raw.rows[0]?._verificationtoken as string | null
  check('письмо с подтверждением сформировало токен', Boolean(verifyToken))

  /* 4. подтверждаем почту токеном из письма */
  await payload.verifyEmail({ collection: 'students', token: verifyToken as string })
  const afterVerify = await payload.findByID({ collection: 'students', id: created.id })
  check('подтверждение почты отмечено в базе', Boolean((afterVerify as { _verified?: boolean })._verified))

  /* 5. вход после подтверждения */
  const login = await payload.login({ collection: 'students', data: { email, password } })
  check('вход выдаёт токен', Boolean(login.token))
  const studentId = login.user?.id
  check('токен принадлежит этому ученику', String(studentId) === String(created.id))

  /* 6. прогресс: свой документ виден */
  const progress = await payload.create({
    collection: 'progress',
    data: {
      student: studentId,
      completed: { 12: { at: Date.now() } },
      answers: { l12t1: { ok: true, v: '4', at: Date.now() } },
      streak: 3,
    } as never,
  })
  check('прогресс создаётся для ученика', Boolean(progress.id))

  const self = { ...login.user, collection: 'students' } as never
  const found = await payload.find({ collection: 'progress', user: self, overrideAccess: false, limit: 5 })
  check('ученик видит свой прогресс', (found.docs || []).length === 1, 'документов: ' + (found.docs || []).length)

  /* 7. второй ученик не должен видеть чужой прогресс */
  const otherEmail = `prover-ka-drug-${stamp}@example.ru`
  const other = await payload.create({
    collection: 'students',
    data: { email: otherEmail, password, consent: true } as never,
  })
  await payload.update({
    collection: 'students',
    id: other.id,
    data: { _verified: true } as never,
    overrideAccess: true,
  })
  const otherLogin = await payload.login({ collection: 'students', data: { email: otherEmail, password } })
  const otherUser = { ...otherLogin.user, collection: 'students' } as never

  const foreign = await payload.find({ collection: 'progress', user: otherUser, overrideAccess: false, limit: 10 })
  const leaks = (foreign.docs || []).filter((d) => String((d as { student?: unknown }).student) === String(studentId))
  check('чужой прогресс не виден', (foreign.docs || []).length === 0 && leaks.length === 0)

  /* Аноним не должен читать прогресс: Payload в этом случае бросает «нет права».
     Это и есть правильное поведение — проверяем именно его. */
  const anonProgress = await payload
    .find({ collection: 'progress', overrideAccess: false, limit: 10 })
    .then((r) => ({ denied: false, count: (r.docs || []).length }))
    .catch(() => ({ denied: true, count: 0 }))
  check('аноним не читает прогресс', anonProgress.denied || anonProgress.count === 0,
    anonProgress.denied ? 'доступ запрещён' : 'документов: ' + anonProgress.count)

  const anonStudents = await payload
    .find({ collection: 'students', overrideAccess: false, limit: 10 })
    .then((r) => ({ denied: false, count: (r.docs || []).length }))
    .catch(() => ({ denied: true, count: 0 }))
  check('список учеников анониму недоступен', anonStudents.denied || anonStudents.count === 0,
    anonStudents.denied ? 'доступ запрещён' : 'видно записей: ' + anonStudents.count)

  /* 8. сброс пароля: токен тоже берём из базы — в жизни он уходит письмом */
  await payload.forgotPassword({ collection: 'students', data: { email }, disableEmail: true })
  const resetRaw = await pdb.pool!.query('select reset_password_token from students where email = $1', [email])
  const resetToken = resetRaw.rows[0]?.reset_password_token as string | null
  check('запрос сброса пароля выдан и сохранён', Boolean(resetToken))
  await payload.resetPassword({
    collection: 'students',
    data: { token: resetToken as string, password: newPassword },
    overrideAccess: true,
  })
  const relogin = await payload
    .login({ collection: 'students', data: { email, password: newPassword } })
    .then((r) => Boolean(r.token))
    .catch(() => false)
  check('вход работает с новым паролем', relogin)

  const oldPassword = await payload
    .login({ collection: 'students', data: { email, password } })
    .then(() => true)
    .catch(() => false)
  check('старый пароль больше не работает', !oldPassword)

  /* 9. саморегистрация не даёт прав администратора и не выбирает тариф */
  const sneaky = await payload
    .create({
      collection: 'students',
      data: { email: `prover-ka-role-${stamp}@example.ru`, password, roles: ['admin'] } as never,
      overrideAccess: false,
    })
    .catch(() => null)
  check('роли не выдаются через регистрацию', !sneaky || !('roles' in (sneaky as object)))

  /* тариф, присланный клиентом, должен быть отброшен: иначе любой выберет себе «Максимум» бесплатно.
     Сначала проверяем поведением: пробуем записать 'free' (без нейронки) и смотрим, что осталось. */
  const planEmail = `prover-ka-plan-${stamp}@example.ru`
  const planAttempt = await payload
    .create({
      collection: 'students',
      data: { email: planEmail, password, plan: 'free' } as never,
      overrideAccess: false,
    })
    .then((doc) => ({ ok: true, id: doc.id, plan: (doc as { plan?: string }).plan }))
    .catch(() => ({ ok: false, id: null, plan: null }))

  if (!planAttempt.ok) {
    /* вариант, когда Payload прямо отклоняет попытку записи в закрытое поле — тоже хорошо */
    check('тариф нельзя выбрать самому при регистрации', true, 'запись отклонена')
  } else {
    const stored = (await payload.findByID({
      collection: 'students',
      id: planAttempt.id as number,
      depth: 0,
      overrideAccess: true,
    })) as { plan?: string }
    check(
      'тариф нельзя выбрать самому при регистрации',
      stored.plan !== 'free',
      'в базе осталось «' + stored.plan + '», клиент присылал «free»',
    )
    await payload.delete({ collection: 'students', id: planAttempt.id as number, overrideAccess: true })
  }

  /* 10. тариф проверяет сервер, а не браузер: ученик с тарифом без нейронки не получит ответ.
         Ключ DeepSeek при этом не нужен — отказ происходит раньше. */
  const base = process.env.API_BASE || `http://127.0.0.1:${process.env.PORT || 3000}`
  const studentToken = login.token as string
  const askAi = (token: string) =>
    fetch(base + '/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'JWT ' + token,
        Origin: process.env.SITE_ORIGIN || 'http://127.0.0.1:8080',
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'привет' }] }),
    }).then(async (r) => ({ status: r.status, body: (await r.json().catch(() => ({}))) as Record<string, unknown> }))

  /* у ученика тариф по умолчанию «Максимум» — тариф его не отклоняет.
     Дальше может быть 503 (нет ключа) или 401/200: важно, что это НЕ отказ по тарифу. */
  const withMax = await askAi(studentToken).catch(() => null)
  if (!withMax) {
    console.log('  ~  сервер не поднят — проверка тарифа на сервере пропущена (запусти pnpm dev)')
  } else {
    check('с тарифом «Максимум» отказа по тарифу нет', withMax.status !== 403, 'статус ' + withMax.status)

    await payload.update({
      collection: 'students',
      id: created.id,
      data: { plan: 'full' } as never,
      overrideAccess: true,
    })
    /* повторный вход нужен, чтобы токен нёс свежие данные */
    const relogin2 = await payload.login({ collection: 'students', data: { email, password: newPassword } })
    const withFull = await askAi(relogin2.token as string)
    check('с тарифом без нейронки сервер отвечает отказом', withFull.status === 403, 'статус ' + withFull.status)
    check(
      'в отказе сказано про тариф «Максимум»',
      /Максимум/.test(String(withFull.body.error || '')),
      String(withFull.body.error || '').slice(0, 60),
    )
  }

  /* чистим за собой */
  await payload.delete({ collection: 'progress', where: { student: { in: [created.id, other.id] } } })
  await payload.delete({ collection: 'students', where: { id: { in: [created.id, other.id] } } })

  console.log(
    failures
      ? `\nНе прошло проверок: ${failures}`
      : '\nВсё чисто: регистрация, подтверждение почты, вход, изоляция прогресса и сброс пароля работают.',
  )
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error('\nПроверка упала:', e?.message || e)
  process.exit(1)
})
