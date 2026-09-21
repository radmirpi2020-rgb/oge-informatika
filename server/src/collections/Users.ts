import type { CollectionConfig } from 'payload'

/** Администраторы и редакторы контента: вход в админку Payload.

   Ученики — отдельная коллекция students (см. Students.ts), чтобы права не смешивались. */
export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    singular: 'Администратор',
    plural: 'Администраторы',
  },
  admin: {
    useAsTitle: 'email',
    group: 'Люди',
    description: 'Вход в админку. Контент курсов, ученики, тарифы, письма.',
  },
  auth: true,
  access: {
    /* администраторов заводит только администратор */
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: 'name',
      label: 'Имя',
      type: 'text',
    },
    {
      name: 'roles',
      label: 'Роль',
      type: 'select',
      hasMany: true,
      defaultValue: ['admin'],
      options: [
        { label: 'Администратор', value: 'admin' },
        { label: 'Редактор контента', value: 'editor' },
      ],
      admin: { description: 'Роль admin открывает всё; editor — только курсы, модули, уроки, медиа' },
    },
  ],
  versions: false,
}
