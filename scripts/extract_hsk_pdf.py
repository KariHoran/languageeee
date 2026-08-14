#!/usr/bin/env python3
"""
Извлечение словаря HSK 3.0 из PDF в JSON.

Использование:
    pip install -r scripts/requirements.txt
    python scripts/extract_hsk_pdf.py

Ожидает файл HSK.pdf в корне проекта.
Результат сохраняется в hsk3_words.json.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pdfplumber

# Пути относительно корня проекта
ROOT_DIR = Path(__file__).resolve().parent.parent
PDF_PATH = ROOT_DIR / "HSK.pdf"
OUTPUT_PATH = ROOT_DIR / "hsk3_words.json"

# Границы колонок по координате x (определены по разметке PDF)
COL_SEQ = (150, 320)      # 序号
COL_LEVEL = (320, 470)    # 等级
COL_HANZI = (470, 700)    # 词语
COL_PINYIN = (700, 1050)  # 拼音

# Максимальное расстояние по вертикали для объединения строки (иероглиф + пиньинь)
ROW_CLUSTER_TOLERANCE = 18

# Минимальная позиция по Y — ниже заголовка таблицы
MIN_TOP = 220

PINYIN_RE = re.compile(r"^[a-zA-ZāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüÜńňǹ\s·\-']+$")
HANZI_RE = re.compile(r"[\u4e00-\u9fff]")
WATERMARK_RE = re.compile(r"^[际国考汉]+|[际国考汉]+$")


def clean_hanzi(text: str) -> str:
    """Убирает водяной знак и номера омонимов (会1 → 会, 本（1） → 本)."""
    cleaned = WATERMARK_RE.sub("", text.strip())
    cleaned = re.sub(r"[（(]\d+[）)]$", "", cleaned)
    cleaned = re.sub(r"[0-9０-９]+$", "", cleaned)
    return cleaned.strip()



def column_for_x(x: float) -> str | None:
    """Определяет колонку по горизонтальной координате слова."""
    if COL_SEQ[0] <= x < COL_SEQ[1]:
        return "seq"
    if COL_LEVEL[0] <= x < COL_LEVEL[1]:
        return "level"
    if COL_HANZI[0] <= x < COL_HANZI[1]:
        return "hanzi"
    if COL_PINYIN[0] <= x < COL_PINYIN[1]:
        return "pinyin"
    return None


def parse_level(raw: str) -> int | str | None:
    """
    Нормализует значение колонки 等级.
    Примеры: '1' -> 1, '1（4）' -> 1, '7-9' -> '7-9', '国1' -> 1 (водяной знак).
    """
    cleaned = re.sub(r"^国", "", raw.strip())

    match = re.match(r"^(\d+)\s*[（(]\d+[）)]", cleaned)
    if match:
        return int(match.group(1))

    match = re.match(r"^(\d+)-(\d+)$", cleaned)
    if match:
        return f"{match.group(1)}-{match.group(2)}"

    match = re.match(r"^(\d+)$", cleaned)
    if match:
        return int(match.group(1))

    return None


def is_valid_row(row: dict[str, str]) -> bool:
    """Проверяет, что строка похожа на запись словаря."""
    if not re.fullmatch(r"\d+", row["seq"]):
        return False
    if not row["hanzi"] or not row["pinyin"]:
        return False
    if not HANZI_RE.search(row["hanzi"]):
        return False
    if not PINYIN_RE.match(row["pinyin"].strip()):
        return False
    if parse_level(row["level"]) is None:
        return False
    return True


def parse_page(page: pdfplumber.page.Page) -> list[dict[str, str]]:
    """Извлекает сырые строки таблицы с одной страницы PDF."""
    words = [
        w
        for w in page.extract_words()
        if w["top"] > MIN_TOP and column_for_x(w["x0"])
    ]
    words.sort(key=lambda w: (w["top"], w["x0"]))

    clusters: list[dict] = []
    for word in words:
        col = column_for_x(word["x0"])
        if not col:
            continue

        if not clusters or word["top"] - clusters[-1]["top"] > ROW_CLUSTER_TOLERANCE:
            clusters.append({"top": word["top"], "cells": {"seq": "", "level": "", "hanzi": "", "pinyin": ""}})

        clusters[-1]["cells"][col] += word["text"]

    return [cluster["cells"] for cluster in clusters]


def extract_words_from_pdf(pdf_path: Path) -> list[dict]:
    """Читает весь PDF и возвращает список слов."""
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF не найден: {pdf_path}")

    entries: list[dict] = []
    seen: set[tuple[str, str]] = set()

    with pdfplumber.open(pdf_path) as pdf:
        for page_index, page in enumerate(pdf.pages, start=1):
            for row in parse_page(page):
                if not is_valid_row(row):
                    continue

                hanzi = clean_hanzi(row["hanzi"])
                pinyin = row["pinyin"].strip()
                level = parse_level(row["level"])

                if not hanzi:
                    continue

                key = (hanzi, pinyin)
                if key in seen:
                    continue
                seen.add(key)

                entries.append(
                    {
                        "词语": hanzi,
                        "等级": level,
                        "拼音": pinyin,
                    }
                )

            print(f"Страница {page_index}/{len(pdf.pages)} — всего слов: {len(entries)}", file=sys.stderr)

    return entries


def main() -> None:
    try:
        words = extract_words_from_pdf(PDF_PATH)
    except FileNotFoundError as exc:
        print(f"Ошибка: {exc}", file=sys.stderr)
        sys.exit(1)
    except Exception as exc:
        print(f"Не удалось обработать PDF: {exc}", file=sys.stderr)
        sys.exit(1)

    if not words:
        print("Не найдено ни одного слова. Проверьте структуру PDF.", file=sys.stderr)
        sys.exit(1)

    OUTPUT_PATH.write_text(
        json.dumps(words, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"Готово: извлечено {len(words)} слов -> {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
