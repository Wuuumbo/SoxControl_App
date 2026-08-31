// Palette de couleurs par Statut (couleurs reprises du classeur Excel source).
// Liste volontairement reduite a 4 statuts + N/A pour simplifier le suivi.
const ELC_STATUT_COLORS = {
  "Obtenu": { bg: "#27AE60", fg: "#FFFFFF" },
  "En attente": { bg: "#E67E22", fg: "#FFFFFF" },
  "Demande en attente": { bg: "#8E44AD", fg: "#FFFFFF" },
  "N/A": { bg: "#95A5A6", fg: "#FFFFFF" },
};
const ELC_STATUT_VALUES = ["-", "Obtenu", "En attente", "Demande en attente", "N/A"];

function elcHexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Style de ligne (fond teinte + liseret) pour un statut donne : nettement
// plus marque qu'un simple lavis, pour bien distinguer Obtenu / En attente /
// Demande en attente / N/A d'un coup d'oeil.
function elcRowStyle(statut) {
  const s = (statut || "-").trim() || "-";
  const c = ELC_STATUT_COLORS[s];
  if (!c) return "";
  return `background:${elcHexToRgba(c.bg, 0.16)};border-left:4px solid ${c.bg};`;
}

function elcStatutBadgeHtml(statut) {
  const s = (statut || "-").trim();
  const c = ELC_STATUT_COLORS[s];
  if (!c) return `<span class="elc-badge elc-badge-neutral">${escapeHtml(s || "-")}</span>`;
  return `<span class="elc-badge" style="background:${c.bg};color:${c.fg}">${escapeHtml(s)}</span>`;
}

function elcRateBarHtml(taux) {
  const cls = ElcLayout.rateColorClass(taux);
  const color = { OK: "var(--ok)", KO: "var(--ko)", "En-cours": "var(--pending)", dash: "var(--neutral)" }[cls];
  return `
    <div class="elc-rate">
      <div class="elc-rate-bar"><div class="elc-rate-fill" style="width:${taux}%;background:${color}"></div></div>
      <span class="elc-rate-label">${taux}%</span>
    </div>`;
}
