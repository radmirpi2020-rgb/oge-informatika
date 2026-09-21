/* verify.ts — проверяет, что в PostgreSQL лежит ровно то, что нужно сайту.

   Правила (совпадают с tools/render-test.js и docs/OGE-COURSE-TEMPLATE.md):
     • два курса: base и oge;
     • 300 уроков школьного курса и 100 уроков ОГЭ;
     • сумма баллов по модулям ОГЭ = 21;
     • у каждого урока ОГЭ есть режим, у практических модулей — минимум живых прогонов;
     • у 300 уроков школьного курса есть теория и задачи.

   Запуск: pnpm verify */
import { getPayload } from 'payload'

import config from '../payload.config'

type AnyRec = Record<string, any>

const payload = await getPayload({ config })
const problems: string[] = []

const courses = await payload.find({ collection: 'courses', limit: 10, sort: 'order' })
const coursesBySlug: AnyRec = {}
courses.docs.forEach((c: AnyRec) => {
  coursesBySlug[c.slug] = c
})

if (!coursesBySlug.base) problems.push('нет курса base')
if (!coursesBySlug.oge) problems.push('нет курса oge')

const lessonsBase = await payload.find({ collection: 'lessons', where: { 'course.slug': { equals: 'base' } }, limit: 0 })
const lessonsOge = await payload.find({ collection: 'lessons', where: { 'course.slug': { equals: 'oge' } }, limit: 0 })

if (lessonsBase.totalDocs !== 300) problems.push(`уроков курса base: ${lessonsBase.totalDocs}, ожидается 300`)
if (lessonsOge.totalDocs !== 100) problems.push(`уроков курса oge: ${lessonsOge.totalDocs}, ожидается 100`)

/* --- модули ОГЭ: баллы и живые прогоны --- */
const modulesOge = await payload.find({
  collection: 'modules',
  where: { 'course.slug': { equals: 'oge' } },
  limit: 50,
  sort: 'order',
})
/* Сумма баллов считается по ЗАДАНИЯМ, а не по модулям: в реестре балл 13.1 и 13.2 стоит
   у двух модулей сразу (это варианты одного задания 13), а диагностика и симуляции
   помечены как «весь вариант» / «13–16» — их баллы в 21 не входят. */
const ballsByTask = new Map<string, number>()
let realRuns = 0
let missingMode = 0
modulesOge.docs.forEach((m: AnyRec) => {
  const exam = String(m.exam || '')
  const runs = m.realMinimum?.runs || 0
  realRuns += runs
  if (runs > 0 && !m.realMinimum?.what) problems.push(`модуль «${m.title}»: живые прогоны без описания`)
  if (exam === 'все' || exam === '13–16' || !exam) return
  const key = exam.startsWith('13') ? '13' : exam /* 13.1 и 13.2 — одно задание */
  ballsByTask.set(key, Math.max(ballsByTask.get(key) || 0, m.ball || 0))
})
const balls = [...ballsByTask.values()].reduce((a, b) => a + b, 0)
if (balls !== 21) problems.push(`сумма баллов по заданиям ОГЭ: ${balls}, ожидается 21`)
if (realRuns !== 32) problems.push(`живых прогонов в модулях ОГЭ: ${realRuns}, ожидается 32`)
if (modulesOge.totalDocs !== 19) problems.push(`модулей ОГЭ: ${modulesOge.totalDocs}, ожидается 19`)

/* --- уроки ОГЭ: режим у каждого --- */
for (const l of lessonsOge.docs as AnyRec[]) {
  if (!l.oge?.mode) {
    missingMode += 1
    if (missingMode < 5) problems.push(`урок ${l.siteId} «${l.title}»: нет режима`)
  }
}

/* --- школьный курс: теория и задачи --- */
const sampleBase = await payload.find({
  collection: 'lessons',
  where: { 'course.slug': { equals: 'base' } },
  limit: 300,
})
let noTheory = 0
let noTasks = 0
let tasks = 0
;(sampleBase.docs as AnyRec[]).forEach((l) => {
  if (!l.theory) noTheory += 1
  const n = (l.tasks || []).length
  tasks += n
  if (!n && l.kind !== 'practice') noTasks += 1
})
if (noTheory) problems.push(`уроков base без теории: ${noTheory}`)
if (noTasks) problems.push(`уроков base без задач и без практики: ${noTasks}`)

/* --- практики --- */
const practices = await payload.find({
  collection: 'lessons',
  where: { kind: { equals: 'practice' } },
  limit: 0,
})

const shortTrack = await payload.find({
  collection: 'lessons',
  where: { 'oge.shortTrack': { equals: true } },
  limit: 0,
})

console.log('Что лежит в PostgreSQL:')
console.log(`  курсов:        ${courses.totalDocs}`)
console.log(`  модулей:       ${(await payload.count({ collection: 'modules' })).totalDocs} (из них ОГЭ: ${modulesOge.totalDocs})`)
console.log(`  уроков:        ${lessonsBase.totalDocs} школьных + ${lessonsOge.totalDocs} ОГЭ`)
console.log(`  задач:         ${tasks}`)
console.log(`  практик:       ${practices.totalDocs}`)
console.log(`  короткий трек: ${shortTrack.totalDocs} уроков`)
console.log(`  баллов ОГЭ:    ${balls} из 21`)
console.log(`  живых прогонов: ${realRuns}`)

if (problems.length) {
  console.log('\nПРОБЛЕМЫ:')
  problems.forEach((p) => console.log('  - ' + p))
  process.exit(1)
}
console.log('\nПроверка пройдена: база соответствует сайту.')
process.exit(0)
