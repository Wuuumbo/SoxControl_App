// Coquille (sidebar + header) partagee par les sections "squelette"
// (ALC, IPE, ELC) qui n'ont pas encore leur propre logique metier.
// Utilisation : SectionShell.init({ code: "ALC", name: "Application Level Controls" });
const SectionShell = (() => {
  function initials(nom) {
    const parts = (nom || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  async function init({ code, name }) {
    const basePrefix = "../";
    const who = await Api.get("/api/whoami").catch(() => ({ display_name: "", computer: "" }));

    document.getElementById("sidebar").innerHTML = `
      <div class="sidebar-brand" id="brand-block">
        <img src="${basePrefix}static/img/logo-totalenergies.png" alt="TotalEnergies" class="brand-logo"
             onerror="document.getElementById('brand-block').classList.add('logo-missing')">
        <div class="brand-fallback-text">TotalEnergies</div>
        <div class="tagline">Controle Interne</div>
      </div>
      <a class="sidebar-back-link" href="${basePrefix}sections.html">&larr; Changer de section</a>
      <nav class="sidebar-nav">
        <div class="sidebar-section-label">${escapeHtml(name)}</div>
        <a class="sidebar-link active" href="index.html">
          <span class="icon">&#9635;</span>
          <span class="ctrl-name">Tableau de bord</span>
        </a>
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

    document.getElementById("topheader").innerHTML = `
      <div class="breadcrumb"><span class="current">${escapeHtml(name)}</span></div>
    `;

    document.getElementById("section-title").textContent = `${code} - ${name}`;
  }

  return { init };
})();
