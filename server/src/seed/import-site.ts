/* import-site.ts — переносит контент сайта в PostgreSQL через Local API Payload.

   Что импортируется:
     • оба курса (App.COURSES из scripts/core/courses.js);
     • 13 модулей и 300 уроков школьного курса (data/lessons/module-*.js);
     • 19 модулей и 100 уроков курса ОГЭ (data/oge/course-plan.js + oge-lessons.js);
     • задачи уроков, практики, файлы модулей, минимумы живых прогонов, тарифы.

   Скрипт идемпотентный: повторный запуск обновляет документы по siteId / slug, а не плодит копии.

   Запуск: pnpm seed   (нужны поднятый Postgres и заполненный .env) */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getPayload } from 'payload'

import config from '../payload.config'

const here = path.dirname(fileURLToPath(import.meta.url))
const siteRoot = path.resolve(here, '../../..')

type AnyRec = Record<string, any>

/* ---------- 1. читаем данные сайта так же, как это делает браузер ---------- */

function loadSite(): { lessons: AnyRec[]; courses: AnyRec[]; modules: AnyRec[]; course: AnyRec } {
  const App: AnyRec = {}
  const win: AnyRec = {
    App,
    addEventListener() {},
    removeEventListener() {},
    location: { protocol: 'file:' },
    localStorage: {
      _s: {} as AnyRec,
      getItem(k: string) {
        return k in this._s ? this._s[k] : null
      },
      setItem(k: string, v: string) {
        this._s[k] = String(v)
      },
      removeItem(k: string) {
        delete this._s[k]
      },
    },
  }
  ;(globalThis as AnyRec).window = win
  ;(globalThis as AnyRec).App = App
  ;(globalThis as AnyRec).localStorage = win.localStorage
  ;(globalThis as AnyRec).location = { protocol: 'file:' }
  ;(globalThis as AnyRec).document = { addEventListener() {}, getElementById: () => null }

  const run = (rel: string) => {
    const file = path.join(siteRoot, rel)
    if (!fs.existsSync(file)) throw new Error('нет файла ' + rel)
    // eslint-disable-next-line no-new-func
    new Function('App', 'window', fs.readFileSync(file, 'utf8') + '\n//# sourceURL=' + rel)(App, win)
  }

  /* ядро нужно ради App.util / App.registerModule, курсы — ради App.COURSES */
  run('scripts/core/app.js')
  run('scripts/core/storage.js')
  run('scripts/core/courses.js')
  run('data/plans.js')

  const lessonsDir = path.join(siteRoot, 'data/lessons')
  const moduleFiles = fs.readdirSync(lessonsDir).filter((f) => /^module-.*\.js$/.test(f))
  if (!moduleFiles.length) throw new Error('нет файлов data/lessons/module-*.js')
  /* модули возвращают массив уроков, а регистрирует их собранный бандл — берём его как есть */
  run('data/lessons-bundle.js')

  run('data/oge/oge-course.js')
  run('data/oge/oge-delivery.js')
  run('data/oge/course-plan.js')
  run('data/oge/oge-lessons.js')

  return {
    lessons: App.LESSONS || [],
    courses: App.COURSES || [],
    modules: (App.oge && App.oge.MODULES) || [],
    course: (App.oge && App.oge.COURSE) || null,
  }
}

/* ---------- 2. импорт ---------- */

const data = loadSite()
console.log(
  `Данные сайта: курсов ${data.courses.length}, уроков ${data.lessons.length}, модулей ОГЭ ${data.modules.length}`,
)
if (!data.lessons.length) throw new Error('уроки не прочитались — проверь пути data/lessons')

const payload = await getPayload({ config })

const courseIds: AnyRec = {}
const moduleIds: AnyRec = {}

/* -- 2.1 курсы -- */
for (const c of data.courses) {
  const found = await payload.find({ collection: 'courses', where: { slug: { equals: c.id } }, limit: 1 })
  const body = {
    name: c.name,
    slug: c.id,
    short: c.short,
    kicker: c.kicker,
    note: c.note,
    order: c.id === 'base' ? 1 : 2,
    active: true,
  }
  const doc = found.docs[0]
    ? await payload.update({ collection: 'courses', id: found.docs[0].id, data: body })
    : await payload.create({ collection: 'courses', data: body })
  courseIds[c.id] = doc.id
  console.log(`курс ${c.id} → ${doc.id}`)
}

/* -- 2.2 модули школьного курса: по полю module у уроков -- */
const baseModules: AnyRec[] = []
data.lessons
  .filter((l: AnyRec) => (l.course || 'base') === 'base')
  .forEach((l: AnyRec) => {
    let m = baseModules.find((x) => x.title === l.module)
    if (!m) {
      m = { title: l.module || 'Прочее', lessons: [] }
      baseModules.push(m)
    }
    m.lessons.push(l)
  })

async function upsertModule(courseSlug: string, title: string, extra: AnyRec, order: number) {
  const key = courseSlug + ':' + title
  if (moduleIds[key]) return moduleIds[key]
  const found = await payload.find({
    collection: 'modules',
    where: { and: [{ course: { equals: courseIds[courseSlug] } }, { title: { equals: title } }] },
    limit: 1,
  })
  const body: AnyRec = {
    title,
    course: courseIds[courseSlug],
    order,
    contentStatus: courseSlug === 'oge' ? 'каркас' : 'готов',
    ...extra,
  }
  const doc = found.docs[0]
    ? await payload.update({ collection: 'modules', id: found.docs[0].id, data: body, draft: false })
    : await payload.create({ collection: 'modules', data: body, draft: false })
  moduleIds[key] = doc.id
  return doc.id
}

let moduleOrder = 0
for (const m of baseModules) {
  moduleOrder += 1
  await upsertModule('base', m.title, { lessonsCount: m.lessons.length }, moduleOrder)
  console.log(`модуль base «${m.title}» — уроков ${m.lessons.length}`)
}

/* -- 2.3 модули курса ОГЭ: из реестра + сгенерированного плана -- */
const ogePlanById: AnyRec = {}
;(data.course?.modules || []).forEach((m: AnyRec) => {
  ogePlanById[m.id] = m
})

let ogeOrder = moduleOrder
for (const mod of data.modules) {
  const plan = ogePlanById[mod.id]
  if (!plan) continue
  ogeOrder += 1
  const extra: AnyRec = {
    exam: String(mod.exam),
    ball: mod.ball,
    hours: mod.hours,
    engine: mod.engine,
    goal: mod.goal,
    check: mod.check,
    baseLessons: (mod.base || []).map((n: number) => ({ n })),
    gap: (mod.gap || []).map((text: string) => ({ text })),
    lessonsCount: plan.lessons.length,
    realMinimum: {
      runs: plan.realRuns || 0,
      timed: plan.realTimed || 0,
      what: plan.realMinimum || '',
    },
    simLimit: plan.simLimit || '',
  }
  await upsertModule('oge', plan.title, extra, ogeOrder)
  console.log(`модуль oge «${plan.title}» (задание ${mod.exam}) — уроков ${plan.lessons.length}`)
}

/* -- 2.4 уроки -- */
let created = 0
let updated = 0
for (const l of data.lessons) {
  const courseSlug: string = l.course || 'base'
  const moduleTitle = courseSlug === 'oge' ? String(l.module || '').replace(/^ОГЭ · /, '') : l.module || 'Прочее'
  const moduleId = moduleIds[courseSlug + ':' + moduleTitle]
  if (!moduleId) {
    console.warn(`пропуск урока ${l.id}: не найден модуль «${moduleTitle}»`)
    continue
  }

  const body: AnyRec = {
    siteId: l.id,
    title: l.title,
    sub: l.sub || '',
    course: courseIds[courseSlug],
    module: moduleId,
    kind: l.kind || 'lesson',
    minutes: l.minutes || 7,
    order: l.oge?.lessonN ?? undefined,
    theory: l.theory || '',
    tasks: (l.tasks || []).map((t: AnyRec) => ({
      tid: t.id,
      type: t.type || 'input',
      q: t.q,
      answer: String(t.answer),
      explain: t.explain || '',
      options: (t.options || []).map((o: string) => ({ text: o })),
    })),
    practice: l.practice
      ? { engine: l.practice.engine, brief: l.practice.brief || '', config: l.practice.config ?? {} }
      : undefined,
    contentStatus: courseSlug === 'oge' ? 'каркас' : 'готов',
    sourceFile: courseSlug === 'oge' ? 'data/oge/oge-lessons.js' : 'data/lessons-bundle.js',
  }

  if (l.oge) {
    body.oge = {
      exam: String(l.oge.exam),
      mode: l.oge.mode,
      ball: l.oge.ball,
      files: (l.oge.files || []).map((f: AnyRec) => ({
        title: f.title,
        size: f.size,
        url: f.url,
        why: f.why,
      })),
      realRuns: l.oge.realRuns || 0,
      realTimed: l.oge.realTimed || 0,
      shortTrack: !!l.oge.shortTrack,
      simLimit: l.oge.simLimit || '',
      check: l.oge.check || '',
      goal: l.oge.goal || '',
    }
  }

  const found = await payload.find({ collection: 'lessons', where: { siteId: { equals: l.id } }, limit: 1 })
  if (found.docs[0]) {
    await payload.update({ collection: 'lessons', id: found.docs[0].id, data: body, draft: false })
    updated += 1
  } else {
    await payload.create({ collection: 'lessons', data: body, draft: false })
    created += 1
  }
}

/* -- 2.5 тарифы и режимы трат (data/plans.js) -- */
const siteApp = (globalThis as AnyRec).App as AnyRec
if (siteApp?.PLANS) {
  const plans = siteApp.PLANS as AnyRec[]
  const promos: AnyRec[] = siteApp.PROMO || []
  await payload.updateGlobal({
    slug: 'plans',
    data: {
      items: plans.map((p) => ({
        planId: p.id,
        name: p.name,
        price: p.price || 0,
        dailyTokens: p.dailyTokens,
        desc: p.desc || '',
        modes: (p.modes || []).map((mode: string) => ({ mode })),
      })),
      promoCodes: promos.map((p) => ({ code: p.code, plan: p.plan })),
    },
  })
  console.log(`тарифы: ${plans.length}`)
}

const totals = {
  courses: (await payload.count({ collection: 'courses' })).totalDocs,
  modules: (await payload.count({ collection: 'modules' })).totalDocs,
  lessons: (await payload.count({ collection: 'lessons' })).totalDocs,
}
console.log(`\nИтог: уроков создано ${created}, обновлено ${updated}`)
console.log(`В базе: курсов ${totals.courses}, модулей ${totals.modules}, уроков ${totals.lessons}`)
console.log('Проверка целостности: pnpm verify')
process.exit(0)
