import type { GlobalConfig } from 'payload'

/** Тарифы и лимиты нейронки: сейчас это data/plans.js на сайте, дальше — здесь. */
export const Plans: GlobalConfig = {
  slug: 'plans',
  label: 'Тарифы и лимиты',
  admin: {
    group: 'Настройки',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'items',
      label: 'Тарифы',
      type: 'array',
      labels: { singular: 'Тариф', plural: 'Тарифы' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'planId', label: 'Идентификатор', type: 'text', required: true },
            { name: 'name', label: 'Название', type: 'text', required: true },
            { name: 'price', label: 'Цена, ₽/мес', type: 'number' },
          ],
        },
        { name: 'dailyTokens', label: 'Токенов в день', type: 'number', required: true },
        {
          name: 'modes',
          label: 'Режимы трат',
          type: 'array',
          fields: [{ name: 'mode', label: 'Режим', type: 'text', required: true }],
        },
        { name: 'desc', label: 'Описание', type: 'textarea' },
      ],
    },
    {
      name: 'promoCodes',
      label: 'Промокоды',
      type: 'array',
      fields: [
        { name: 'code', label: 'Код', type: 'text', required: true },
        { name: 'plan', label: 'Даёт тариф', type: 'text', required: true },
      ],
    },
  ],
}
