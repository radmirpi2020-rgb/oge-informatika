import type { CollectionConfig } from 'payload'

/** Прогресс ученика: одно «облако» на ученика, чтобы аккаунт был полезен.

   Доступ: только свой документ. Администраторы видят всё — через admin-панель Payload. */
export const Progress: CollectionConfig = {
  slug: 'progress',
  labels: {
    singular: 'Прогресс ученика',
    plural: 'Прогресс учеников',
  },
  admin: {
    useAsTitle: 'student',
    defaultColumns: ['student', 'updatedAt'],
    group: 'Люди',
    description: 'Ответы, пройденные уроки и серии дней. Сайт синхронизирует сюда localStorage.',
  },
  access: {
    read: ({ req }) => (req.user ? { student: { equals: req.user.id } } : false),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => (req.user ? { student: { equals: req.user.id } } : false),
    delete: ({ req }) => (req.user ? { student: { equals: req.user.id } } : false),
    admin: ({ req }) => Boolean(req.user && 'roles' in req.user),
  },
  fields: [
    {
      name: 'student',
      label: 'Ученик',
      type: 'relationship',
      relationTo: 'students',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Один документ на ученика' },
    },    {
      name: 'completed',
      label: 'Пройденные уроки',
      type: 'json',
      admin: { description: 'Объект вида { "12": { "at": 1700000000000 } } — как в localStorage сайта' },
    },
    {
      name: 'answers',
      label: 'Ответы на задачи',
      type: 'json',
      admin: { description: 'Объект вида { "l1t1": { ok: true, v: "2", at: … } }' },
    },
    {
      name: 'practice',
      label: 'Решения практик',
      type: 'json',
    },
    {
      name: 'test',
      label: 'Входной тест',
      type: 'json',
    },
    {
      type: 'row',
      fields: [
        { name: 'streak', label: 'Серия дней', type: 'number', defaultValue: 0 },
        { name: 'minutes', label: 'Минут всего', type: 'number', defaultValue: 0 },
      ],
    },
    {
      name: 'source',
      label: 'Откуда пришло',
      type: 'text',
      admin: { description: 'Например: сайт, браузер Chrome, перенос из localStorage' },
    },
    {
      name: 'aiUsage',
      label: 'Расход провожатого по дням',
      type: 'json',
      admin: {
        description:
          'Объект вида { "2026-09-21": { tokens: 41200, calls: 9 } }. Считает сервер (/api/ai), ' +
          'чтобы ключ DeepSeek не лежал в браузере и лимит нельзя было обойти.',
      },
    },
  ],
}
