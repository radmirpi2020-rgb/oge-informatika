import type { GlobalConfig } from 'payload'

/** Тарифы и лимиты нейронки: сейчас это data/plans.js на сайте, дальше — здесь.

    Разделение важное: доступ к урокам и доступ к нейронке — разные вещи.
      free  — бесплатный: попробовать курс, нейронки нет;
      full  — «Полный курс» 490 ₽: все уроки и практики, нейронки нет;
      max   — «Максимум» 990 ₽: всё то же плюс провожатый на 100 000 токенов в день.
    Поле ai показывает, входит ли нейронка: без него режимы трат недоступны. */
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
        {
          type: 'row',
          fields: [
            {
              name: 'ai',
              label: 'Нейронка входит',
              type: 'checkbox',
              defaultValue: false,
              admin: { description: 'Если выключено — режимы трат закрыты, кружок лимита показывает прочерк' },
            },
            { name: 'dailyTokens', label: 'Токенов в день', type: 'number' },
            { name: 'badge', label: 'Плашка на карточке', type: 'text' },
          ],
        },
        {
          name: 'modes',
          label: 'Режимы трат',
          type: 'array',
          admin: { description: 'Заполняется только у тарифов с нейронкой: eco, std, pro' },
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
