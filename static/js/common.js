// Helpers partages entre dashboard.js et control.js

function debounce(fn, delay) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function statusBadgeClass(statut) {
  if (statut === "OK") return "OK";
  if (statut === "KO") return "KO";
  if (statut === "En cours") return "En-cours";
  return "dash";
}

function statusBadgeHtml(statut) {
  return `<span class="badge ${statusBadgeClass(statut)}">${escapeHtml(statut || "-")}</span>`;
}

function formatPeriod(period) {
  if (!period) return "";
  const [y, m] = period.split("-");
  const months = ["janvier", "fevrier", "mars", "avril", "mai", "juin",
    "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
  const idx = parseInt(m, 10) - 1;
  const label = months[idx] || m;
  return `${label.charAt(0).toUpperCase()}${label.slice(1)} ${y}`;
}

function currentMonthValue() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function nowTimeLabel() {
  const d = new Date();
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function setQueryParam(name, value) {
  const url = new URL(window.location.href);
  url.searchParams.set(name, value);
  window.history.replaceState({}, "", url);
}

// Petit gestionnaire d'indicateur de sauvegarde (dot + texte)
class SaveIndicator {
  constructor(el) {
    this.el = el;
  }
  saving() {
    this.el.classList.add("saving");
    this.el.innerHTML = `<span class="dot"></span> Enregistrement...`;
  }
  saved() {
    this.el.classList.remove("saving");
    this.el.innerHTML = `<span class="dot"></span> Enregistre a ${nowTimeLabel()}`;
  }
  error(message) {
    this.el.classList.remove("saving");
    this.el.innerHTML = `<span class="dot" style="background:var(--ko)"></span> Erreur de sauvegarde${message ? ": " + escapeHtml(message) : ""}`;
  }
  idle() {
    this.el.classList.remove("saving");
    this.el.innerHTML = `<span class="dot"></span> A jour`;
  }
}
