#!/usr/bin/env python3
"""Genere la page squelette (Tableau de bord) de chaque section annexe
(ALC, IPE, ELC). Ces sections partagent static/js/section-shell.js et
n'ont pas encore de logique metier propre (contrairement a Controles
Mensuels). Relancer ce script si le contenu du squelette doit changer.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent

SECTIONS = [
    {"code": "ALC", "name": "Application Level Controls", "folder": "alc"},
    {"code": "IPE", "name": "Information Produced by the Entity", "folder": "ipe"},
    {"code": "ELC", "name": "Entity Level Controls", "folder": "elc"},
]

TEMPLATE = """<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>{code} - {name}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="../static/css/style.css">
</head>
<body>
  <div class="app-shell">
    <aside class="sidebar" id="sidebar"></aside>
    <div class="main-col">
      <header class="topheader" id="topheader"></header>

      <main class="page-content">
        <div class="page-head">
          <h1 id="section-title">{code} - {name}</h1>
          <p class="muted">Tableau de bord</p>
        </div>

        <div class="panel">
          <div class="empty-state">
            <p>Cette section n'est pas encore configuree.</p>
            <p class="muted">Les controles et le suivi de "{name}" seront ajoutes ici prochainement.</p>
          </div>
        </div>
      </main>
    </div>
  </div>

  <script src="../static/js/api.js"></script>
  <script src="../static/js/common.js"></script>
  <script src="../static/js/section-shell.js"></script>
  <script>
    SectionShell.init({{ code: "{code}", name: "{name}" }});
  </script>
</body>
</html>
"""


def main():
    for s in SECTIONS:
        out_dir = ROOT / s["folder"]
        out_dir.mkdir(exist_ok=True)
        html = TEMPLATE.format(code=s["code"], name=s["name"])
        (out_dir / "index.html").write_text(html, encoding="utf-8")
        print("genere:", s["folder"] + "/index.html")


if __name__ == "__main__":
    main()
