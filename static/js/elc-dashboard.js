let ELC_DASH = null;
let ELC_YEAR = null;

async function initElcDashboard() {
  const { dash, year } = await ElcLayout.init({});
  ELC_DASH = dash;
  ELC_YEAR = year;
  renderTiles();
  renderCategories();
  renderStatuts();
  renderEquipes();
  wireAddCategory();
}

function renderTiles() {
  const d = ELC_DASH;
  const restants = d.total - d.obtenu_total;
  document.getElementById("tiles").innerHTML = `
    <div class="tile"><div class="num">${d.total}</div><div class="label">Documents attendus</div></div>
    <div class="tile ok"><div class="num">${d.obtenu_total}</div><div class="label">Obtenus</div></div>
    <div class="tile pending"><div class="num">${d.taux_global}%</div><div class="label">Taux de completion</div></div>
    <div class="tile"><div class="num">${restants}</div><div class="label">Restants</div></div>
  `;
}

function renderCategories() {
  const maxTotal = Math.max(1, ...ELC_DASH.par_categorie.map(c => c.total));
  document.getElementById("cat-cards").innerHTML = ELC_DASH.par_categorie.map(c => `
    <a class="elc-cat-card" href="categorie.html?id=${encodeURIComponent(c.id)}&year=${encodeURIComponent(ELC_YEAR)}">
      <div class="elc-cat-card-top">
        <div class="elc-cat-card-name">${escapeHtml(c.nom)}</div>
        <button class="btn small secondary elc-cat-card-del" data-del-cat="${escapeHtml(c.id)}" title="Supprimer ce bloc">&#10005;</button>
      </div>
      <div class="elc-cat-card-rate">${c.taux}%</div>
      ${elcRateBarHtml(c.taux)}
      <div class="elc-cat-card-sub">${c.obtenu} / ${c.total} documents obtenus</div>
    </a>
  `).join("") || `<p class="empty-state">Aucun bloc. Utilisez "+ Nouveau bloc".</p>`;

  document.getElementById("cat-cards").addEventListener("click", async (e) => {
    const id = e.target.dataset.delCat;
    if (id === undefined) return;
    e.preventDefault();
    const cat = ELC_DASH.par_categorie.find(c => c.id === id);
    const msg = cat && cat.total > 0
      ? `Le bloc "${cat.nom}" contient ${cat.total} ligne(s) qui seront definitivement supprimees. Continuer ?`
      : `Supprimer ce bloc ?`;
    if (!confirm(msg)) return;
    await Api.post(`/api/elc/${ELC_YEAR}/categories/${encodeURIComponent(id)}/delete`, {});
    window.location.reload();
  });
}

function renderStatuts() {
  const total = ELC_DASH.total || 1;
  const maxN = Math.max(1, ...ELC_DASH.par_statut.map(s => s.nombre));
  document.getElementById("statut-bars").innerHTML = ELC_DASH.par_statut.map(s => {
    const c = ELC_STATUT_COLORS[s.statut] || { bg: "var(--neutral)", fg: "#fff" };
    const pct = Math.round(1000 * s.nombre / total) / 10;
    const widthPct = Math.round(100 * s.nombre / maxN);
    return `
      <div class="elc-statbar-row">
        <div class="elc-statbar-label">${elcStatutBadgeHtml(s.statut)}</div>
        <div class="elc-statbar-track"><div class="elc-statbar-fill" style="width:${widthPct}%;background:${c.bg}"></div></div>
        <div class="elc-statbar-value">${s.nombre} <span class="muted">(${pct}%)</span></div>
      </div>`;
  }).join("") || `<p class="empty-state">Aucune donnee.</p>`;
}

function renderEquipes() {
  document.getElementById("equipe-tbody").innerHTML = ELC_DASH.par_equipe.map(e => `
    <tr>
      <td><strong>${escapeHtml(e.team)}</strong></td>
      <td>${e.total}</td>
      <td>${e.obtenu}</td>
      <td>${elcRateBarHtml(e.taux)}</td>
    </tr>
  `).join("") || `<tr><td colspan="4" class="empty-state">Aucune donnee.</td></tr>`;
}

function wireAddCategory() {
  const modal = document.getElementById("add-cat-modal");
  document.getElementById("add-cat-btn").addEventListener("click", () => {
    document.getElementById("add-cat-input").value = "";
    modal.classList.remove("hidden");
  });
  document.getElementById("add-cat-cancel").addEventListener("click", () => modal.classList.add("hidden"));
  document.getElementById("add-cat-confirm").addEventListener("click", async () => {
    const nom = document.getElementById("add-cat-input").value.trim();
    if (!nom) return;
    await Api.post(`/api/elc/${ELC_YEAR}/categories`, { nom });
    modal.classList.add("hidden");
    window.location.reload();
  });
}

document.addEventListener("DOMContentLoaded", initElcDashboard);
