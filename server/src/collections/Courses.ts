import type { CollectionConfig } from 'payload'

/** Курсы сайта: «Информатика 5–9 класс» (base) и «Подготовка к ОГЭ» (oge). */
export const Courses: CollectionConfig = {
  slug: 'courses',
  labels: {
    singular: 'Курс',
    plural: 'Курсы',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['order', 'name', 'slug', 'lessonsCount'],
    group: 'Курсы',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'name',
      label: 'Название',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      label: 'Идентификатор',
      type: 'select',
      required: true,
      unique: true,
      options: [
        { label: 'base — школьный курс 5–9 класс', value: 'base' },
        { label: 'oge — подготовка к ОГЭ', value: 'oge' },
      ],
      admin: {
        description: 'Совпадает с App.COURSES[].id на сайте. Менять только вместе с кодом сайта.',
      },
    },
    {
      name: 'short',
      label: 'Короткое имя (в шапке)',
      type: 'text',
      required: true,
    },
    {
      name: 'kicker',
      label: 'Надпись над заголовком',
      type: 'text',
    },
    {
      name: 'note',
      label: 'Описание курса',
      type: 'textarea',
    },
    {
      name: 'order',
      label: 'Порядок',
      type: 'number',
      required: true,
      defaultValue: 10,
      admin: { description: 'Меньше число — выше в интерфейсе' },
    },
    {
      name: 'lessonsCount',
      label: 'Уроков в курсе',
      type: 'number',
      admin: {
        readOnly: true,
        description: 'Считается при импорте и проверке (pnpm verify)',
      },
    },
    {
      name: 'active',
      label: 'Показывать на сайте',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
}
