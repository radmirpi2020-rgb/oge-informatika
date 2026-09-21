/* route.ts — прокси к DeepSeek: ключ живёт только на сервере.

   Зачем: ключ в браузере (config/deepseek-key.local.js) может увести любой, кто нажмёт F12.
   Поэтому рабочий ключ переносится в DEEPSEEK_API_KEY на сервере, а сайт просит ответ здесь.

   Что проверяется на каждый запрос:
     1. ученик вошёл (JWT из коллекции students) — аноним не тратит деньги;
     2. дневной лимит токенов ученика из коллекции progress не исчерпан;
     3. запрос не длиннее разумного (защита от «расскажи весь учебник»).

   Ответ отдаётся потоком (text/event-stream), как раньше отдавал DeepSeek напрямую,
   поэтому страница рисует текст по мере поступления.

   Переменные окружения (server/.env):
     DEEPSEEK_API_KEY   — рабочий ключ, на клиент не попадает
     DEEPSEEK_API_URL   — необязательно, по умолчанию https://api.deepseek.com/chat/completions
     AI_DAILY_TOKENS    — дневной лимит на ученика, по умолчанию 250 000
     AI_MAX_PROMPT      — максимум символов в запросе, по умолчанию 12 000 */
import { getPayload } from 'payload'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

const DAILY_TOKENS = Number(process.env.AI_DAILY_TOKENS || 250_000)
const MAX_PROMPT = Number(process.env.AI_MAX_PROMPT || 12_000)

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export async function POST(request: Request) {
  const payload = await getPayload({ config })

  /* 1. вошедший ученик */
  const auth = await payload.auth({ headers: request.headers })
  const user = auth?.user as { id?: number | string; email?: string; plan?: string } | null
  if (!user?.id) {
    return reply({ error: 'Провожатый доступен только вошедшим. Войди в аккаунт на странице #/account.' }, 401)
  }

  /* 2. тариф ученика: провожатый входит только в «Максимум».
        Проверяет сервер, а не браузер, — иначе тариф легко обойти.
        Проверка идёт ДО проверки ключа, чтобы тариф работал даже без настроенного ключа.
        Пустое значение считается «Максимумом»: ученики, созданные до появления поля,
        доступ не теряют. */
  const studentDoc = (await payload.findByID({
    collection: 'students',
    id: user.id as number,
    depth: 0,
    overrideAccess: true,
  })) as { plan?: string } | null
  const studentPlan = studentDoc?.plan || 'max'
  if (studentPlan !== 'max') {
    return reply(
      {
        error:
          'В твоём тарифе нейронки нет. Провожатый входит в тариф «Максимум» за 990 ₽ в месяц — ' +
          'там 100 000 токенов в день. Уроки и практики доступны без него.',
        plan: studentPlan,
      },
      403,
    )
  }

  /* 3. ключ на сервере */
  const key = process.env.DEEPSEEK_API_KEY
  if (!key) {
    return reply({ error: 'Провожатый выключен: на сервере не задан DEEPSEEK_API_KEY.' }, 503)
  }

  /* 3. запрос разумного размера */
  let body: { messages?: { role: string; content: string }[]; max_tokens?: number; temperature?: number } = {}
  try {
    body = await request.json()
  } catch {
    return reply({ error: 'Некорректный запрос.' }, 400)
  }

  const messages = Array.isArray(body.messages) ? body.messages : []
  if (!messages.length) return reply({ error: 'Пустой запрос.' }, 400)

  const totalChars = messages.reduce((n, m) => n + String(m?.content || '').length, 0)
  if (totalChars > MAX_PROMPT) {
    return reply({ error: `Запрос слишком длинный: ${totalChars} символов, максимум ${MAX_PROMPT}.` }, 413)
  }

  /* 4. дневной лимит: считаем по документу прогресса ученика */
  const today = new Date().toISOString().slice(0, 10)
  const found = await payload.find({
    collection: 'progress',
    where: { student: { equals: user.id } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const doc = found.docs[0] as Record<string, unknown> | undefined
  const usage = ((doc?.aiUsage as Record<string, { tokens?: number }>) || {})[today] || {}
  const usedToday = Number(usage.tokens || 0)

  if (usedToday >= DAILY_TOKENS) {
    return reply(
      {
        error:
          'На сегодня лимит провожатого исчерпан: ' +
          usedToday.toLocaleString('ru-RU') +
          ' из ' +
          DAILY_TOKENS.toLocaleString('ru-RU') +
          ' токенов. Лимит обновится завтра.',
      },
      429,
    )
  }

  /* 5. запрос к DeepSeek — ключ подставляем только здесь */
  const upstream = await fetch(process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + key,
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      messages,
      temperature: body.temperature ?? 0.3,
      max_tokens: Math.min(Number(body.max_tokens || 1200), 4000),
      stream: true,
      stream_options: { include_usage: true },
    }),
  })

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => '')
    return reply(
      { error: 'DeepSeek ответил ошибкой ' + upstream.status + (text ? ': ' + text.slice(0, 300) : '') },
      upstream.status === 401 || upstream.status === 402 ? 502 : 502,
    )
  }

  /* Поток отдаём как есть, но по пути считаем расход и записываем его в прогресс.
     Поэтому ответ разбираем кусками: клиенту уходит всё, что пришло от DeepSeek. */
  const decoder = new TextDecoder()
  const self = payload
  let buffered = ''
  let completionTokens = 0
  let promptTokens = 0

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader()
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          controller.enqueue(value)

          /* разбор ради статистики: строки вида data: {...} */
          buffered += decoder.decode(value, { stream: true })
          const lines = buffered.split('\n')
          buffered = lines.pop() || ''
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data:')) continue
            const data = trimmed.slice(5).trim()
            if (!data || data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              if (parsed.usage) {
                completionTokens = parsed.usage.completion_tokens || completionTokens
                promptTokens = parsed.usage.prompt_tokens || promptTokens
              }
            } catch {
              /* неполный кусок — не страшно, статистика подождёт */
            }
          }
        }
      } catch {
        /* обрыв соединения: клиент увидит неполный ответ, счёт уже записан ниже */
      } finally {
        controller.close()
        const spent = (promptTokens || 0) + (completionTokens || 0)
        if (spent > 0) {
          try {
            const nextUsage = { ...((doc?.aiUsage as Record<string, unknown>) || {}) }
            nextUsage[today] = { tokens: usedToday + spent, calls: (Number(usage.calls) || 0) + 1 }
            if (doc?.id) {
              await self.update({
                collection: 'progress',
                id: doc.id as number,
                data: { aiUsage: nextUsage } as never,
                overrideAccess: true,
              })
            } else {
              await self.create({
                collection: 'progress',
                data: { student: user.id, aiUsage: nextUsage } as never,
                overrideAccess: true,
              })
            }
          } catch {
            /* учёт не должен ломать ответ ученику */
          }
        }
      }
    },
    cancel() {
      upstream.body?.cancel().catch(() => {})
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}

/** GET подсказывает, как проверить прокси из браузера и curl */
export async function GET() {
  return reply({
    endpoint: '/api/ai',
    method: 'POST',
    needs: 'JWT ученика в заголовке Authorization',
    body: { messages: [{ role: 'system', content: '...' }, { role: 'user', content: '...' }], max_tokens: 1200 },
    keyOnServer: Boolean(process.env.DEEPSEEK_API_KEY),
    dailyTokens: DAILY_TOKENS,
  })
}
