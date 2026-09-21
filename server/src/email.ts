import { nodemailerAdapter } from '@payloadcms/email-nodemailer'

/** Настройки писем: подтверждение почты, сброс пароля, приглашения в админку.

   Пока SMTP не настроен, Payload пишет письма в консоль сервера — этого достаточно,
   чтобы пройти регистрацию и сброс пароля при разработке.

   Как подключить настоящую почту — в server/README.md, раздел «Почта».
   Коротко: заполнить в .env SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM. */
export function buildEmailAdapter() {
  const host = process.env.SMTP_HOST
  if (!host) return undefined

  const port = Number(process.env.SMTP_PORT || 465)
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465

  return nodemailerAdapter({
    defaultFromAddress: process.env.MAIL_FROM || 'no-reply@localhost',
    defaultFromName: process.env.MAIL_FROM_NAME || 'Информатика и ОГЭ',
    transportOptions: {
      host,
      port,
      secure,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
        : undefined,
    },
  })
}
