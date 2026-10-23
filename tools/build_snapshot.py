"""Buat data/snapshot.js dari file export spreadsheet (.xlsx).

Snapshot dipakai sebagai cadangan bila Google Sheets tidak bisa diakses langsung
dari browser. Kolom identitas (nama responden, GPS, link) dibuang.

Pemakaian:  python tools/build_snapshot.py "Monitoring Survey Layanan 2026.xlsx"
"""
import datetime as dt
import json
import sys

import openpyxl

DROP = {"respondent name", "gps", "link", "upload location"}


def cell(v):
    if v is None:
        return ""
    if isinstance(v, dt.datetime):
        return v.strftime("%Y-%m-%dT%H:%M:%S")
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v).strip()


def main(path, out="data/snapshot.js"):
    wb = openpyxl.load_workbook(path, data_only=True)
    sheets = {}
    for ws in wb:
        rows = [[cell(v) for v in r] for r in ws.iter_rows(values_only=True)]
        if not rows:
            continue
        keep = [i for i, h in enumerate(rows[0]) if h.lower() not in DROP]
        rows = [[r[i] if i < len(r) else "" for i in keep] for r in rows]
        rows = [rows[0]] + [r for r in rows[1:] if any(r)]
        sheets[ws.title] = rows
    stamp = dt.datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    with open(out, "w", encoding="utf-8") as f:
        f.write("// File ini dibuat otomatis oleh tools/build_snapshot.py — jangan diedit manual.\n")
        f.write("window.SURVEY_SNAPSHOT = ")
        json.dump({"generatedAt": stamp, "sheets": sheets}, f, ensure_ascii=False)
        f.write(";\n")
    print(out, {k: len(v) - 1 for k, v in sheets.items()})


if __name__ == "__main__":
    main(*sys.argv[1:])
