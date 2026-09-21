/* tools/make-placeholders.js — рисует кадры для сайта прямо здесь, без интернета и без ComfyUI.
   Это аккуратные схемы в палитре сайта (кремовый фон, оранжевый акцент), а не фотографии:
   нужны, чтобы сайт был целым, пока идёт настоящая генерация. Настоящие рендеры просто
   заменяют эти файлы с теми же именами.

   Запуск: node tools/make-placeholders.js [--force]   (--force перезаписывает существующие) */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const root = path.join(__dirname, "..");
const outDir = path.join(root, "assets", "images");
const force = process.argv.includes("--force");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

/* ---------- минимальный PNG-энкодер (без зависимостей) ---------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

class Canvas {
  constructor(w, h, bg) {
    this.w = w; this.h = h;
    this.px = Buffer.alloc(w * h * 3);
    this.fill(bg);
  }
  fill(rgb) {
    for (let i = 0; i < this.w * this.h; i++) {
      this.px[i * 3] = rgb[0]; this.px[i * 3 + 1] = rgb[1]; this.px[i * 3 + 2] = rgb[2];
    }
  }
  set(x, y, rgb, alpha = 1) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    for (let k = 0; k < 3; k++) {
      this.px[i + k] = Math.round(this.px[i + k] * (1 - alpha) + rgb[k] * alpha);
    }
  }
  rect(x, y, w, h, rgb, alpha = 1) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, rgb, alpha);
  }
  stroke(x, y, w, h, rgb, thick = 2) {
    this.rect(x, y, w, thick, rgb);
    this.rect(x, y + h - thick, w, thick, rgb);
    this.rect(x, y, thick, h, rgb);
    this.rect(x + w - thick, y, thick, h, rgb);
  }
  circle(cx, cy, r, rgb, alpha = 1) {
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y <= r * r) this.set(cx + x, cy + y, rgb, alpha);
      }
    }
  }
  ring(cx, cy, r, thick, rgb, alpha = 1) {
    for (let y = -r - thick; y <= r + thick; y++) {
      for (let x = -r - thick; x <= r + thick; x++) {
        const d = Math.sqrt(x * x + y * y);
        if (d <= r + thick && d >= r) this.set(cx + x, cy + y, rgb, alpha);
      }
    }
  }
  line(x0, y0, x1, y1, rgb, thick = 2) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= steps; i++) {
      const x = x0 + (x1 - x0) * i / steps;
      const y = y0 + (y1 - y0) * i / steps;
      this.rect(Math.round(x) - thick / 2, Math.round(y) - thick / 2, thick, thick, rgb);
    }
  }
  save(file) {
    const raw = Buffer.alloc((this.w * 3 + 1) * this.h);
    for (let y = 0; y < this.h; y++) {
      raw[y * (this.w * 3 + 1)] = 0;                       // фильтр 0
      this.px.copy(raw, y * (this.w * 3 + 1) + 1, y * this.w * 3, (y + 1) * this.w * 3);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.w, 0);
    ihdr.writeUInt32BE(this.h, 4);
    ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
      chunk("IEND", Buffer.alloc(0))
    ]);
    fs.writeFileSync(file, png);
  }
}

/* ---------- палитра сайта ---------- */
const CREAM = [246, 245, 241];
const DARK = [17, 17, 17];
const GRID = [216, 213, 205];
const ORANGE = [255, 77, 0];
const WHITE = [255, 255, 255];

const W = 1280, H = 720;

/* ---------- кадры ---------- */
const frames = {
  /* главная: стол, ноутбук, лампа, восходящие шаги прогресса */
  "hero": (c) => {
    c.rect(0, 520, W, 200, [232, 229, 220]);                       // стол
    c.rect(200, 330, 420, 200, WHITE);                             // ноутбук
    c.stroke(200, 330, 420, 200, DARK, 4);
    c.rect(230, 360, 360, 140, CREAM);
    c.rect(230, 360, 120, 140, ORANGE, 0.15);
    c.rect(620, 520, 60, 20, DARK);                                // подставка
    for (let i = 0; i < 5; i++) {                                  // шаги прогресса
      c.rect(760 + i * 70, 500 - i * 45, 55, 45 + i * 45, i === 4 ? ORANGE : GRID);
    }
    c.circle(1050, 200, 60, ORANGE, 0.18);                         // «мысль»
    c.ring(1050, 200, 60, 4, ORANGE);
    c.rect(320, 120, 90, 12, DARK);                                // строки-заголовок
    c.rect(320, 150, 180, 10, GRID);
  },

  /* модуль 1: двоичные разряды */
  "numbers": (c) => {
    const bits = ["1", "0", "1", "1", "0", "1", "0", "0"];
    for (let i = 0; i < bits.length; i++) {
      const x = 140 + i * 130, y = 300;
      c.rect(x, y, 90, 120, bits[i] === "1" ? ORANGE : GRID);
      // «цифра» рисуется прямоугольниками: 1 — столбик, 0 — рамка
      if (bits[i] === "1") c.rect(x + 38, y + 25, 14, 70, WHITE);
      else c.stroke(x + 25, y + 25, 40, 70, WHITE, 12);
      c.rect(x, y + 140, 90, 8, DARK, 0.15);
    }
    for (let i = 0; i < 8; i++) c.rect(140 + i * 130 + 40, 200, 6, 80, DARK, 0.25);
  },

  /* модуль 2: логические элементы */
  "logic": (c) => {
    for (let x = 0; x < W; x += 40) c.rect(x, 0, 1, H, GRID, 0.7);
    for (let y = 0; y < H; y += 40) c.rect(0, y, W, 1, GRID, 0.7);
    const gates = [[260, 260], [640, 200], [640, 400], [980, 300]];
    gates.forEach(([x, y], i) => {
      c.rect(x, y, 150, 110, i === 3 ? ORANGE : WHITE);
      c.stroke(x, y, 150, 110, DARK, 4);
      c.rect(x + 30, y + 40, 90, 30, DARK, 0.2);
    });
    c.line(150, 315, 260, 315, DARK, 4);
    c.line(410, 315, 640, 255, DARK, 4);
    c.line(410, 315, 640, 455, DARK, 4);
    c.line(790, 255, 980, 355, DARK, 4);
    c.line(790, 455, 980, 355, DARK, 4);
  },

  /* модуль 3: лабиринт и робот */
  "robot": (c) => {
    c.fill(DARK);
    const cell = 80, ox = 120, oy = 120;
    for (let i = 0; i <= 10; i++) {
      c.rect(ox + i * cell, oy, 1, cell * 6, [70, 70, 70]);
      c.rect(ox, oy + i * cell, cell * 10, 1, [70, 70, 70]);
    }
    // стены
    const walls = [[3, 0], [3, 1], [3, 2], [6, 2], [6, 3], [6, 4], [2, 5], [7, 1]];
    walls.forEach(([x, y]) => c.rect(ox + x * cell + 2, oy + y * cell + 2, cell - 4, cell - 4, [235, 235, 235]));
    // путь
    const trail = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [2, 3], [3, 3], [4, 3], [5, 3], [5, 4], [5, 5], [6, 5], [7, 5], [8, 5]];
    for (let i = 0; i < trail.length - 1; i++) {
      const [x0, y0] = trail[i], [x1, y1] = trail[i + 1];
      c.line(ox + x0 * cell + cell / 2, oy + y0 * cell + cell / 2,
             ox + x1 * cell + cell / 2, oy + y1 * cell + cell / 2, ORANGE, 8);
    }
    const [rx, ry] = trail[0];
    c.rect(ox + rx * cell + 14, oy + ry * cell + 14, cell - 28, cell - 28, ORANGE);
    const [gx, gy] = trail[trail.length - 1];
    c.line(ox + gx * cell + 20, oy + gy * cell + 60, ox + gx * cell + 20, oy + gy * cell + 16, WHITE, 5);
    c.rect(ox + gx * cell + 22, oy + gy * cell + 16, 40, 26, ORANGE);
  },

  /* провожатый: фигура-наставник и дорожка шагов */
  "mentor": (c) => {
    c.circle(340, 250, 90, ORANGE, 0.16);
    c.ring(340, 250, 90, 5, ORANGE);
    c.rect(300, 300, 80, 150, DARK);                     // тело
    c.circle(340, 240, 55, DARK);                        // голова
    c.rect(190, 350, 90, 18, DARK, 0.5);                 // рука/указка
    c.circle(150, 360, 18, ORANGE);                      // огонёк в руке
    for (let i = 0; i < 5; i++) {                        // ступени пути
      c.rect(560 + i * 130, 520 - i * 60, 110, 22, i === 4 ? ORANGE : GRID);
    }
    c.rect(880, 180, 220, 12, GRID);
    c.rect(880, 210, 140, 12, GRID, 0.7);
  },

  /* финал: класс перед экзаменом */
  "exam": (c) => {
    c.rect(0, 480, W, 240, [232, 229, 220]);
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 5; i++) {
        const x = 110 + i * 220, y = 300 + row * 70;
        c.rect(x, y, 150, 12, DARK, 0.75);               // столешница
        c.rect(x + 10, y + 12, 10, 60, GRID);
        c.rect(x + 130, y + 12, 10, 60, GRID);
        if (row === 2) c.rect(x + 55, y + 12, 40, 20, ORANGE, 0.85);  // стул
      }
    }
    c.rect(0, 0, W, 140, WHITE);
    c.rect(0, 140, W, 6, GRID);
    for (let i = 0; i < 4; i++) c.rect(200 + i * 260, 40, 180, 60, CREAM);   // доска/окна
  },

  /* таблицы и базы данных */
  "data": (c) => {
    c.fill(DARK);
    const cell = 70, ox = 300, oy = 200;
    for (let r = 0; r < 4; r++) {
      for (let col = 0; col < 6; col++) {
        const hot = (r === 1 && col === 2) || (r === 3 && col === 4);
        c.rect(ox + col * cell, oy + r * cell, cell - 4, cell - 4, hot ? ORANGE : [40, 40, 40]);
      }
    }
    // узлы графа справа
    const nodes = [[1010, 220], [1130, 330], [980, 430], [1140, 520]];
    nodes.forEach(([x, y], i) => {
      c.circle(x, y, 26, i === 0 ? ORANGE : [70, 70, 70]);
    });
    c.line(1010, 220, 1130, 330, [120, 120, 120], 4);
    c.line(1010, 220, 980, 430, [120, 120, 120], 4);
    c.line(1130, 330, 1140, 520, [120, 120, 120], 4);
    c.line(980, 430, 1140, 520, [120, 120, 120], 4);
  },

  /* файловая система */
  "files": (c) => {
    const folder = (x, y, w, h, fill) => {
      c.rect(x, y, w, h, fill);
      c.rect(x, y - 14, w * 0.45, 16, fill);
      c.stroke(x, y - 14, w, h + 14, DARK, 3);
    };
    folder(120, 180, 240, 150, WHITE);
    folder(420, 380, 200, 130, WHITE);
    folder(680, 380, 200, 130, WHITE);
    folder(420, 180, 200, 130, ORANGE, 0.25);
    c.line(240, 330, 340, 445, DARK, 4);
    c.line(620, 445, 680, 445, DARK, 4);
    c.line(420, 240, 360, 240, DARK, 4);
    // файлики
    const doc = (x, y) => { c.rect(x, y, 46, 60, WHITE); c.stroke(x, y, 46, 60, DARK, 3); c.rect(x + 8, y + 12, 30, 5, GRID); };
    doc(160, 240); doc(230, 240); doc(300, 240);
    doc(460, 420); doc(540, 420);
    doc(720, 420); doc(800, 420);
  }
};

/* ---------- рисование ---------- */
let made = 0, skipped = 0;
Object.keys(frames).forEach((name) => {
  const file = path.join(outDir, name + ".jpg".replace(".jpg", ".png"));
  if (fs.existsSync(file) && !force) { skipped++; return; }
  const c = new Canvas(W, H, name === "robot" || name === "data" ? DARK : CREAM);
  frames[name](c);
  c.save(file);
  made++;
  console.log("  нарисован " + path.basename(file));
});

console.log("\nГотово: нарисовано " + made + ", пропущено (уже есть) " + skipped + ".");
console.log("Папка: assets/images. Настоящие рендеры можно положить поверх — с теми же именами,");
console.log("только в формате .jpg: положи файл hero.jpg рядом, и он перекроет hero.png.");
