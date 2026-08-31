#!/usr/bin/env python3
"""Initialise elc/data/ a partir du classeur reel de suivi ELC.

Source (chemin en dur, propre au poste de l'utilisateur) :
  FT - IC-Documents Internes/04-Sarbanes-Oxley/Campagne 2026 (DELETE2036)/
  2026 - ELC/04. Justificatifs/Suivi_ELC_2026_Final__.xlsm

A executer une seule fois (ou pour reimporter depuis le classeur source).
Necessite openpyxl : python -m pip install openpyxl
"""
import json
from datetime import datetime
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
SOURCE = (
    Path.home() / "OneDrive - TotalEnergies" / "FT - IC-Documents Internes" /
    "04-Sarbanes-Oxley" / "Campagne 2026 (DELETE2036)" / "2026 - ELC" /
    "04. Justificatifs" / "Suivi_ELC_2026_Final__.xlsm"
)

COLUMNS = [
    ("elc_code", "N. ELC"), ("controle", "Controle"), ("document", "Document attendu"),
    ("team", "Equipe"), ("cac_transmission", "CAC transmission"),
    ("date_envoi_mail_cac", "Date envoi mail CAC"), ("a_presenter_sur_site", "A presenter sur site"),
    ("commentaire", "Commentaire"), ("statut", "Statut"), ("date_obtention", "Date obtention"),
    ("personne_suivi", "Personne chargee du suivi"), ("commentaires_cac_finale", "Commentaires CAC finale"),
    ("lien_fichier", "Lien fichier"), ("lien_racine", "Lien racine"),
    ("statut_2025", "Statut 2025"), ("commentaires_cac_2025", "Commentaires CAC 2025"),
]

SOURCE_COL_LETTERS = {
    "categorie": "C", "elc_code": "D", "controle": "E", "document": "F",
    "team": "G", "cac_transmission": "H", "date_envoi_mail_cac": "I",
    "a_presenter_sur_site": "J", "commentaire": "K", "statut": "L",
    "date_obtention": "M", "personne_suivi": "N", "commentaires_cac_finale": "O",
    "lien_fichier": "P", "lien_racine": "Q", "statut_2025": "S",
    "commentaires_cac_2025": "T",
}


def write_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def cell_val(row_cells, letter):
    idx = openpyxl.utils.column_index_from_string(letter) - 1
    if idx >= len(row_cells):
        return None
    v = row_cells[idx].value
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%d")
    return v


def main():
    if not SOURCE.exists():
        raise SystemExit(f"Classeur source introuvable : {SOURCE}")

    wb = openpyxl.load_workbook(SOURCE, data_only=True, keep_vba=True)
    ws = wb["Suivi 2026"]

    all_rows = []
    last = {"categorie": None, "elc_code": None, "controle": None}
    for row in ws.iter_rows(min_row=3):
        if not any(c.value for c in row):
            continue
        item = {k: cell_val(row, letter) for k, letter in SOURCE_COL_LETTERS.items()}
        for k in ("categorie", "elc_code", "controle"):
            if item[k] in (None, ""):
                item[k] = last[k]
            else:
                last[k] = item[k]
        if not item.get("document"):
            continue
        item.pop("categorie_placeholder", None)
        categorie = item.pop("categorie")
        item["_categorie"] = categorie
        all_rows.append(item)

    categories = []
    seen = set()
    for r in all_rows:
        cat = r["_categorie"]
        if cat not in seen:
            seen.add(cat)
            num = cat.split(".")[0].strip()
            categories.append({"id": num, "nom": cat})

    year_dir = DATA / "years" / "2026"
    write_json(year_dir / "meta.json", {
        "categories": categories,
        "columns": [{"key": k, "label": l} for k, l in COLUMNS],
    })
    write_json(DATA / "state.json", {"current_year": "2026"})

    for cat in categories:
        rows = [
            {k: v for k, v in r.items() if k != "_categorie"}
            for r in all_rows if r["_categorie"] == cat["nom"]
        ]
        write_json(year_dir / "rows" / f"{cat['id']}.json", {"rows": rows})

    print(f"ELC : {len(all_rows)} lignes reparties sur {len(categories)} categories.")
    for cat in categories:
        n = sum(1 for r in all_rows if r["_categorie"] == cat["nom"])
        print(f"  - {cat['id']}: {cat['nom']} ({n} lignes)")


if __name__ == "__main__":
    main()
