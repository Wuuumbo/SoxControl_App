let DASH_PERIOD = null;
let DASH_ROWS = [];
let EDIT_MODE = false;

async function initDashboard() {
  const { period, registry, dashRows } = await Layout.init({ activeRef: null });
  DASH_PERIOD = period;
  DASH_ROWS = dashRows;

  document.getElementById("campaign-name").textContent = registry.campaign || "";
  document.getElementById("team-name").textContent = registry.team || "";

  renderTiles(DASH_ROWS);
  renderTable(DASH_ROWS, DASH_PERIOD);
  wireEditToggle();
  await loadYearlyChart();
  wireYearSelect();
}

function renderTiles(rows) {
  const total = rows.length;
  const ok = rows.filter(r => r.status.statut === "OK").length;
  const ko = rows.filter(r => r.status.statut === "KO").length;
  const enCours = rows.filter(r => r.status.statut === "En cours").length;
  const nonDemarre = total - ok - ko - enCours;

  const el = document.getElementById("tiles");
  el.innerHTML = `
    <div class="tile"><div class="num">${total}</div><div class="label">Controles</div></div>
    <div class="tile ok"><div class="num">${ok}</div><div class="label">OK</div></div>
    <div class="tile ko"><div class="num">${ko}</div><div class="label">KO</div></div>
    <div class="tile pending"><div class="num">${enCours}</div><div class="label">En cours</div></div>
    <div class="tile"><div class="num">${nonDemarre}</div><div class="label">Non demarre</div></div>
  `;
}

// ---------------------------------------------------------------------
// Tableau des controles (+ edition rapide du nom/description/contact)
// ---------------------------------------------------------------------
function dashRowTint(statut) {
  if (statut === "OK") return "row-tint-OK";
  if (statut === "KO") return "row-tint-KO";
  if (statut === "En cours") return "row-tint-pending";
  return "";
}

function renderTable(rows, period) {
  const tbody = document.getElementById("controls-tbody");
  tbody.innerHTML = rows.map((r, i) => {
    const m = r.meta;
    const s = r.status;
    const taux = s.taux_conformite !== null && s.taux_conformite !== undefined ? `${s.taux_conformite}%` : "-";
    const href = `controls/${r.ref}.html?period=${encodeURIComponent(period)}`;
    const rowClass = dashRowTint(s.statut);
    const editable = EDIT_MODE ? ' contenteditable="true"' : "";
    const nomCell = EDIT_MODE
      ? `<td${editable} data-i="${i}" data-key="nom">${escapeHtml(m.nom)}</td>`
      : `<td>${escapeHtml(m.nom)}</td>`;
    const descCell = EDIT_MODE
      ? `<td${editable} data-i="${i}" data-key="description" class="muted">${escapeHtml(m.description || "")}</td>`
      : `<td class="muted">${escapeHtml(m.description || "")}</td>`;
    const contactCell = EDIT_MODE
      ? `<td${editable} data-i="${i}" data-key="contact" class="muted">${escapeHtml(m.contact || "-")}</td>`
      : `<td class="muted">${escapeHtml(m.contact || "-")}</td>`;
    return `
      <tr class="${rowClass}">
        <td><strong>${escapeHtml(r.ref)}</strong></td>
        ${nomCell}
        ${descCell}
        <td>${s.nb_conformes}/${s.nb_echantillons}</td>
        <td>${taux}</td>
        <td>${statusBadgeHtml(s.statut)}</td>
        ${contactCell}
        <td class="row-actions">${EDIT_MODE ? "" : `<a class="btn small secondary" href="${href}">Ouvrir</a>`}</td>
      </tr>
    `;
  }).join("");

  if (EDIT_MODE) wireEditableCells();
}

function wireEditableCells() {
  const tbody = document.getElementById("controls-tbody");
  const save = debounce(async (i) => {
    const row = DASH_ROWS[i];
    const tr = tbody.querySelectorAll("tr")[i];
    row.meta.nom = tr.querySelector('[data-key="nom"]').textContent.trim();
    row.meta.description = tr.querySelector('[data-key="description"]').textContent.trim();
    row.meta.contact = tr.querySelector('[data-key="contact"]').textContent.trim();
    const ind = new SaveIndicator(document.getElementById("dash-save-indicator"));
    ind.saving();
    try {
      await Api.put(`/api/controls/${row.ref}/meta`, row.meta);
      ind.saved();
    } catch (e) {
      ind.error(e.message);
    }
  }, 700);

  tbody.querySelectorAll("[contenteditable]").forEach(cell => {
    cell.addEventListener("input", () => save(parseInt(cell.dataset.i, 10)));
  });
}

function wireEditToggle() {
  document.getElementById("edit-controls-btn").addEventListener("click", () => {
    EDIT_MODE = !EDIT_MODE;
    document.getElementById("edit-controls-btn").textContent = EDIT_MODE ? "Termine" : "✏️ Modifier";
    document.getElementById("dash-save-indicator").classList.toggle("hidden", !EDIT_MODE);
    renderTable(DASH_ROWS, DASH_PERIOD);
  });
}

// ---------------------------------------------------------------------
// Graphique annuel OK / KO / En cours / Non demarre
// ---------------------------------------------------------------------
const STATUS_COLORS = {
  "OK": "var(--ok)",
  "KO": "var(--ko)",
  "En cours": "var(--pending)",
  "-": "var(--neutral-bg)",
};

function buildYearlyChartSvg(months) {
  const w = 760, h = 220, padL = 30, padB = 24, padT = 10;
  const chartW = w - padL - 10;
  const chartH = h - padT - padB;
  const barGap = 6;
  const barW = (chartW / 12) - barGap;
  const total = 9; // nb de controles max par mois (echelle fixe pour comparer les mois)

  let bars = "";
  let labels = "";
  months.forEach((m, i) => {
    const x = padL + i * (barW + barGap);
    let yCursor = padT + chartH;
    ["OK", "KO", "En cours", "-"].forEach(key => {
      const count = m.counts[key] || 0;
      if (!count) return;
      const segH = (count / total) * chartH;
      yCursor -= segH;
      bars += `<rect x="${x.toFixed(1)}" y="${yCursor.toFixed(1)}" width="${barW.toFixed(1)}" height="${segH.toFixed(1)}" fill="${STATUS_COLORS[key]}" rx="2"><title>${m.period} - ${key} : ${count}</title></rect>`;
    });
    const label = m.period.split("-")[1];
    labels += `<text x="${(x + barW / 2).toFixed(1)}" y="${h - 6}" text-anchor="middle" font-size="11" fill="var(--text-muted)">${label}</text>`;
  });

  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <line x1="${padL}" y1="${padT + chartH}" x2="${w - 10}" y2="${padT + chartH}" stroke="var(--border)" />
    ${bars}
    ${labels}
  </svg>`;
}

async function loadYearlyChart(year) {
  const resp = await Api.get(`/api/yearly_status${year ? `?year=${year}` : ""}`);
  const sel = document.getElementById("year-select");
  sel.innerHTML = (resp.years_available.length ? resp.years_available : [resp.year])
    .map(y => `<option value="${y}" ${y === resp.year ? "selected" : ""}>${y}</option>`).join("");

  document.getElementById("yearly-chart").innerHTML = buildYearlyChartSvg(resp.months);
}

function wireYearSelect() {
  document.getElementById("year-select").addEventListener("change", (e) => {
    loadYearlyChart(e.target.value);
  });
}

document.addEventListener("DOMContentLoaded", initDashboard);
