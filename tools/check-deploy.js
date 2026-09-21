/* tools/check-deploy.js — проверка готовности сайта к хостингу.
   Поднимает встроенный сервер на свободном порту и проверяет, что все файлы из index.html
   реально отдаются (200), а не отдают 404. Запуск: node tools/check-deploy.js */
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".mp3": "audio/mpeg",
  ".webmanifest": "application/manifest+json", ".txt": "text/plain; charset=utf-8"
};

const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split("?")[0]);
  if (url === "/" ) url = "/index.html";
  const file = path.join(root, url);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end("404"); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
});

const refs = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)]
  .map((m) => m[1])
  .filter((r) => !/^https?:/.test(r));

/* добавим то, что подгружается кодом */
refs.push("assets/audio/greet.mp3", "manifest.webmanifest");

server.listen(0, "127.0.0.1", async () => {
  const port = server.address().port;
  const base = "http://127.0.0.1:" + port + "/";
  let bad = 0;

  async function get(url) {
    const r = await fetch(base + url.replace(/^\//, ""));
    return r.status;
  }

  for (const rel of refs) {
    const status = await get(rel);
    const ok = status === 200;
    if (!ok) bad++;
    console.log((ok ? "  ок  " : "  404 ") + rel + " → " + status);
  }

  /* главная страница и один урок должны отдаваться, а бандл содержать уроки.
     Уроки считаем исполнением бандла, а не регуляркой: экспорт из базы (tools/export-from-payload.js)
     пишет JSON-стиль с кавычками, и текстовый шаблон его не находит. */
  const indexStatus = await get("index.html");
  const bundle = await (await fetch(base + "data/lessons-bundle.js")).text();
  let lessons = 0;
  try {
    const mods = [];
    new Function("App", "window", bundle + "\n//# sourceURL=lessons-bundle.js")(
      { registerModule: (n, l, course) => mods.push({ course: course || "base", lessons: l || [] }) },
      { addEventListener() {} }
    );
    lessons = mods
      .filter((m) => m.course === "base")
      .reduce((n, m) => n + m.lessons.length, 0);
  } catch (e) {
    console.log("  ✗ бандл не исполняется: " + e.message);
    bad++;
  }
  console.log("\nГлавная: " + indexStatus + ", уроков в бандле: " + lessons);
  if (lessons < 300) { bad++; console.log("  ✗ в бандле меньше 300 уроков"); }

  server.close();
  console.log(bad ? "\nПроблем: " + bad : "\nСайт готов к любому статическому хостингу: все файлы отдаются.");
  process.exit(bad ? 1 : 0);
});
