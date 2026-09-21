import type { CollectionConfig } from 'payload'

import { MODE_OPTIONS, ENGINE_OPTIONS, STATUS_OPTIONS } from '../fields/options'

/** Модуль курса: в школьном курсе это тематический раздел, в курсе ОГЭ — одно задание экзамена. */
export const Modules: CollectionConfig = {
  slug: 'modules',
  labels: {
    singular: 'Модуль',
    plural: 'Модули',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['order', 'title', 'course', 'exam', 'ball', 'hours', 'lessonsCount'],
    group: 'Курсы',
  },
  access: {
    read: () => true,
  },
  versions: {
    drafts: true,
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'title', label: 'Название', type: 'text', required: true },
        { name: 'order', label: 'Порядок', type: 'number', required: true, defaultValue: 10 },
      ],
    },
    {
      name: 'course',
      label: 'Курс',
      type: 'relationship',
      relationTo: 'courses',
      required: true,
      index: true,
    },
    {
      type: 'row',
      fields: [
        {
          name: 'exam',
          label: 'Задание ОГЭ',
          type: 'text',
          admin: { description: 'Например 1, 13.1, 14 или «все» для диагностики' },
        },
        { name: 'ball', label: 'Баллов за задание', type: 'number' },
        { name: 'hours', label: 'Часов на модуль', type: 'number', defaultValue: 4 },
      ],
    },
    {
      name: 'goal',
      label: 'Цель модуля',
      type: 'textarea',
      admin: { description: 'Что ученик умеет после модуля — попадает в уроки и в промпт провожатого' },
    },
    {
      type: 'row',
      fields: [
        { name: 'engine', label: 'Движок симуляции', type: 'select', options: ENGINE_OPTIONS },
        { name: 'mode', label: 'Режим модуля по умолчанию', type: 'select', options: MODE_OPTIONS },
      ],
    },
    {
      name: 'check',
      label: 'Модуль закрыт, когда',
      type: 'textarea',
      admin: { description: 'Критерий «модуль закрыт» из шаблона курса' },
    },
    {
      name: 'baseLessons',
      label: 'Уроки школьного курса, закрывающие тему',
      type: 'array',
      labels: { singular: 'Номер урока', plural: 'Номера уроков' },
      fields: [{ name: 'n', label: '№ урока', type: 'number', required: true }],
      admin: { description: 'Связь «задание ОГЭ → уроки базового курса» (поле base в реестре)' },
    },
    {
      name: 'gap',
      label: 'Чего нет в школьном курсе',
      type: 'array',
      labels: { singular: 'Доработка', plural: 'Доработки' },
      fields: [{ name: 'text', label: 'Что дописать', type: 'text', required: true }],
    },
    {
      name: 'downloads',
      label: 'Файлы и инструменты модуля',
      type: 'array',
      labels: { singular: 'Файл', plural: 'Файлы' },
      fields: [
        { name: 'title', label: 'Название', type: 'text', required: true },
        {
          name: 'kind',
          label: 'Тип',
          type: 'select',
          options: [
            { label: 'Инструмент (программа)', value: 'tool' },
            { label: 'Данные', value: 'data' },
            { label: 'Генерируется локально', value: 'sample' },
          ],
        },
        { name: 'mb', label: 'Размер, МБ', type: 'number' },
        { name: 'url', label: 'Ссылка', type: 'text' },
        { name: 'why', label: 'Зачем', type: 'textarea' },
      ],
    },
    {
      name: 'realMinimum',
      label: 'Минимум живых прогонов',
      type: 'group',
      fields: [
        { name: 'runs', label: 'Прогонов', type: 'number', defaultValue: 0 },
        { name: 'timed', label: 'Из них на время', type: 'number', defaultValue: 0 },
        { name: 'what', label: 'Что именно делать вживую', type: 'textarea' },
      ],
      admin: {
        description: 'Правило курса: практические задания несколько раз делаются в настоящей программе',
      },
    },
    {
      name: 'simLimit',
      label: 'Чего симуляция не проверит',
      type: 'textarea',
    },
    {
      name: 'lessonsCount',
      label: 'Уроков в модуле',
      type: 'number',
      admin: { readOnly: true },
    },
    {
      name: 'contentStatus',
      label: 'Готовность',
      type: 'select',
      defaultValue: 'каркас',
      options: STATUS_OPTIONS,
      admin: {
        description: 'Не путать с черновиком Payload (versions/drafts): это готовность материала',
      },
    },
  ],
}
