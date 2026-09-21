# -*- coding: utf-8 -*-
"""Извлекает текст из PDF-документов ФИПИ в .txt рядом."""
import sys, pathlib
import fitz  # PyMuPDF

def main(argv):
    for src in argv:
        p = pathlib.Path(src)
        if not p.exists():
            print("нет файла:", p)
            continue
        doc = fitz.open(p)
        parts = []
        for i, page in enumerate(doc, 1):
            parts.append("\n=== стр. %d ===\n" % i)
            parts.append(page.get_text("text"))
        out = p.with_suffix(".txt")
        out.write_text("".join(parts), encoding="utf-8")
        print("ok:", out.name, "| страниц:", doc.page_count, "| символов:", out.stat().st_size)

if __name__ == "__main__":
    main(sys.argv[1:])
