import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { ru } from '@payloadcms/translations/languages/ru'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Courses } from './collections/Courses'
import { Modules } from './collections/Modules'
import { Lessons } from './collections/Lessons'
import { Students } from './collections/Students'
import { Progress } from './collections/Progress'
import { Plans } from './globals/Plans'
import { buildEmailAdapter } from './email'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const siteOrigin = process.env.SITE_ORIGIN || 'http://127.0.0.1:8080'

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: '— Информатика и ОГЭ',
    },
  },
  /* контент курсов: два курса, модули, уроки, задачи + медиа и тарифы.
     Люди: Users — вход в админку, Students — аккаунты учеников (регистрация, подтверждение почты,
     сброс пароля), Progress — облако прогресса, по одному документу на ученика. */
  collections: [Courses, Modules, Lessons, Users, Students, Progress, Media],
  globals: [Plans],
  editor: lexicalEditor(),
  /* Письма: подтверждение почты и сброс пароля. Без SMTP_* в .env Payload пишет письма
     в консоль сервера — этого хватает, чтобы проверить регистрацию локально. */
  email: buildEmailAdapter(),
  secret: process.env.PAYLOAD_SECRET || 'dev-secret',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  /* PostgreSQL: строка подключения из .env, локально — портативный сервер (pnpm db:start).
     push:true — схема применяется автоматически при запуске (удобно в разработке и при импорте).
     Для продакшена: PAYLOAD_DISABLE_PUSH=1 и миграции (payload migrate:create / migrate). */
  db: postgresAdapter({
    push: process.env.PAYLOAD_DISABLE_PUSH !== '1',
    pool: {
      connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5433/oge_site',
    },
  }),
  sharp,
  /* статический сайт ходит в API из другого origin (index.html на своём порту) */
  cors: [siteOrigin, 'http://localhost:8080', 'http://127.0.0.1:8080', 'null'],
  csrf: [siteOrigin, 'http://localhost:8080', 'http://127.0.0.1:8080'],
  i18n: {
    supportedLanguages: { ru },
    fallbackLanguage: 'ru',
  },
})
