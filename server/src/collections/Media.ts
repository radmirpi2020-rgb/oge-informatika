import type { CollectionConfig } from 'payload'

/** Картинки и звук сайта: assets/images, assets/audio. */
export const Media: CollectionConfig = {
  slug: 'media',
  labels: {
    singular: 'Медиафайл',
    plural: 'Медиа',
  },
  admin: {
    group: 'Настройки',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      label: 'Подпись (alt)',
      type: 'text',
      required: true,
    },
    {
      name: 'usage',
      label: 'Где используется',
      type: 'text',
      admin: {
        description: 'Например: hero — главная; lesson — картинка урока; greet — озвучка приветствия',
      },
    },
  ],
  upload: {
    mimeTypes: ['image/*', 'audio/*'],
  },
}
