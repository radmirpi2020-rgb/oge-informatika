# Медиа и локальная генерация

Все картинки и озвучка считаются локально (FLUX + TTS через ComfyUI) и лежат в
`assets/images` и `assets/audio`. Ничего не уходит в облако.

Состояние на сегодня:

- **озвучка готова**: `assets/audio/greet.mp3` (синтез локальным TTS, 52 секунды счёта);
- **картинки — схемы-заглушки** в палитре сайта: `assets/images/*.png`, нарисованы
  скриптом `tools/make-placeholders.js` без интернета и без GPU;
- сайт сам выбирает формат: если рядом лежит настоящий рендер `hero.jpg`, он покажет
  `hero.jpg`, а не `hero.png` (см. `App.media.path` в `scripts/core/assets.js`).

То есть достаточно положить настоящие рендеры в `assets/images` под теми же именами
в формате `.jpg` — и они перекроют заглушки без правки кода.

## Что где используется

| Файл | Где показывается |
|---|---|
| `assets/images/hero.jpg` | главная страница, кадр под заголовком |
| `assets/images/numbers.jpg` | уроки модуля «Системы счисления» |
| `assets/images/logic.jpg` | уроки модуля «Логика» |
| `assets/images/robot.jpg` | уроки модуля «Алгоритмы и исполнители» |
| `assets/images/files.jpg` | уроки модуля «Файловая система» |
| `assets/images/data.jpg` | модули «Электронные таблицы» и «Базы данных» |
| `assets/images/mentor.jpg` | боковая колонка страницы провожатого |
| `assets/images/exam.jpg` | финальные уроки и симуляция ОГЭ |
| `assets/audio/greet.mp3` | кнопка «Послушать провожатого» (главная, провожатый, медиа) |

Соответствие «файл → где показывать» задаётся в `scripts/core/assets.js`.
Хочешь свою картинку для конкретного урока — допиши ей поле `lesson: 42`.

## Как поменять картинку

1. Положи новый файл с тем же именем в `assets/images/` (или своё имя — тогда поправь `assets.js`).
2. Обнови страницу. Всё.

Если файла нет, картинка просто не показывается: страница не ломается (у `<img>` стоит
`onerror`, а у самой фигуры класс `.missing`).

## Как сгенерировать заново

Генерация идёт через локальный сервер (ComfyUI + API на `127.0.0.1:8777`).

```bash
# 1. поднять движок картинок (в WSL)
docker start comfyui
# ждать, пока откроется порт: curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8188/system_stats
# должно быть 200

# 2. прогреть модели (один раз после запуска — дальше картинки в разы быстрее)
#    задача warmup через API

# 3. нарисовать кадры (задача photos, mode=lines, по одному промпту на строку)
#    промпты — на английском, описывай свет, ракурс, стиль; текст на картинке не появится
```

Промпты для этих восьми кадров (можно переиспользовать):

```
hero:    warm minimal flat illustration, a teenage student studying at a desk with a laptop, soft morning light through a window, orange accents, clean geometric shapes, wide composition with empty space on the right, no text
numbers: flat vector illustration about binary numbers, glowing zero and one digits floating in ordered rows, deep dark background with orange and white glyphs, abstract geometric grid, wide banner, no text
logic:   flat vector illustration about logic circuits, interconnected logic gates and glowing paths on a blueprint grid, orange and dark grey palette, isometric view, wide banner, no text
robot:   flat vector illustration of a maze seen from above, a small orange robot square navigating winding corridors toward a flag, dark grey background with thin white lines, wide banner, no text
mentor:  flat vector illustration of a friendly abstract mentor figure built from simple geometric shapes, holding a glowing light, standing beside a path of stepping stones, warm orange and cream palette, wide banner, no text
exam:    flat vector illustration of a calm empty exam classroom with rows of desks, bright daylight, minimalist style, orange chair accents, wide banner, no text
data:    flat vector illustration about spreadsheets and databases, abstract grid of cells with glowing highlights and connected network nodes, dark background with orange accents, isometric, wide banner, no text
files:   flat vector illustration of a file system tree, folder shapes connected by thin lines with small document icons, cream background with orange highlights, wide banner, no text
```

## Озвучка

`assets/audio/greet.mp3` — короткое приветствие провожатого. Задача `voice` в API:

```
"Привет! Я Провожатый. Разберу тему коротко и по делу: покажу, как решать быстрее,
и подскажу, где чаще всего теряют баллы. Спрашивай — отвечу по делу."
```

Манера речи — «Speak in a warm and friendly tone», скорость 1.0.
Хочешь свой голос: положи образец голоса и укажи его в параметре `voice`.

## Если генерация недоступна

Сайт работает и без файлов: кадры не показываются, а на `#/media` видно, каких файлов не хватает.
Порядок восстановления:

1. `docker start comfyui` в WSL, дождаться `200` на `/system_stats`.
2. Задача `warmup` — один раз.
3. Задача `photos` с промптами выше, забрать файлы в `assets/images`.
4. Задача `voice` с текстом выше, забрать файл в `assets/audio/greet.mp3`.
