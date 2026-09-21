# Контракт ядра «ОГЭ·Информатика»

Сайт работает **без сборки**: обычные `<script>` теги, всё складывается в глобальный объект `App`.
Открывается двойным щелчком по `index.html` (file://) и с GitHub Pages.

## 1. Глобальные объекты

| Объект | Файл | Назначение |
|---|---|---|
| `App` | `scripts/core/app.js` | создаётся первым, если ещё нет |
| `App.LESSONS` | `data/lessons/*.js` | все уроки (складываются модулями) |
| `App.TEST_QUESTIONS` | `data/test-questions.js` | входной тест |
| `App.PLANS` | `data/plans.js` | тарифы, лимиты токенов |
| `App.AI` | `scripts/ai/ai.js` | DeepSeek-провожатый |
| `App.PRACTICE` | `scripts/practice/*.js` | движки интерактивных практик |

Порядок подключения в `index.html`: `core` → `data` → `practice` → `ai` → `pages` → `boot`.

## 2. Схема урока

```js
App.registerModule("Модуль 1. Системы счисления", [
  {
    id: 1,                        // уникальный: 1..300 школьный курс, 1001..1100 курс ОГЭ
    module: "Системы счисления",  // короткое имя модуля
    course: "base",               // "base" — 5–9 класс, "oge" — подготовка к ОГЭ (см. §9)
    title: "Введение: зачем нужны системы счисления",
    sub: "Позиции, основания, цифры",
    kind: "lesson",               // "lesson" | "practice"
    minutes: 8,                   // оценка времени
    theory: "…",                  // markdown-подобный текст (см. §5)
    tasks: [ /* 5 задач */ ]
  }
], "base");                       // третий аргумент — курс модуля (по умолчанию "base")
```

Урок-практика (`kind: "practice"`) вместо `tasks` может нести поля практики:

```js
{
  id: 4, kind: "practice", title: "Практика: чтение двоичных чисел",
  practice: {
    engine: "sandbox",            // sandbox | code | robot | sql | table | graph
    brief: "Что делает ученик — одно-два предложения",
    config: { /* своё для каждого движка, см. §4 */ }
  },
  tasks: []                       // допускается пустой массив
}
```

## 3. Схема задачи

```js
{ id: "l1t1", type: "input",  q: "Сколько цифр в двоичной системе?", answer: "2", explain: "0 и 1." }
{ id: "l1t5", type: "choice", q: "Порядок без скобок?", options: ["…","…","…","…"], answer: 1, explain: "НЕ, И, ИЛИ." }
```

Правила проверки ответа `input` (реализованы в `App.core.normalize`, повторять их в контенте не нужно):
- пробелы удаляются, регистр не важен, `,` → `.`, `ё` → `е`;
- альтернативные верные ответы разделяются символом `|` в поле `answer`, например `"16|0x10"`;
- ответ ученика `1`/`0`/`да`/`нет`/`true`/`false` приводится к общему виду.

`explain` — 1–2 короткие строки, обязательно.

## 4. Движки практик

Все движки регистрируются как `App.PRACTICE.<engine>` и обязаны иметь метод
`mount(host, cfg, ctx)` — `host` это пустой `<div>`, куда рендерится практика,
`ctx` = `{ lesson, onSolved() }`.

| Движок | Отвечает за | Минимальный `config` |
|---|---|---|
| `sandbox` | ввод ответа + «показать шаги» | `{ steps: [ {q, answer, steps:[…]} ] }` |
| `code` | редактор Python, запуск, сверка вывода | `{ task, starter, expected, solution }` |
| `robot` | блочный конструктор, сетка, анимация | `{ field:{w,h,start,goal,walls}, allowed:[блоки], target:{…} }` |
| `sql` | SQL-подобные запросы к таблице | `{ table:{name,columns,rows}, task, expected }` |
| `table` | формулы и пошаговый расчёт | `{ cells, task, answer, steps }` |
| `graph` | выбор маршрута/путей на графе | `{ nodes, edges, task, answer }` |

`ctx.onSolved()` вызывается, когда цель практики достигнута — это засчитывает урок.

## 5. Разметка теории

Как в прототипе (не менять, редактор и предпросмотр опираются на это):

```
**жирный**   *курсив*   `код`
> Лайфхак. строка с оранжевой полосой
!! Ошибка. строка с красной полосой
~~~
моноширинный пример
~~~р
```

## 6. CSS-контракт (классы уже есть в styles/)

Базовые: `.wrap .layout aside main header footer .kicker .lead .card .row .btn .btn.ghost .btn.sm .btn.danger .cta .alert .back`
Уроки: `.lesson-card .lesson-card .num .meta .sub .status(.done,.partial) .practical-tag`
Задачи: `.task .task .label .qt .feedback(.ok,.err) .explain`
Практики: `.practical .practical-badge .practical-task .sandbox .steps .code-editor .code-out .robot-grid .sql-out .table-practice .graph-practice`
Прогресс/админка: `.progress-row .big-stat .stat-grid .stat-box .admin-lesson-row .tool-btn .field .alert`
AI: `.ai-fab .ai-panel .ai-msgs .ai-msg(.user,.bot) .limit-ring .tutor-box`

Тёмная тема — только через переменные `--bg --fg --muted --line --accent --card`.
Никаких зашитых цветов, кроме `--ok` и `--err`.

## 7. Дизайн-язык (сохраняем как в прототипе)

- светлый фон `#f6f5f1`, акцент `#ff4d00`, рамки 1px чёрные/серые, радиусы 0;
- моноширинные цифры (`ui-monospace`) для чисел, номеров уроков, статистики;
- вертикальные линии по краям `.wrap`, шапка sticky, на мобиле нижняя навигация;
- тап-зоны ≥44px, поля ввода 16px (Safari не зумит), `overflow-x:hidden` только на `body`;
- `@media (prefers-reduced-motion:reduce)` отключает анимации.

## 8. Лимиты токенов (единая логика)

`App.AI.spend(prompt, completion)` пишет расход в `localStorage` по дате.
Лимит берётся из `App.PLANS[current].dailyTokens`:

| Тариф | В день | Режимы |
|---|---|---|
| Free | 50 000 | эконом |
| Старт 490₽ | 250 000 | эконом, стандарт |
| Про 1490₽ | 500 000 | все, включая «полный» (агент с инструментами) |

Режим трат выше доступного — блокируется с предложением повысить тариф.
Кружок лимита (`.limit-ring`) заполняется как в GPT и есть на всех страницах.

---

## 9. Два курса на одном сайте

Сайт ведёт **два независимых курса**, а не один список уроков.

| Курс | id | Уроки | Файл данных |
|---|---|---|---|
| Информатика 5–9 класс | `base` | 300 (id 1–300) | `data/lessons-bundle.js` |
| Подготовка к ОГЭ | `oge` | 100 (id 1001–1100) | `data/oge/oge-lessons.js` |

### Реестр и выбор курса

| Объект | Что делает |
|---|---|
| `App.COURSES` | список курсов: `id`, `name`, `short`, `kicker`, `note` (`scripts/core/courses.js`) |
| `App.course.current()` | выбранный курс из `localStorage` (ключ `oge_course`), по умолчанию `base` |
| `App.course.set(id)` | сохранить выбор курса |
| `App.course.ofLesson(lesson)` | курс урока: `lesson.course` или `"base"`, если поле пустое |
| `App.course.lessons(id)` | все уроки курса (сырые) |
| `App.course.tabsHtml(mode)` | готовый переключатель курсов; `mode === "compact"` — горизонтальный |
| `App.course.label(id)` | название курса для крошек и промпта провожатого |

Клик по любому элементу с `data-course="…"` обрабатывает роутер (`bindShell`): переключает курс,
сбрасывает фильтры страницы уроков и перерисовывает текущую страницу (с главной уводит в `#/lessons`).
Страницам не нужен свой `bind` для переключателя.

### Прогресс и фильтры

`ST.allLessons(course)`, `ST.summary(course)`, `ST.nextLesson(course)`, `ST.lessonIndex(id, course)`
принимают id курса; без аргумента работают по всем урокам сразу (нужно админке и бэкапу).
Прогресс хранится общий (`oge_completed` по id урока), но **считается раздельно**: id курсов
не пересекаются, поэтому проценты курсов независимы.

### Уроки ОГЭ

`data/oge/oge-lessons.js` собирает уроки из сгенерированного плана `App.oge.COURSE`
(см. `docs/OGE-COURSE-TEMPLATE.md`) и кладёт в каждый урок поле `oge`:

```js
{ moduleId, exam, lessonN, mode, modeLabel, ball, engine,
  realRuns, realTimed, downloads, files, simLimit, check, goal, shortTrack }
```

`mode` — режим доставки: `sim` (симуляция в сайте), `download` (сначала скачать),
`real` (вживую в LibreOffice/Кумире/Python), `exam` (полный вариант на 150 минут).
Он же показывается бейджем в списке уроков, а теория урока генерируется из плана:
цель модуля, шаги, файлы к уроку, минимум живых прогонов, критерий закрытия.

### Проверки

`node tools/render-test.js` дополнительно проверяет: в курсе `base` ровно 300 элементов,
в курсе `oge` есть модули и режимы, курсы не пересекаются по id, урок ОГЭ рисуется
с планом и файлами, у прогресса ОГЭ свой счётчик, на главной две карточки курсов.

---

## 10. Откуда берётся контент: файлы или база

Ядро не знает, откуда пришли уроки: и файлы, и база наполняют один и тот же реестр
`App.LESSONS` через `App.registerModule(name, lessons, course)`. Переключатель — `config/api.js`.

| Режим | Условие | Что читает |
|---|---|---|
| `static` (по умолчанию) | `window.SITE_API === ""` | `data/lessons-bundle.js` (школьный курс) + `data/oge/oge-lessons-bundle.js` либо сборка из `course-plan.js` |
| `api` | `window.SITE_API = "http://host:3000"` | `scripts/core/api.js` → REST Payload: `/api/courses`, `/api/modules`, `/api/lessons` |

Правила режима «база» (коротко):

- `scripts/core/api.js` загружается последним (после `boot.js`), очищает `App._modules` и
  собирает реестр заново, затем вызывает `App.router.render()`.
- Если сервер недоступен — реестр не трогается, сайт продолжает работать на файлах,
  в консоль пишется предупреждение, `App.dataSource` остаётся `static`.
- `App.dataSourceNote` показывается в подвале сайдбара («Контент: …»).
- Номера уроков совпадают (`siteId`), поэтому прогресс в localStorage переносится между режимами.
- `data/oge/oge-lessons.js` не дублирует уроки: он выходит, если уроки курса `oge`
  уже зарегистрированы (базой или снимком `oge-lessons-bundle.js`).

Снимок для офлайна пишет `node tools/export-from-payload.js` (обратное направление —
`pnpm seed` в папке `server`). Админка контента в режиме «база» — админка Payload,
браузерная `#/admin` остаётся для ключа DeepSeek, лимитов и локальных правок.
