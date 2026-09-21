/** Общие списки значений: используются и в коллекциях, и в импорте, чтобы не расходились. */

export const MODE_OPTIONS = [
  { label: 'Симуляция в сайте', value: 'sim' },
  { label: 'Сначала скачать файл', value: 'download' },
  { label: 'Вживую в настоящей программе', value: 'real' },
  { label: 'Полный вариант на 150 минут', value: 'exam' },
]

export const ENGINE_OPTIONS = [
  { label: 'sandbox — ввод ответа с разбором', value: 'sandbox' },
  { label: 'code — редактор Python', value: 'code' },
  { label: 'robot — исполнитель Робот', value: 'robot' },
  { label: 'sql — запросы к таблице', value: 'sql' },
  { label: 'table — таблицы и формулы', value: 'table' },
  { label: 'graph — графы и маршруты', value: 'graph' },
]

export const KIND_OPTIONS = [
  { label: 'Урок', value: 'lesson' },
  { label: 'Практика', value: 'practice' },
  { label: 'Симуляция на время', value: 'exam' },
]

export const STATUS_OPTIONS = [
  { label: 'Каркас', value: 'каркас' },
  { label: 'Черновик', value: 'черновик' },
  { label: 'Готов', value: 'готов' },
]
