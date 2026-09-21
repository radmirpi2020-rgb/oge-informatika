/* publish.ts — публикует импортированные уроки и модули (снимает статус черновика).

   Зачем: коллекции lessons и modules включены с версиями (versions.drafts), поэтому
   импорт через Local API с `draft: false` оставлял документы черновиками. Публичный REST
   тогда отдаёт их как черновики, и админка по умолчанию прячет их из списков.
   Скрипт проходит по всем документам и выставляет _status = 'published'.

   Запуск: pnpm publish:content */
import { getPayload } from 'payload'

import config from '../payload.config'

const payload = await getPayload({ config })

async function publishAll(collection: 'lessons' | 'modules') {
  let published = 0
  let page = 1
  for (;;) {
    const res = await payload.find({ collection, limit: 100, page, draft: true, depth: 0 })
    if (!res.docs.length) break
    for (const doc of res.docs) {
      if (doc._status === 'published') continue
      await payload.update({
        collection,
        id: doc.id,
        data: { _status: 'published' } as never,
        draft: false,
      })
      published += 1
    }
    if (!res.hasNextPage) break
    page += 1
  }
  const check = await payload.count({ collection, where: { _status: { equals: 'published' } } })
  console.log(`${collection}: опубликовано ${published}, всего опубликованных ${check.totalDocs}`)
  return check.totalDocs
}

const lessons = await publishAll('lessons')
const modules = await publishAll('modules')

console.log(`\nИтог: уроков опубликовано ${lessons}, модулей ${modules}`)
process.exit(0)
