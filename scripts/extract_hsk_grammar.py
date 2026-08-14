# -*- coding: utf-8 -*-
"""
Извлечение грамматических конструкций из раздела «语法大纲» HSK.pdf.
Результат: src/data/hsk_grammar.json

Каждая запись:
  {
    "hanzi": "虽然…但是",   # схема для отображения
    "structure": "虽然…但是",
    "parts": ["虽然", "但是"],  # токены по порядку (альтернативы через /)
    "level": 2,
    "type": "grammar",
    "category": "ellipsis" | "fixed"
  }
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
PDF_PATH = ROOT / "HSK.pdf"
OUT_PATH = ROOT / "src" / "data" / "hsk_grammar.json"

GRAMMAR_PAGE_RANGES = [
    (1, range(296, 299)),
    (2, range(299, 302)),
    (3, range(302, 305)),
    (4, range(305, 308)),
    (5, range(308, 311)),
    (6, range(311, 313)),
    (7, range(313, 317)),
]

WATERMARK = re.compile(r"[际国考汉]")
ELLIPSIS_SPLIT = re.compile(r"(?:……|\.\.\.|⋯{1,2}|…{1,2})")

# Описание / метаданные — не конструкции
NOISE = re.compile(
    r"(主语|谓语|宾语|定语|状语|补语|动词性|名词性|形容词性|"
    r"表示|作主语|作谓语|作宾语|作定语|作状语|表使令|表称谓|"
    r"主谓句|非主谓句|陈述句|疑问句|祈使句|感叹句|反问句|"
    r"基本结构|其他结构|功能类型|词类|语素|句子成分|特殊句型|"
    r"特殊表达|数的表达|数的表示|时间表示|钱数|序数|概数|"
    r"完成态|变化态|进行态|持续态|经历态|"
    r"专用名量词|借用名量词|类别名称|语法内容|细目|"
    r"用反问|用动态|强调|前后动作|前一动作|后一动作|"
    r"所处|处所词|数量短语|名词性短语|动词短语|"
    r"^\d+\)|^（\d+）|^$$\d+$$)"
)

HAS_HANZI = re.compile(r"[\u4e00-\u9fff]")

# Цельные маркеры без троеточия (часто в «固定短语»)
FIXED_MARKERS = [
    "越来越",
    "不一会儿",
    "一般来说",
    "一点儿也不",
    "来得及",
    "来不及",
    "有的是",
    "说不定",
    "不管怎样说",
    "动不动就",
    "总而言之",
    "总的来说",
    "综上所述",
    "换句话说",
    "归根到底",
    "无论如何",
    "这样一来",
    "怪不得",
    "恨不得",
    "巴不得",
]


def clean_page(raw: str) -> str:
    t = WATERMARK.sub("", raw)
    t = t.replace("\n", " ")
    t = re.sub(r"\s+", " ", t)
    return t.strip()


def normalize_ellipsis(s: str) -> str:
    return ELLIPSIS_SPLIT.sub("…", s)


def strip_noise_prefix(s: str) -> str:
    """Убирает префиксы вроде «(1)」「用…表示：」."""
    s = s.strip()
    s = re.sub(r"^[\d\.\)）\s]+", "", s)
    s = re.sub(r"^（\d+）", "", s)
    s = re.sub(r"^\[\d+\]", "", s)
    # отрезать пояснение до двоеточия, если после него есть конструкция
    if "：" in s:
        left, right = s.split("：", 1)
        if "…" in right or HAS_HANZI.search(right):
            s = right
    return s.strip("，,。；;、:： ")


def clean_part(p: str) -> str | None:
    p = p.strip()
    p = p.strip("，,、；; ")
    # скобки опциональности оставляем как есть — матчер разберёт
    # убрать ведущие/хвостовые плюсы формул
    p = p.strip("+")
    if not p:
        return None
    if re.fullmatch(r"[XYAB\d]+", p):
        return None
    if not HAS_HANZI.search(p):
        return None
    # куски формул вроде «宾语1+动词»
    if "+" in p and not p.startswith("（") and "/" not in p:
        # оставить только если это что-то вроде «不/没»
        if re.search(r"[动词名词形容词补语宾语主语状语]", p):
            return None
    if NOISE.search(p) and "…" not in p:
        # часть сама по себе — описание
        if len(p) > 6 and "/" not in p:
            return None
    return p


def expand_slash_kept(part: str) -> str:
    """Нормализует альтернативы: '也/都' остаётся; убирает мусор вокруг."""
    return part.strip()


def split_parts(structure: str) -> list[str]:
    raw_parts = structure.split("…")
    parts: list[str] = []
    for p in raw_parts:
        cleaned = clean_part(p)
        if cleaned:
            parts.append(expand_slash_kept(cleaned))
    return parts


def is_useful(structure: str, parts: list[str]) -> bool:
    if not parts:
        return False
    if NOISE.search(structure):
        # допускаем, если это короткое «不是…吗» и т.п.
        if len("".join(parts)) < 2:
            return False
        # если структура целиком похожа на описание — отбрасываем
        if re.search(r"(主语|谓语|宾语|表使令|用反问|强调说话)", structure):
            return False
    joined = "".join(re.sub(r"[/（）()]", "", p) for p in parts)
    if len(joined) < 1:
        return False
    if len(parts) == 1 and len(parts[0]) == 1:
        return False
    if len(parts) == 1 and parts[0] in {
        "的", "了", "着", "过", "吗", "呢", "吧", "啊", "和", "与", "把", "被"
    }:
        # одиночные 把/被 полезны, но слишком шумные — добавим отдельно ниже
        if parts[0] not in {"把", "被"}:
            return False
    return True


def extract_ellipsis_patterns(text: str, level: int) -> list[dict]:
    found: list[dict] = []
    # Ищем фрагменты с троеточием
    for m in re.finditer(
        r"[\u4e00-\u9fff（）()/A-Za-z0-9+\-·，,、：:？X]{0,24}"
        r"(?:……|\.\.\.|…{1,2}|⋯{1,2})"
        r"(?:[\u4e00-\u9fff（）()/A-Za-z0-9+\-·，,、：:？X]|……|\.\.\.|…{1,2}|⋯{1,2}){0,48}",
        text,
    ):
        raw = strip_noise_prefix(normalize_ellipsis(m.group(0)))
        raw = re.sub(r"\s+", "", raw)
        if "…" not in raw:
            continue
        parts = split_parts(raw)
        if not is_useful(raw, parts):
            continue
        # отображаемая схема без ведущих «…»
        display = raw.strip("…")
        if not display:
            continue
        found.append(
            {
                "hanzi": display,
                "structure": display,
                "parts": parts,
                "level": level,
                "type": "grammar",
                "category": "ellipsis",
                "词语": display,
                "等级": level,
            }
        )
    return found


def extract_fixed(text: str, level: int) -> list[dict]:
    found: list[dict] = []
    for hit in FIXED_MARKERS:
        if hit in text:
            found.append(
                {
                    "hanzi": hit,
                    "structure": hit,
                    "parts": [hit],
                    "level": level,
                    "type": "grammar",
                    "category": "fixed",
                    "词语": hit,
                    "等级": level,
                }
            )
    return found


# Ручной минимум известных конструкций (на случай сбоев OCR), с правильным уровнем
CURATED = [
    ("一边…一边", ["一边", "一边"], 3),
    ("又…又…", ["又", "又"], 3),
    ("越…越…", ["越", "越"], 3),
    ("越来越", ["越来越"], 3),
    ("不但…而且", ["不但", "而且"], 3),
    ("不仅…而且", ["不仅", "而且"], 4),
    ("虽然…但是", ["虽然", "但是"], 2),
    ("虽然…可是", ["虽然", "可是"], 3),
    ("因为…所以", ["因为", "所以"], 2),
    ("如果…就", ["如果", "就"], 3),
    ("只要…就", ["只要", "就"], 3),
    ("只有…才", ["只有", "才"], 3),
    ("一…就", ["一", "就"], 2),
    ("是…的", ["是", "的"], 2),
    ("连…都", ["连", "都"], 4),
    ("连…也", ["连", "也"], 4),
    ("或者…或者", ["或者", "或者"], 3),
    ("一会儿…一会儿", ["一会儿", "一会儿"], 3),
    ("先…再", ["先", "再"], 3),
    ("先…然后", ["先", "然后"], 3),
    ("为了…", ["为了"], 3),
    ("要是…就", ["要是", "就"], 4),
    ("即使…也", ["即使", "也"], 4),
    ("就是…也", ["就是", "也"], 4),
    ("不管…都", ["不管", "都"], 4),
    ("无论…都", ["无论", "都"], 4),
    ("既然…就", ["既然", "就"], 4),
    ("不是…而是", ["不是", "而是"], 4),
    ("不是…就是", ["不是", "就是"], 4),
    ("既…又", ["既", "又"], 4),
    ("一方面…另一方面", ["一方面", "另一方面"], 4),
    ("尽管…但是", ["尽管", "但是"], 4),
    ("一旦…就", ["一旦", "就"], 5),
    ("哪怕…也", ["哪怕", "也"], 5),
    ("假如…就", ["假如", "就"], 5),
    ("没有…就没有", ["没有", "就没有"], 5),
    ("再…也", ["再", "也"], 5),
    ("不…不", ["不", "不"], 5),
    ("要么…要么", ["要么", "要么"], 6),
    ("凡是…都", ["凡是", "都"], 6),
    ("除非…才", ["除非", "才"], 6),
    ("就算…也", ["就算", "也"], 6),
    ("与其…不如", ["与其", "不如"], 7),
    ("宁可…也不", ["宁可", "也不"], 7),
    ("一来…二来", ["一来", "二来"], 7),
]


def dedupe(entries: list[dict]) -> list[dict]:
    best: dict[str, dict] = {}
    for e in entries:
        key = e["structure"]
        prev = best.get(key)
        if prev is None or e["level"] < prev["level"]:
            best[key] = e
        elif prev is not None and e["level"] == prev["level"]:
            # предпочитаем больше частей
            if len(e["parts"]) > len(prev["parts"]):
                best[key] = e
    result = list(best.values())
    result.sort(
        key=lambda x: (
            -len(x["parts"]),
            -sum(len(p) for p in x["parts"]),
            x["level"],
            x["structure"],
        )
    )
    return result


def main() -> None:
    if not PDF_PATH.exists():
        raise SystemExit(f"PDF not found: {PDF_PATH}")

    all_entries: list[dict] = []
    with pdfplumber.open(PDF_PATH) as pdf:
        for level, pages in GRAMMAR_PAGE_RANGES:
            for idx in pages:
                if idx >= len(pdf.pages):
                    continue
                text = clean_page(pdf.pages[idx].extract_text() or "")
                all_entries.extend(extract_ellipsis_patterns(text, level))
                all_entries.extend(extract_fixed(text, level))

    for structure, parts, level in CURATED:
        all_entries.append(
            {
                "hanzi": structure,
                "structure": structure,
                "parts": parts,
                "level": level,
                "type": "grammar",
                "category": "ellipsis" if "…" in structure or len(parts) > 1 else "fixed",
                "词语": structure,
                "等级": level,
            }
        )

    unique = dedupe(all_entries)
    # Финальная фильтрация шума
    unique = [
        e
        for e in unique
        if not re.search(r"(主语|谓语|宾语\d|表使令|用反问|强调)", e["structure"])
        and not e["structure"].startswith("）")
        and not e["structure"].startswith("(")
        and not e["structure"].startswith("，")
        and not e["structure"].startswith(",")
        and "X是X" not in e["structure"]
        and not any("+" in p for p in e["parts"])
    ]

    # Убрать слишком общие одночастные / односложные пары
    def keep(e: dict) -> bool:
        parts = e["parts"]
        if len(parts) == 1:
            allow = {
                "越来越", "来得及", "来不及", "有的是", "说不定",
                "怪不得", "恨不得", "巴不得", "不一会儿", "动不动就",
                "一般来说", "总而言之", "总的来说", "综上所述",
                "换句话说", "归根到底", "无论如何", "这样一来",
                "不管怎样说", "一点儿也不",
            }
            return parts[0] in allow or len(parts[0]) >= 3
        # односложные обязательные части — только известные пары
        short = [p for p in parts if len(re.sub(r"[/（）()]", "", p)) <= 1]
        if len(short) == len(parts):
            key = "+".join(p.split("/")[0] for p in parts)
            return key in {
                "一+就", "又+又", "越+越", "不+不", "再+也", "既+又", "连+都", "连+也",
            }
        if parts[0] in {"了", "的"}:
            return False
        return True

    unique = [e for e in unique if keep(e)]


    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(unique, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(unique)} grammar patterns → {OUT_PATH}")
    multi = [e for e in unique if len(e["parts"]) >= 2]
    print(f"multi-part: {len(multi)}, single: {len(unique) - len(multi)}")
    for e in unique[:25]:
        print(f"  HSK{e['level']}: {e['structure']} → {e['parts']}")


if __name__ == "__main__":
    main()
