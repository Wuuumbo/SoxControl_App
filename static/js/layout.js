// Construit la sidebar et l'en-tete partages par toutes les pages.
// Utilisation : const { period, registry, dashRows } = await Layout.init({ activeRef: "N3" | null });
const Layout = (() => {
  function initials(nom) {
    const parts = (nom || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function renderSidebar({ activeRef, basePrefix, controls, who, period }) {
    const periodQs = `?period=${encodeURIComponent(period)}`;
    const dashHref = `${basePrefix}index.html${periodQs}`;
    const navItems = controls.map(c => {
      const active = c.ref === activeRef;
      const href = `${basePrefix}controls/${c.ref}.html${periodQs}`;
      const dotClass = statusBadgeClass(c.status.statut);
      return `
        <a class="sidebar-link ${active ? "active" : ""}" href="${href}">
          <span class="ref-tag">${escapeHtml(c.ref)}</span>
          <span class="ctrl-name">${escapeHtml(c.meta.nom)}</span>
          <span class="status-dot ${dotClass}" title="${escapeHtml(c.status.statut)}"></span>
        </a>`;
    }).join("");

    const html = `
      <div class="sidebar-brand" id="brand-block">
        <img src="${basePrefix}static/img/logo-totalenergies.png" alt="TotalEnergies" class="brand-logo"
             onerror="document.getElementById('brand-block').classList.add('logo-missing')">
        <div class="brand-fallback-text">TotalEnergies</div>
        <div class="tagline">Controle Interne - Tresorerie</div>
      </div>
      <a class="sidebar-back-link" href="${basePrefix}sections.html">&larr; Changer de section</a>
      <nav class="sidebar-nav">
        <div class="sidebar-section-label">Controles mensuels</div>
        <a class="sidebar-link ${!activeRef ? "active" : ""}" href="${dashHref}">
          <span class="icon">&#9635;</span>
          <span class="ctrl-name">Tableau de bord</span>
        </a>
        ${navItems}
      </nav>
      <div class="sidebar-user" id="sidebar-user-btn" title="Identite Windows detectee automatiquement - non modifiable">
        <div class="avatar">${escapeHtml(initials(who.display_name))}</div>
        <div class="user-meta">
          <div class="user-name">${escapeHtml(who.display_name || "Utilisateur")}</div>
          <div class="user-role">Poste : ${escapeHtml(who.computer || "")}</div>
        </div>
        <div class="edit-hint" title="Identite verrouillee (session Windows)">&#128274;</div>
      </div>
    `;
    document.getElementById("sidebar").innerHTML = html;
  }

  function renderHeader({ activeRef, basePrefix, periods, period, currentLabel }) {
    const crumb = activeRef
      ? `<a href="${basePrefix}index.html?period=${encodeURIComponent(period)}">Tableau de bord</a><span class="sep">/</span><span class="current">${escapeHtml(activeRef)} - ${escapeHtml(currentLabel)}</span>`
      : `<span class="current">Tableau de bord</span>`;

    let periodSet = new Set(periods);
    periodSet.add(period);
    const periodOptions = Array.from(periodSet).sort().reverse().map(p =>
      `<option value="${p}" ${p === period ? "selected" : ""}>${formatPeriod(p)}</option>`
    ).join("");

    const html = `
      <div class="breadcrumb">${crumb}</div>
      <div class="topheader-center">
        <div class="period-picker-prominent">
          <span class="period-icon">&#128197;</span>
          <select id="period-select">${periodOptions}</select>
        </div>
      </div>
      <div class="topheader-right">
        <button class="btn secondary small" id="new-period-btn">+ Nouveau mois</button>
      </div>
    `;
    document.getElementById("topheader").innerHTML = html;
  }

  function renderNewPeriodModal() {
    if (document.getElementById("new-period-modal")) return;
    const div = document.createElement("div");
    div.innerHTML = `
      <div id="new-period-modal" class="modal-backdrop hidden">
        <div class="modal">
          <h3>Demarrer un nouveau mois</h3>
          <p class="muted">Cree la periode pour tous les controles (donnees brutes vides, procedure reprise du mois precedent).</p>
          <div class="field-row">
            <label>Mois</label>
            <input type="month" id="new-period-input">
          </div>
          <div class="modal-actions">
            <button class="btn secondary" id="new-period-cancel">Annuler</button>
            <button class="btn" id="new-period-confirm">Creer</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(div.firstElementChild);
  }

  function wirePeriodControls(period, basePrefix) {
    renderNewPeriodModal();
    document.getElementById("period-select").addEventListener("change", async (e) => {
      const val = e.target.value;
      setQueryParam("period", val);
      // La periode choisie devient la periode par defaut de l'outil (memorisee
      // cote serveur), pour qu'elle reste active partout meme apres navigation
      // ou fermeture/reouverture de l'outil - jusqu'a un nouveau changement.
      await Api.put("/api/state", { current_period: val });
      window.location.reload();
    });
    document.getElementById("new-period-btn").addEventListener("click", () => {
      document.getElementById("new-period-input").value = "";
      document.getElementById("new-period-modal").classList.remove("hidden");
    });
    document.getElementById("new-period-cancel").addEventListener("click", () => {
      document.getElementById("new-period-modal").classList.add("hidden");
    });
    document.getElementById("new-period-confirm").addEventListener("click", async () => {
      const val = document.getElementById("new-period-input").value;
      if (!val) return;
      await Api.post("/api/periods", { period: val });
      setQueryParam("period", val);
      window.location.reload();
    });
  }

  async function init({ activeRef } = {}) {
    const basePrefix = activeRef ? "../" : "";
    const [registry, who, periodsResp] = await Promise.all([
      Api.get("/api/registry"),
      Api.get("/api/whoami"),
      Api.get("/api/periods"),
    ]);
    const period = getQueryParam("period") || registry.current_period || periodsResp.periods[0];
    const dash = await Api.get(`/api/dashboard?period=${encodeURIComponent(period)}`);

    const currentRow = activeRef ? dash.rows.find(r => r.ref === activeRef) : null;

    renderSidebar({ activeRef, basePrefix, controls: dash.rows, who, period });
    renderHeader({ activeRef, basePrefix, periods: periodsResp.periods, period, currentLabel: currentRow ? currentRow.meta.nom : "" });
    wirePeriodControls(period, basePrefix);

    return { period, registry, dashRows: dash.rows, who };
  }

  return { init };
})();
