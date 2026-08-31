const CAT_ID = new URLSearchParams(window.location.search).get("id");
let ELC_META = null;
let ELC_ROWS = null;
let CAT_INFO = null;
let ELC_YEAR = null;

const DATE_KEYS = new Set(["date_envoi_mail_cac", "date_obtention"]);
const YESNO_KEYS = new Set(["a_presenter_sur_site"]);
const LINK_KEYS = new Set(["lien_fichier", "lien_racine"]);

// Largeurs par defaut (px) : sans elles, table-layout:fixed repartirait la
// largeur a parts egales entre toutes les colonnes, illisible au 1er chargement.
const DEFAULT_COL_WIDTHS = {
  elc_code: 80,
  controle: 170,
  document: 280,
  team: 80,
  cac_transmission: 130,
  date_envoi_mail_cac: 140,
  a_presenter_sur_site: 100,
  commentaire: 200,
  statut: 150,
  date_obtention: 140,
  personne_suivi: 150,
  commentaires_cac_finale: 200,
  lien_fichier: 130,
  lien_racine: 130,
  statut_2025: 120,
  commentaires_cac_2025: 200,
};
const FALLBACK_COL_WIDTH = 150;

function colWidthsStorageKey() {
  return `elc-col-widths:${CAT_ID}`;
}
function loadColWidths() {
  try { return JSON.parse(localStorage.getItem(colWidthsStorageKey()) || "{}"); }
  catch (e) { return {}; }
}
function saveColWidths(widths) {
  try { localStorage.setItem(colWidthsStorageKey(), JSON.stringify(widths)); }
  catch (e) { /* ignore */ }
}

async function initElcCategorie() {
  if (!CAT_ID) {
    document.getElementById("cat-title").textContent = "Bloc introuvable";
    return;
  }
  const yearsResp = await Api.get("/api/elc/years");
  ELC_YEAR = new URLSearchParams(window.location.search).get("year") || yearsResp.current_year || yearsResp.years[0];

  const metaResp = await Api.get(`/api/elc/${ELC_YEAR}/meta`);
  CAT_INFO = (metaResp.categories || []).find(c => c.id === CAT_ID);

  await ElcLayout.init({ activeCatId: CAT_ID, catLabel: CAT_INFO ? CAT_INFO.nom : CAT_ID });

  ELC_META = metaResp;
  ELC_ROWS = await Api.get(`/api/elc/${ELC_YEAR}/categories/${encodeURIComponent(CAT_ID)}/rows`);

  document.getElementById("cat-title").textContent = CAT_INFO ? CAT_INFO.nom : CAT_ID;
  renderTable();
  updateStats();
  wireToolbar();
  wireColumnResize();
  wireTopScrollbar();
}

// Barre de defilement horizontale dupliquee en haut du tableau : evite de
// devoir descendre tout en bas pour naviguer horizontalement.
function wireTopScrollbar() {
  const top = document.getElementById("elc-scrollbar-top");
  const inner = document.getElementById("elc-scrollbar-top-inner");
  const wrap = document.getElementById("elc-table-wrap");
  const table = wrap.querySelector("table");

  function syncWidth() {
    inner.style.width = table.scrollWidth + "px";
  }
  syncWidth();
  window.elcSyncTopScrollbarWidth = syncWidth;

  let syncing = false;
  top.addEventListener("scroll", () => {
    if (syncing) return;
    syncing = true;
    wrap.scrollLeft = top.scrollLeft;
    syncing = false;
  });
  wrap.addEventListener("scroll", () => {
    if (syncing) return;
    syncing = true;
    top.scrollLeft = wrap.scrollLeft;
    syncing = false;
  });
  window.addEventListener("resize", syncWidth);
}

function updateStats() {
  const rows = ELC_ROWS.rows;
  const total = rows.length;
  const obtenu = rows.filter(r => (r.statut || "").trim() === "Obtenu").length;
  const taux = total ? Math.round(1000 * obtenu / total) / 10 : 0;
  document.getElementById("cat-stats").textContent = `${obtenu}/${total} documents obtenus (${taux}%)`;
}

function saveIndicator() {
  return new SaveIndicator(document.getElementById("save-indicator"));
}

function linkCellHtml(i, key, value) {
  const v = (value || "").trim();
  const chip = v
    ? `<a class="elc-link-chip" href="${escapeHtml(v)}" target="_blank" rel="noopener">&#128279; Ouvrir</a>`
    : `<span class="muted" style="font-size:0.78rem;">Aucun lien</span>`;
  return `<td>
    <div class="elc-link-cell" data-i="${i}" data-key="${key}" data-value="${escapeHtml(v)}">
      ${chip}
      <span class="elc-link-edit-btn" data-edit-link="${i}" data-edit-key="${key}">&#9998;</span>
    </div>
  </td>`;
}

function renderTable() {
  const cols = ELC_META.columns;
  const rows = ELC_ROWS.rows;
  const widths = loadColWidths();

  const thead = document.getElementById("elc-thead");
  thead.innerHTML = `<tr><th style="width:38px">#</th>` + cols.map((c, i) => {
    const w = widths[c.key] || DEFAULT_COL_WIDTHS[c.key] || FALLBACK_COL_WIDTH;
    return `<th data-col-idx="${i}" data-col-key="${c.key}" style="width:${w}px">
      <input class="col-header-input" data-col-idx="${i}" value="${escapeHtml(c.label)}">
      <span class="elc-col-resize-handle" data-resize-key="${c.key}"></span>
    </th>`;
  }).join("") + "<th style=\"width:70px\"></th></tr>";

  const tbody = document.getElementById("elc-tbody");
  tbody.innerHTML = rows.map((r, i) => {
    const statut = (r.statut || "-").trim() || "-";
    return `<tr style="${elcRowStyle(statut)}"><td class="elc-row-num muted">${i + 1}</td>` + cols.map(col => {
      if (col.key === "statut") {
        return `<td><select data-i="${i}" data-key="statut" class="elc-statut-select">
          ${ELC_STATUT_VALUES.map(v => `<option value="${v}" ${statut === v ? "selected" : ""}>${v}</option>`).join("")}
        </select></td>`;
      }
      if (DATE_KEYS.has(col.key)) {
        return `<td><input type="date" data-i="${i}" data-key="${col.key}" value="${escapeHtml(r[col.key])}"></td>`;
      }
      if (YESNO_KEYS.has(col.key)) {
        const v = (r[col.key] || "-").trim() || "-";
        return `<td><select data-i="${i}" data-key="${col.key}">
          ${["-", "OUI", "NON"].map(o => `<option value="${o}" ${v === o ? "selected" : ""}>${o}</option>`).join("")}
        </select></td>`;
      }
      if (LINK_KEYS.has(col.key)) {
        return linkCellHtml(i, col.key, r[col.key]);
      }
      return `<td contenteditable="true" data-i="${i}" data-key="${escapeHtml(col.key)}">${escapeHtml(r[col.key])}</td>`;
    }).join("") + `<td class="row-actions"><button class="btn small secondary" data-del-row="${i}">Suppr.</button></td></tr>`;
  }).join("") || `<tr><td colspan="${cols.length + 2}" class="empty-state">Aucune ligne. Utilisez "+ Ligne".</td></tr>`;

  document.querySelectorAll(".elc-statut-select").forEach(sel => {
    const c = ELC_STATUT_COLORS[sel.value];
    if (c) { sel.style.background = c.bg; sel.style.color = c.fg; }
    else { sel.style.background = ""; sel.style.color = ""; }
  });

  if (window.elcSyncTopScrollbarWidth) window.elcSyncTopScrollbarWidth();
}

function paintElcStatutSelect(select) {
  const c = ELC_STATUT_COLORS[select.value];
  if (c) { select.style.background = c.bg; select.style.color = c.fg; }
  else { select.style.background = ""; select.style.color = ""; }
  const tr = select.closest("tr");
  if (tr) tr.setAttribute("style", elcRowStyle(select.value));
}

function readColumnsFromHeader() {
  const inputs = document.querySelectorAll("#elc-thead .col-header-input");
  return Array.from(inputs).map((inp, i) => ({
    key: ELC_META.columns[i].key,
    label: inp.value || ELC_META.columns[i].label,
  }));
}

function readRowsFromTable() {
  const cols = ELC_META.columns;
  const trs = document.querySelectorAll("#elc-tbody tr");
  return Array.from(trs).filter(tr => tr.querySelector("[data-key]")).map(tr => {
    const row = {};
    cols.forEach(col => {
      if (LINK_KEYS.has(col.key)) {
        const cell = tr.querySelector(`.elc-link-cell[data-key="${CSS.escape(col.key)}"]`);
        row[col.key] = cell ? cell.dataset.value : "";
        return;
      }
      const cell = tr.querySelector(`[data-key="${CSS.escape(col.key)}"]`);
      if (!cell) { row[col.key] = ""; return; }
      row[col.key] = cell.matches("select, input") ? cell.value : cell.textContent;
    });
    return row;
  });
}

const saveRowsDebounced = debounce(saveRows, 700);

async function saveRows() {
  const ind = saveIndicator();
  ind.saving();
  try {
    ELC_ROWS.rows = readRowsFromTable();
    await Api.put(`/api/elc/${ELC_YEAR}/categories/${encodeURIComponent(CAT_ID)}/rows`, ELC_ROWS);
    updateStats();
    ind.saved();
  } catch (e) {
    ind.error(e.message);
  }
}

const saveMetaDebounced = debounce(saveMeta, 700);

async function saveMeta() {
  const ind = saveIndicator();
  ind.saving();
  try {
    ELC_META.columns = readColumnsFromHeader();
    await Api.put(`/api/elc/${ELC_YEAR}/meta`, ELC_META);
    ind.saved();
  } catch (e) {
    ind.error(e.message);
  }
}

function wireColumnResize() {
  const thead = document.getElementById("elc-thead");
  let dragging = null;

  thead.addEventListener("mousedown", (e) => {
    const handle = e.target.closest(".elc-col-resize-handle");
    if (!handle) return;
    const th = handle.closest("th");
    dragging = { key: handle.dataset.resizeKey, th, startX: e.clientX, startW: th.offsetWidth };
    handle.classList.add("resizing");
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const newW = Math.max(60, dragging.startW + (e.clientX - dragging.startX));
    dragging.th.style.width = newW + "px";
    if (window.elcSyncTopScrollbarWidth) window.elcSyncTopScrollbarWidth();
  });

  document.addEventListener("mouseup", () => {
    if (!dragging) return;
    const widths = loadColWidths();
    widths[dragging.key] = dragging.th.offsetWidth;
    saveColWidths(widths);
    document.querySelectorAll(".elc-col-resize-handle.resizing").forEach(h => h.classList.remove("resizing"));
    dragging = null;
  });
}

function wireToolbar() {
  const tbody = document.getElementById("elc-tbody");
  tbody.addEventListener("input", (e) => {
    if (e.target.matches("select.elc-statut-select")) paintElcStatutSelect(e.target);
    saveRowsDebounced();
  });
  tbody.addEventListener("change", (e) => {
    if (e.target.matches("select.elc-statut-select")) paintElcStatutSelect(e.target);
    saveRowsDebounced();
  });
  tbody.addEventListener("click", (e) => {
    const idx = e.target.dataset.delRow;
    if (idx !== undefined) {
      if (!confirm("Voulez-vous supprimer cette ligne ?")) return;
      ELC_ROWS.rows.splice(parseInt(idx, 10), 1);
      renderTable();
      saveRows();
      return;
    }
    const editIdx = e.target.dataset.editLink;
    if (editIdx !== undefined) {
      const key = e.target.dataset.editKey;
      const cell = e.target.closest(".elc-link-cell");
      const current = cell.dataset.value || "";
      const url = prompt("Lien (URL) :", current);
      if (url === null) return;
      cell.dataset.value = url.trim();
      ELC_ROWS.rows[parseInt(editIdx, 10)][key] = url.trim();
      renderTable();
      saveRows();
    }
  });

  document.getElementById("elc-thead").addEventListener("input", () => {
    ELC_META.columns = readColumnsFromHeader();
    saveMetaDebounced();
  });

  document.getElementById("add-row-btn").addEventListener("click", () => {
    const row = {};
    ELC_META.columns.forEach(c => row[c.key] = c.key === "statut" ? "-" : "");
    ELC_ROWS.rows.push(row);
    renderTable();
    saveRows();
  });

  document.getElementById("del-row-btn").addEventListener("click", () => {
    const total = ELC_ROWS.rows.length;
    if (!total) { alert("Aucune ligne a supprimer."); return; }
    const previewKey = ELC_META.columns.some(c => c.key === "document") ? "document" : ELC_META.columns[0].key;
    const input = prompt(`Numero de la ligne a supprimer (1 a ${total}) :`);
    if (!input) return;
    const idx = parseInt(input, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= total) { alert("Numero de ligne invalide."); return; }
    const preview = (ELC_ROWS.rows[idx][previewKey] || "").toString().slice(0, 80);
    if (!confirm(`Supprimer la ligne ${idx + 1} ?\n${preview}`)) return;
    ELC_ROWS.rows.splice(idx, 1);
    renderTable();
    saveRows();
  });

  document.getElementById("add-col-btn").addEventListener("click", () => {
    const label = prompt("Nom de la nouvelle colonne :");
    if (!label) return;
    const key = "col_" + Date.now();
    ELC_META.columns.push({ key, label });
    ELC_ROWS.rows.forEach(r => r[key] = "");
    renderTable();
    saveMeta();
    saveRows();
  });

  document.getElementById("del-col-btn").addEventListener("click", () => {
    if (ELC_META.columns.length <= 1) return;
    const labels = ELC_META.columns.map(c => c.label).join(", ");
    const label = prompt(`Colonne a supprimer parmi : ${labels}`);
    if (!label) return;
    const idx = ELC_META.columns.findIndex(c => c.label === label);
    if (idx === -1) { alert("Colonne introuvable."); return; }
    if (!confirm(`Voulez-vous supprimer la colonne "${ELC_META.columns[idx].label}" ? Cela l'enleve de tous les blocs.`)) return;
    const key = ELC_META.columns[idx].key;
    ELC_META.columns.splice(idx, 1);
    ELC_ROWS.rows.forEach(r => delete r[key]);
    renderTable();
    saveMeta();
    saveRows();
  });

  document.getElementById("rename-cat-btn").addEventListener("click", async () => {
    const nom = prompt("Nouveau nom du bloc :", CAT_INFO ? CAT_INFO.nom : "");
    if (!nom || !nom.trim()) return;
    CAT_INFO.nom = nom.trim();
    document.getElementById("cat-title").textContent = CAT_INFO.nom;
    await Api.put(`/api/elc/${ELC_YEAR}/meta`, ELC_META);
  });
}

document.addEventListener("DOMContentLoaded", initElcCategorie);
