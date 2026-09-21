import type { CollectionConfig } from 'payload'

import { ENGINE_OPTIONS, KIND_OPTIONS, MODE_OPTIONS, STATUS_OPTIONS } from '../fields/options'

/** Урок или практика. siteId — тот самый номер, которым пользуется сайт (1..300 и 1001..1100). */
export const Lessons: CollectionConfig = {
  slug: 'lessons',
  labels: {
    singular: 'Урок',
    plural: 'Уроки',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['siteId', 'title', 'course', 'module', 'kind', 'minutes', 'contentStatus'],
    group: 'Курсы',
    listSearchableFields: ['title', 'sub', 'siteId'],
  },
  access: {
    read: () => true,
  },
  versions: {
    drafts: true,
    maxPerDoc: 20,
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'siteId',
          label: 'Номер на сайте',
          type: 'number',
          required: true,
          unique: true,
          index: true,
          admin: {
            description: '1–300 школьный курс, 1001–1100 курс ОГЭ. Менять нельзя: по нему считается прогресс ученика',
            width: '30%',
          },
        },
        {
          name: 'title',
          label: 'Название',
          type: 'text',
          required: true,
          admin: { width: '70%' },
        },
      ],
    },
    { name: 'sub', label: 'Подзаголовок', type: 'text' },
    {
      type: 'row',
      fields: [
        { name: 'course', label: 'Курс', type: 'relationship', relationTo: 'courses', required: true, index: true },
        { name: 'module', label: 'Модуль', type: 'relationship', relationTo: 'modules', required: true, index: true },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'kind', label: 'Тип', type: 'select', options: KIND_OPTIONS, defaultValue: 'lesson', required: true },
        { name: 'minutes', label: 'Минут', type: 'number', defaultValue: 7 },
        { name: 'order', label: 'Порядок в модуле', type: 'number' },
      ],
    },
    {
      name: 'theory',
      label: 'Теория',
      type: 'textarea',
      admin: {
        description:
          'Разметка как на сайте: **жирный**, `код`, строки «> Лайфхак.» и «!! Ошибка.», блок ~~~ для примеров',
        rows: 14,
      },
    },
    {
      name: 'tasks',
      label: 'Задачи',
      type: 'array',
      labels: { singular: 'Задача', plural: 'Задачи' },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'tid',
              label: 'Ключ',
              type: 'text',
              required: true,
              admin: { description: 'Например l1t1 — ключ ответа ученика в браузере', width: '30%' },
            },
            {
              name: 'type',
              label: 'Тип',
              type: 'select',
              defaultValue: 'input',
              options: [
                { label: 'Ввод ответа', value: 'input' },
                { label: 'Выбор варианта', value: 'choice' },
              ],
              admin: { width: '30%' },
            },
            {
              name: 'answer',
              label: 'Верный ответ',
              type: 'text',
              required: true,
              admin: {
                description: 'Для выбора — номер варианта с нуля. Альтернативы разделяются символом |',
                width: '40%',
              },
            },
          ],
        },
        { name: 'q', label: 'Вопрос', type: 'textarea', required: true },
        {
          name: 'options',
          label: 'Варианты ответа',
          type: 'array',
          fields: [{ name: 'text', label: 'Вариант', type: 'text', required: true }],
          admin: { condition: (data, siblingData) => siblingData?.type === 'choice' },
        },
        { name: 'explain', label: 'Разбор', type: 'textarea', required: true },
      ],
    },
    {
      name: 'practice',
      label: 'Практика',
      type: 'group',
      admin: { condition: (data, siblingData) => siblingData?.kind === 'practice' },
      fields: [
        { name: 'engine', label: 'Движок', type: 'select', options: ENGINE_OPTIONS, required: true },
        { name: 'brief', label: 'Задание ученику', type: 'textarea' },
        {
          name: 'config',
          label: 'Конфигурация движка',
          type: 'json',
          admin: { description: 'Тот же объект, что ждёт App.PRACTICE.<engine>.mount(host, cfg, ctx)' },
        },
      ],
    },
    {
      name: 'oge',
      label: 'Курс ОГЭ',
      type: 'group',
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'exam', label: 'Задание ОГЭ', type: 'text' },
            { name: 'mode', label: 'Режим урока', type: 'select', options: MODE_OPTIONS },
            { name: 'ball', label: 'Балл', type: 'number' },
          ],
        },
        {
          name: 'files',
          label: 'Файлы к уроку',
          type: 'array',
          fields: [
            { name: 'title', label: 'Название', type: 'text', required: true },
            { name: 'size', label: 'Размер', type: 'text' },
            { name: 'url', label: 'Ссылка', type: 'text' },
            { name: 'why', label: 'Зачем', type: 'textarea' },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'realRuns', label: 'Живых прогонов в модуле', type: 'number' },
            { name: 'realTimed', label: 'Из них на время', type: 'number' },
            { name: 'shortTrack', label: 'Входит в короткий трек', type: 'checkbox' },
          ],
        },
        { name: 'simLimit', label: 'Чего симуляция не проверит', type: 'textarea' },
        { name: 'check', label: 'Модуль закрыт, когда', type: 'textarea' },
        { name: 'goal', label: 'Цель модуля', type: 'textarea' },
      ],
    },
    {
      name: 'contentStatus',
      label: 'Готовность',
      type: 'select',
      defaultValue: 'каркас',
      options: STATUS_OPTIONS,
      admin: {
        position: 'sidebar',
        description: 'Не путать с черновиком Payload: это готовность материала',
      },
    },
    {
      name: 'sourceFile',
      label: 'Источник',
      type: 'text',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Файл, из которого урок импортирован (для сверки)',
      },
    },
  ],
}
