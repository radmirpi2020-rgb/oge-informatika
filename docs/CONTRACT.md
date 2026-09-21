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
    id: 1,                        // уникальный, сквозная нумерация 1..300
    module: "Системы счисления",  // короткое имя модуля
    title: "Введение: зачем нужны системы счисления",
    sub: "Позиции, основания, цифры",
    kind: "lesson",               // "lesson" | "practice"
    minutes: 8,                   // оценка времени
    theory: "…",                  // markdown-подобный текст (см. §5)
    tasks: [ /* 5 задач */ ]
  }
]);
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
