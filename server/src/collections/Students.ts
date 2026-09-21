import type { CollectionConfig } from 'payload'

const siteUrl = (process.env.SITE_URL || 'http://127.0.0.1:8080').replace(/\/+$/, '')

/** Страница сайта, которая принимает токен из письма (см. scripts/pages/account.js). */
const verifyLink = (token: string) => `${siteUrl}/#/account?verify=${token}`
const resetLink = (token: string) => `${siteUrl}/#/account?reset=${token}`

function shell(title: string, body: string) {
  return `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
  <h2 style="margin:0 0 12px">${title}</h2>
  ${body}
  <p style="color:#666;font-size:13px;margin-top:24px">Информатика 5–9 класс · подготовка к ОГЭ. Если письмо пришло по ошибке — просто удалите его.</p>
</div>`
}

/** Ученики: обычные пользователи сайта. Прогресс ученика хранится отдельно (коллекция progress). */
/** Поля, которые ученик может задать сам при регистрации и правке профиля.
    Роли, тариф и токены сюда не входят, поэтому саморегистрация не даёт ни прав
    администратора, ни бесплатной нейронки. */
const SELF_FIELDS = ['email', 'password', 'name', 'grade', 'course', 'consent']

/** администратор — это пользователь из коллекции users (у него есть список ролей) */
const isAdmin = (user: unknown): boolean => Boolean(user && typeof user === 'object' && 'roles' in user)

export const Students: CollectionConfig = {
  slug: 'students',
  labels: {
    singular: 'Ученик',
    plural: 'Ученики',
  },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'grade', 'createdAt', 'updatedAt'],
    group: 'Люди',
    description: 'Аккаунты сайта: вход по почте и паролю, подтверждение почты, сброс пароля.',
  },
  auth: {
    tokenExpiration: 60 * 60 * 24 * 30, /* месяц */
    verify: {
      generateEmailSubject: () => 'Подтвердите почту — Информатика и ОГЭ',
      generateEmailHTML: ({ token }) =>
        shell(
          'Подтвердите почту',
          `<p>Спасибо за регистрацию. Осталось подтвердить адрес — после этого прогресс будет сохраняться в вашем аккаунте.</p>
           <p><a href="${verifyLink(token)}" style="display:inline-block;background:#ff4d00;color:#fff;padding:12px 18px;text-decoration:none">Подтвердить почту</a></p>
           <p style="color:#666;font-size:13px">Если кнопка не работает, откройте ссылку: ${verifyLink(token)}</p>`,
        ),
    },
    forgotPassword: {
      generateEmailSubject: () => 'Сброс пароля — Информатика и ОГЭ',
      generateEmailHTML: ({ token }) =>
        shell(
          'Сброс пароля',
          `<p>Вы запросили новый пароль. Ссылка действует ограниченное время.</p>
           <p><a href="${resetLink(token)}" style="display:inline-block;background:#ff4d00;color:#fff;padding:12px 18px;text-decoration:none">Задать новый пароль</a></p>
           <p style="color:#666;font-size:13px">Если кнопка не работает, откройте ссылку: ${resetLink(token)}</p>
           <p style="color:#666;font-size:13px">Если вы не запрашивали сброс — ничего делать не нужно.</p>`,
        ),
    },
  },
  access: {
    /* читать и править себя может только сам ученик; создавать — кто угодно (регистрация).
       Список учеников целиком видят только администраторы — через админку Payload. */
    read: ({ req }) => (req.user ? { id: { equals: req.user.id } } : false),
    create: () => true,
    update: ({ req }) => (req.user ? { id: { equals: req.user.id } } : false),
    delete: ({ req }) => (req.user ? { id: { equals: req.user.id } } : false),
    admin: ({ req }) => isAdmin(req.user),
  },
  fields: [
    { name: 'name', label: 'Имя', type: 'text' },
    {
      name: 'grade',
      label: 'Класс',
      type: 'select',
      defaultValue: '9',
      options: [
        { label: '7 класс', value: '7' },
        { label: '8 класс', value: '8' },
        { label: '9 класс', value: '9' },
        { label: 'Другое', value: 'other' },
      ],
    },
    {
      name: 'course',
      label: 'Что готовим',
      type: 'select',
      defaultValue: 'oge',
      options: [
        { label: 'ОГЭ по информатике', value: 'oge' },
        { label: 'Школьная программа 5–9', value: 'base' },
        { label: 'И то, и другое', value: 'both' },
      ],
    },
    {
      name: 'plan',
      label: 'Тариф',
      type: 'select',
      defaultValue: 'max',
      options: [
        { label: 'Бесплатный (без нейронки)', value: 'free' },
        { label: 'Полный курс, 490 ₽ (без нейронки)', value: 'full' },
        { label: 'Максимум, 990 ₽ (с нейронкой)', value: 'max' },
      ],
      admin: {
        description:
          'Тариф ученика в базе — по нему сервер решает, пускать ли к провожатому (/api/ai). ' +
          'Клиентская проверка нужна для интерфейса, но обойти её нельзя: решает сервер. ' +
          'Значение по умолчанию — «Максимум»: ученики, созданные до появления поля, не теряют доступ.',
      },
    },
    {
      name: 'consent',
      label: 'Согласие на обработку данных',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Регистрируясь, ученик (или родитель) соглашается на хранение прогресса' },
    },
  ],
}

/* Поле-уровневый доступ: ученик не может поднять себе роль или роль в списке ролей.
   Так саморегистрация через POST /api/students не превращается в эскалацию прав. */
for (const field of Students.fields) {
  if (!field || typeof field !== 'object' || !('name' in field) || !('type' in field)) continue
  const name = String(field.name)
  if (field.type === 'row' || SELF_FIELDS.includes(name)) continue
  field.access = {
    create: ({ req }) => isAdmin(req.user),
    update: ({ req }) => isAdmin(req.user),
  }
}
