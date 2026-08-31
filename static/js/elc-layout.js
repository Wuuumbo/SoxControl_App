// Sidebar + en-tete partages par les pages de la section ELC
// (elc/index.html = dashboard, elc/categorie.html = un bloc).
const ElcLayout = (() => {
  function initials(nom) {
    const parts = (nom || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function rateColorClass(taux) {
    if (taux >= 80) return "OK";
    if (taux >= 40) return "En-cours";
    if (taux > 0) return "KO";
    return "dash";
  }

  function renderSidebar({ meta, dashRows, activeCatId, who, year }) {
    const rateById = {};
    (dashRows || []).forEach(c => { rateById[c.id] = c.taux; });
    const yearQs = `?year=${encodeURIComponent(year)}`;

    const catItems = (meta.categories || []).map(c => {
      const taux = rateById[c.id] !== undefined ? rateById[c.id] : 0;
      const active = c.id === activeCatId;
      return `
        <a class="sidebar-link ${active ? "active" : ""}" href="categorie.html?id=${encodeURIComponent(c.id)}&year=${encodeURIComponent(year)}">
          <span class="ctrl-name">${escapeHtml(c.nom)}</span>
          <span class="sidebar-rate ${rateColorClass(taux)}">${taux}%</span>
        </a>`;
    }).join("");

    document.getElementById("sidebar").innerHTML = `
      <div class="sidebar-brand" id="brand-block">
        <img src="../static/img/logo-totalenergies.png" alt="TotalEnergies" class="brand-logo"
             onerror="document.getElementById('brand-block').classList.add('logo-missing')">
        <div class="brand-fallback-text">TotalEnergies</div>
        <div class="tagline">Controle Interne</div>
      </div>
      <a class="sidebar-back-link" href="../sections.html">
        <span class="sidebar-back-icon">&#8592;</span> Changer de section
      </a>
      <nav class="sidebar-nav">
        <div class="sidebar-section-label">Entity Level Controls</div>
        <a class="sidebar-link ${!activeCatId ? "active" : ""}" href="index.html${yearQs}">
          <span class="icon">&#9635;</span>
          <span class="ctrl-name">Tableau de bord</span>
        </a>
        <div class="sidebar-section-label">Blocs</div>
        ${catItems}
      </nav>
      <div class="sidebar-user" title="Identite Windows detectee automatiquement - non modifiable">
        <div class="avatar">${escapeHtml(initials(who.display_name))}</div>
        <div class="user-meta">
          <div class="user-name">${escapeHtml(who.display_name || "Utilisateur")}</div>
          <div class="user-role">Poste : ${escapeHtml(who.computer || "")}</div>
        </div>
        <div class="edit-hint" title="Identite verrouillee (session Windows)">&#128274;</div>
      </div>
    `;
  }

  function renderHeader({ activeCatId, catLabel, years, year }) {
    const crumb = activeCatId
      ? `<a href="index.html?year=${encodeURIComponent(year)}">Tableau de bord ELC</a><span class="sep">/</span><span class="current">${escapeHtml(catLabel || "")}</span>`
      : `<span class="current">Tableau de bord ELC</span>`;

    const yearSet = new Set(years);
    yearSet.add(year);
    const yearOptions = Array.from(yearSet).sort().reverse().map(y =>
      `<option value="${y}" ${y === year ? "selected" : ""}>${y}</option>`
    ).join("");

    document.getElementById("topheader").innerHTML = `
      <div class="breadcrumb">${crumb}</div>
      <div class="topheader-center">
        <div class="period-picker-prominent">
          <span class="period-icon">&#128197;</span>
          <select id="year-select">${yearOptions}</select>
        </div>
      </div>
      <div class="topheader-right">
        <button class="btn secondary small" id="new-year-btn">+ Nouvelle annee</button>
      </div>
    `;
  }

  function renderNewYearModal() {
    if (document.getElementById("new-year-modal")) return;
    const div = document.createElement("div");
    div.innerHTML = `
      <div id="new-year-modal" class="modal-backdrop hidden">
        <div class="modal">
          <h3>Demarrer une nouvelle annee</h3>
          <p class="muted">Reprend les blocs et colonnes de l'annee la plus recente ; les statuts et le suivi (dates, commentaires, liens) sont remis a vide.</p>
          <div class="field-row">
            <label>Annee</label>
            <input type="number" id="new-year-input" min="2000" max="2100" step="1">
          </div>
          <div class="modal-actions">
            <button class="btn secondary" id="new-year-cancel">Annuler</button>
            <button class="btn" id="new-year-confirm">Creer</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(div.firstElementChild);
  }

  function wireYearControls(year) {
    renderNewYearModal();
    document.getElementById("year-select").addEventListener("change", async (e) => {
      const val = e.target.value;
      setQueryParam("year", val);
      await Api.put("/api/elc/state", { current_year: val });
      window.location.reload();
    });
    document.getElementById("new-year-btn").addEventListener("click", () => {
      document.getElementById("new-year-input").value = String(parseInt(year, 10) + 1);
      document.getElementById("new-year-modal").classList.remove("hidden");
    });
    document.getElementById("new-year-cancel").addEventListener("click", () => {
      document.getElementById("new-year-modal").classList.add("hidden");
    });
    document.getElementById("new-year-confirm").addEventListener("click", async () => {
      const val = document.getElementById("new-year-input").value.trim();
      if (!/^[0-9]{4}$/.test(val)) return;
      await Api.post("/api/elc/years", { year: val });
      setQueryParam("year", val);
      window.location.reload();
    });
  }

  async function init({ activeCatId, catLabel } = {}) {
    const [yearsResp, who] = await Promise.all([
      Api.get("/api/elc/years"),
      Api.get("/api/whoami"),
    ]);
    const year = getQueryParam("year") || yearsResp.current_year || yearsResp.years[0];

    const [meta, dash] = await Promise.all([
      Api.get(`/api/elc/${year}/meta`),
      Api.get(`/api/elc/${year}/dashboard`),
    ]);

    renderSidebar({ meta, dashRows: dash.par_categorie, activeCatId, who, year });
    renderHeader({ activeCatId, catLabel, years: yearsResp.years, year });
    wireYearControls(year);

    return { meta, dash, who, year };
  }

  return { init, rateColorClass };
})();
