// Pilote une page de controle (controls/<REF>.html)
const REF = document.body.dataset.ref;
let PERIOD = null;
let BUNDLE = null; // dernier bundle charge {meta, raw_data, procedure, control, status}

const saveDot = () => new SaveIndicator(document.getElementById("save-indicator"));

async function initControl() {
  const layout = await Layout.init({ activeRef: REF });
  PERIOD = layout.period;

  await loadBundle();
  wireTabs();
  wireInfoFields();
  wireDataTab();
  wireProcedureTab();
  wireSamplingTab();
  wireContactsTab();
  await loadHistory();
}

async function loadBundle() {
  BUNDLE = await Api.get(`/api/controls/${REF}/${PERIOD}`);
  if (!BUNDLE.exists) {
    document.getElementById("period-missing").classList.remove("hidden");
    document.getElementById("main-tabs").classList.add("hidden");
    return;
  }
  document.getElementById("period-missing").classList.add("hidden");
  document.getElementById("main-tabs").classList.remove("hidden");

  document.getElementById("control-title").textContent = `${REF} - ${BUNDLE.meta.nom}`;
  document.getElementById("control-desc").textContent = BUNDLE.meta.description || "";
  updateStatusBadge();
  renderInfoFields();
  renderTraceability();
  renderDataTable();
  renderProcedureTable();
  renderSamplingTable();
  renderConclusion();
  renderContactsTab();
}

function updateStatusBadge() {
  const s = BUNDLE.status;
  document.getElementById("status-badge").outerHTML =
    `<span id="status-badge" class="badge ${statusBadgeClass(s.statut)}">${escapeHtml(s.statut)}</span>`;
  document.getElementById("taux-conformite").textContent =
    s.taux_conformite !== null && s.taux_conformite !== undefined ? `${s.taux_conformite}%` : "-";
  document.getElementById("nb-conformes").textContent = `${s.nb_conformes}/${s.nb_echantillons}`;
}

// Colore un <select> de statut/resultat selon sa valeur choisie, ET la ligne
// entiere du tableau qui le contient, pour un reperage visuel immediat
// (vert/rouge/orange/gris), coherent avec les badges.
function rowTintClass(value) {
  if (value === "OK") return "row-tint-OK";
  if (value === "KO") return "row-tint-KO";
  if (value === "En cours" || value === "A tester") return "row-tint-pending";
  return "";
}

function paintStatusSelect(select) {
  select.classList.remove("status-select-OK", "status-select-KO", "status-select-pending", "status-select-neutral");
  const v = select.value;
  if (v === "OK") select.classList.add("status-select-OK");
  else if (v === "KO") select.classList.add("status-select-KO");
  else if (v === "En cours" || v === "A tester") select.classList.add("status-select-pending");
  else select.classList.add("status-select-neutral");

  const tr = select.closest("tr");
  if (tr) {
    tr.classList.remove("row-tint-OK", "row-tint-KO", "row-tint-pending");
    const cls = rowTintClass(v);
    if (cls) tr.classList.add(cls);
  }
}

function wireTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    });
  });
}

// ---------------------------------------------------------------------
// Onglet Informations / Conclusion / Tracabilite
// ---------------------------------------------------------------------
function renderInfoFields() {
  const c = BUNDLE.control;
  document.getElementById("f-date-test").value = c.date_test || "";
  document.getElementById("f-nb-echantillons").value = c.nb_echantillons || 2;
}

function renderConclusion() {
  const c = BUNDLE.control;
  document.getElementById("f-conclusion").value = c.conclusion || "";
  document.getElementById("f-observations").value = c.observations || "";
}

function whoLine(stampInfo) {
  if (!stampInfo) return null;
  const when = stampInfo.at ? new Date(stampInfo.at).toLocaleString("fr-FR") : "";
  const computer = stampInfo.computer ? ` &middot; poste ${escapeHtml(stampInfo.computer)}` : "";
  return `<strong>${escapeHtml(stampInfo.display_name)}</strong>${computer}${when ? ` &middot; ${escapeHtml(when)}` : ""}`;
}

function renderTraceability() {
  const c = BUNDLE.control;
  const el = document.getElementById("traceability-body");

  const realized = whoLine(c.realized_by);
  const realizedHtml = realized
    ? `<div class="field-row"><label>Derniere modification</label><div>${realized}</div></div>`
    : `<div class="field-row"><label>Derniere modification</label><div class="muted">Aucune modification enregistree</div></div>`;

  const now = new Date().toLocaleString("fr-FR");

  let signatureHtml;
  if (c.validated_by) {
    const at = c.validated_by.at ? new Date(c.validated_by.at).toLocaleString("fr-FR") : now;
    const signedStatut = c.statut_override === "KO" ? "KO" : "OK";
    const boxClass = signedStatut === "KO" ? "signature-box-signed-ko" : "signature-box-signed";
    const checkLabel = signedStatut === "KO" ? "Controle signe et cloture en KO" : "Controle signe et cloture en OK";
    signatureHtml = `
      <div class="signature-box ${boxClass}">
        <div class="signature-check">&#10003; ${checkLabel}</div>
        <div class="field-grid">
          <div class="field-row"><label>Type de controle</label><div><strong>${escapeHtml(REF)} - ${escapeHtml(BUNDLE.meta.nom)}</strong></div></div>
          <div class="field-row"><label>Date &amp; heure de signature</label><div>${escapeHtml(at)}</div></div>
        </div>
        <div class="field-row">
          <label>Signature electronique</label>
          <div>${escapeHtml(c.validated_by.display_name)} &middot; poste ${escapeHtml(c.validated_by.computer)}</div>
        </div>
        <div class="toolbar" style="margin-top:14px;">
          <button class="btn secondary small" id="invalidate-btn">Annuler la validation</button>
          <button class="btn secondary small" id="print-btn">Imprimer / Exporter en PDF</button>
        </div>
      </div>
    `;
  } else {
    signatureHtml = `
      <div class="signature-box">
        <div class="field-grid">
          <div class="field-row"><label>Type de controle</label><div><strong>${escapeHtml(REF)} - ${escapeHtml(BUNDLE.meta.nom)}</strong></div></div>
          <div class="field-row"><label>Date &amp; heure</label><div class="muted">${escapeHtml(now)} (a la signature)</div></div>
        </div>
        <div class="field-row">
          <label>Signature electronique</label>
          <div class="muted">Ce controle n'a pas encore ete signe/valide.</div>
        </div>
        <div class="toolbar">
          <button class="btn" id="validate-ok-btn">Valider OK</button>
          <button class="btn danger" id="validate-ko-btn">Valider KO</button>
        </div>
      </div>
    `;
  }

  el.innerHTML = `
    <p class="muted" style="margin-top:0">
      La signature electronique reprend automatiquement l'identite (nom, poste) de la session Windows en cours :
      elle ne peut pas etre modifiee ou choisie manuellement.
    </p>
    ${realizedHtml}
    ${signatureHtml}
  `;

  const doValidate = async (statut) => {
    const resp = await Api.post(`/api/controls/${REF}/${PERIOD}/validate`, { statut });
    BUNDLE.control = resp.control;
    BUNDLE.status = resp.status;
    updateStatusBadge();
    renderTraceability();
    loadHistory();
  };
  document.getElementById("validate-ok-btn")?.addEventListener("click", () => doValidate("OK"));
  document.getElementById("validate-ko-btn")?.addEventListener("click", () => {
    if (confirm("Signer ce controle en KO ?")) doValidate("KO");
  });
  document.getElementById("print-btn")?.addEventListener("click", () => {
    document.querySelector('.tab-btn[data-tab="info"]').click();
    setTimeout(() => window.print(), 80);
  });
  document.getElementById("invalidate-btn")?.addEventListener("click", async () => {
    if (!confirm("Annuler la validation de ce controle ?")) return;
    const resp = await Api.post(`/api/controls/${REF}/${PERIOD}/invalidate`);
    BUNDLE.control = resp.control;
    BUNDLE.status = resp.status;
    updateStatusBadge();
    renderTraceability();
    loadHistory();
  });
}

const saveControlDebounced = debounce(saveControl, 700);

async function saveControl() {
  const ind = saveDot();
  ind.saving();
  try {
    const c = BUNDLE.control;
    c.date_test = document.getElementById("f-date-test").value;
    c.nb_echantillons = parseInt(document.getElementById("f-nb-echantillons").value, 10) || 2;
    c.conclusion = document.getElementById("f-conclusion").value;
    c.observations = document.getElementById("f-observations").value;

    const resp = await Api.put(`/api/controls/${REF}/${PERIOD}/control`, c);
    BUNDLE.control = resp.control;
    BUNDLE.status = resp.status;
    updateStatusBadge();
    renderTraceability();
    ind.saved();
  } catch (e) {
    ind.error(e.message);
  }
}

// Le bouton "Enregistrer" flush tout ce qui peut etre en attente de
// sauvegarde (debounce) sur la page : infos/conclusion, procedure,
// contacts et mails types. Une seule version est conservee par periode :
// chaque sauvegarde ecrase la precedente (pas d'accumulation de versions).
async function saveAll() {
  await saveControl();
  await saveProcedure();
  BUNDLE.meta.contacts = readContactsFromTable();
  BUNDLE.meta.mail_templates = readTemplatesFromList();
  await saveMeta();
}

function wireInfoFields() {
  ["f-date-test", "f-nb-echantillons", "f-conclusion", "f-observations"].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener("input", saveControlDebounced);
    el.addEventListener("change", saveControlDebounced);
  });
  document.getElementById("save-now-btn").addEventListener("click", saveAll);
}

// ---------------------------------------------------------------------
// Onglet Donnees brutes (lecture seule - alimente par import Excel)
// ---------------------------------------------------------------------
function renderDataTable() {
  const raw = BUNDLE.raw_data;
  const cols = raw.columns || [];
  const rows = raw.rows || [];

  const infoEl = document.getElementById("data-source-info");
  if (raw.source_filename) {
    const when = raw.imported_at ? new Date(raw.imported_at).toLocaleString("fr-FR") : "";
    const by = raw.imported_by ? escapeHtml(raw.imported_by.display_name) : "";
    const href = `../data/controls/${REF}/periods/${PERIOD}/source/${encodeURIComponent(raw.source_filename)}`;
    infoEl.innerHTML = `Source : <a href="${href}">${escapeHtml(raw.source_filename)}</a>
      importe par <strong>${by}</strong> le ${escapeHtml(when)} &middot; ${rows.length} ligne(s)`;
  } else {
    infoEl.innerHTML = `<span class="muted">Aucune donnee importee pour cette periode.</span>`;
  }

  const thead = document.getElementById("data-thead");
  const tbody = document.getElementById("data-tbody");

  if (!cols.length) {
    thead.innerHTML = "";
    tbody.innerHTML = `<tr><td class="empty-state">Importez un fichier Excel pour afficher les donnees brutes de cette periode.</td></tr>`;
    return;
  }

  thead.innerHTML = "<tr>" + cols.map(c => `<th>${escapeHtml(c.label)}</th>`).join("") + "</tr>";
  tbody.innerHTML = rows.map(row =>
    "<tr>" + cols.map(c => `<td>${escapeHtml(row[c.key])}</td>`).join("") + "</tr>"
  ).join("") || `<tr><td colspan="${cols.length}" class="empty-state">Le fichier importe ne contient aucune ligne de donnees.</td></tr>`;
}

async function handleImportFile(file) {
  if (!file) return;
  if (BUNDLE.raw_data.rows.length) {
    const ok = confirm(`Remplacer les donnees actuellement importees (${BUNDLE.raw_data.rows.length} ligne(s)) par le contenu de "${file.name}" ?`);
    if (!ok) return;
  }
  const ind = saveDot();
  ind.saving();
  try {
    const resp = await fetch(`/api/controls/${REF}/${PERIOD}/import_raw_data`, {
      method: "POST",
      headers: { "X-Filename": file.name },
      body: file,
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || resp.statusText);
    }
    const data = await resp.json();
    BUNDLE.raw_data = data.raw_data;
    BUNDLE.status = data.status;
    updateStatusBadge();
    renderDataTable();
    ind.saved();
  } catch (e) {
    ind.error(e.message);
    alert("Echec de l'import : " + e.message);
  }
}

function wireDataTab() {
  const fileInput = document.getElementById("import-file-input");
  document.getElementById("import-btn").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    fileInput.value = "";
    handleImportFile(file);
  });
}

// ---------------------------------------------------------------------
// Onglet Procedure (colonnes et lignes editables)
// ---------------------------------------------------------------------
const PROC_STATUT_VALUES = ["-", "En cours", "OK", "KO"];

function renderProcedureTable() {
  const cols = BUNDLE.procedure.columns;
  const steps = BUNDLE.procedure.steps;

  const thead = document.getElementById("proc-thead");
  thead.innerHTML = "<tr>" + cols.map((c, i) =>
    `<th><input class="col-header-input" data-col-idx="${i}" value="${escapeHtml(c.label)}"></th>`
  ).join("") + "<th></th></tr>";

  const tbody = document.getElementById("proc-tbody");
  tbody.innerHTML = steps.map((s, i) =>
    "<tr>" + cols.map(c => {
      if (c.key === "statut") {
        return `<td><select data-i="${i}" data-key="statut" class="proc-statut-select">
          ${PROC_STATUT_VALUES.map(v => `<option value="${v}" ${s[c.key] === v ? "selected" : ""}>${v}</option>`).join("")}
        </select></td>`;
      }
      if (c.key === "date") {
        return `<td><input type="date" data-i="${i}" data-key="date" value="${escapeHtml(s[c.key])}"></td>`;
      }
      return `<td contenteditable="true" data-i="${i}" data-key="${escapeHtml(c.key)}">${escapeHtml(s[c.key])}</td>`;
    }).join("") + `<td class="row-actions"><button class="btn small secondary" data-del-step="${i}">Suppr.</button></td></tr>`
  ).join("") || `<tr><td colspan="${cols.length + 1}" class="empty-state">Aucune etape. Utilisez "+ Etape".</td></tr>`;

  document.querySelectorAll(".proc-statut-select").forEach(paintStatusSelect);
}

function readProcedureColumnsFromHeader() {
  const inputs = document.querySelectorAll("#proc-thead .col-header-input");
  return Array.from(inputs).map((inp, i) => ({
    key: BUNDLE.procedure.columns[i].key,
    label: inp.value || BUNDLE.procedure.columns[i].label,
  }));
}

function readProcedureStepsFromTable() {
  const cols = BUNDLE.procedure.columns;
  const trs = document.querySelectorAll("#proc-tbody tr");
  return Array.from(trs).filter(tr => tr.querySelector("[data-key]")).map(tr => {
    const step = {};
    cols.forEach(c => {
      const cell = tr.querySelector(`[data-key="${CSS.escape(c.key)}"]`);
      if (!cell) { step[c.key] = ""; return; }
      step[c.key] = cell.matches("select, input") ? cell.value : cell.textContent;
    });
    return step;
  });
}

const saveProcedureDebounced = debounce(saveProcedure, 700);

async function saveProcedure() {
  const ind = saveDot();
  ind.saving();
  try {
    BUNDLE.procedure.columns = readProcedureColumnsFromHeader();
    BUNDLE.procedure.steps = readProcedureStepsFromTable();
    const resp = await Api.put(`/api/controls/${REF}/${PERIOD}/procedure`, BUNDLE.procedure);
    BUNDLE.status = resp.status;
    updateStatusBadge();
    ind.saved();
  } catch (e) {
    ind.error(e.message);
  }
}

function wireProcedureTab() {
  const tbody = document.getElementById("proc-tbody");
  tbody.addEventListener("input", (e) => {
    if (e.target.matches("select")) paintStatusSelect(e.target);
    saveProcedureDebounced();
  });
  tbody.addEventListener("change", (e) => {
    if (e.target.matches("select")) paintStatusSelect(e.target);
    saveProcedureDebounced();
  });
  tbody.addEventListener("click", (e) => {
    const idx = e.target.dataset.delStep;
    if (idx !== undefined) {
      if (!confirm("Voulez-vous supprimer cette etape ?")) return;
      BUNDLE.procedure.steps.splice(parseInt(idx, 10), 1);
      renderProcedureTable();
      saveProcedure();
    }
  });
  document.getElementById("proc-thead").addEventListener("input", saveProcedureDebounced);

  document.getElementById("add-step-btn").addEventListener("click", () => {
    const step = {};
    BUNDLE.procedure.columns.forEach(c => step[c.key] = c.key === "statut" ? "-" : "");
    BUNDLE.procedure.steps.push(step);
    renderProcedureTable();
    saveProcedure();
  });

  document.getElementById("add-proc-col-btn").addEventListener("click", () => {
    const label = prompt("Nom de la nouvelle colonne :");
    if (!label) return;
    const key = "col_" + Date.now();
    BUNDLE.procedure.columns.push({ key, label });
    BUNDLE.procedure.steps.forEach(s => s[key] = "");
    renderProcedureTable();
    saveProcedure();
  });

  document.getElementById("del-proc-col-btn").addEventListener("click", () => {
    if (BUNDLE.procedure.columns.length <= 1) return;
    const labels = BUNDLE.procedure.columns.map(c => c.label).join(", ");
    const label = prompt(`Colonne a supprimer parmi : ${labels}`);
    if (!label) return;
    const idx = BUNDLE.procedure.columns.findIndex(c => c.label === label);
    if (idx === -1) { alert("Colonne introuvable."); return; }
    if (!confirm(`Voulez-vous supprimer la colonne "${BUNDLE.procedure.columns[idx].label}" ?`)) return;
    const key = BUNDLE.procedure.columns[idx].key;
    BUNDLE.procedure.columns.splice(idx, 1);
    BUNDLE.procedure.steps.forEach(s => delete s[key]);
    renderProcedureTable();
    saveProcedure();
  });
}

// ---------------------------------------------------------------------
// Onglet Echantillons / Controle
// ---------------------------------------------------------------------
function renderSamplingTable() {
  const cols = BUNDLE.raw_data.columns || [];
  const echs = BUNDLE.control.echantillons;
  const thead = document.getElementById("sample-thead");
  thead.innerHTML = "<tr>" + cols.map(c => `<th>${escapeHtml(c.label)}</th>`).join("") +
    `<th>Resultat</th><th>Commentaire</th></tr>`;

  const tbody = document.getElementById("sample-tbody");
  if (!echs.length) {
    tbody.innerHTML = `<tr><td colspan="${cols.length + 2}" class="empty-state">Aucun echantillon tire pour cette periode. Utilisez le bouton "Tirer les echantillons".</td></tr>`;
    return;
  }
  tbody.innerHTML = echs.map((e, i) => `
    <tr>
      ${cols.map(c => `<td>${escapeHtml(e.row ? e.row[c.key] : "")}</td>`).join("")}
      <td>
        <select data-i="${i}" class="sample-resultat-select">
          ${["A tester", "OK", "KO", "N/A"].map(v => `<option value="${v}" ${e.resultat === v ? "selected" : ""}>${v}</option>`).join("")}
        </select>
      </td>
      <td contenteditable="true" data-i="${i}" class="sample-comment-cell">${escapeHtml(e.commentaire)}</td>
    </tr>
  `).join("");
  document.querySelectorAll(".sample-resultat-select").forEach(paintStatusSelect);
}

const saveSamplingDebounced = debounce(saveSampling, 500);

async function saveSampling() {
  const ind = saveDot();
  ind.saving();
  try {
    document.querySelectorAll(".sample-resultat-select").forEach(sel => {
      BUNDLE.control.echantillons[sel.dataset.i].resultat = sel.value;
    });
    document.querySelectorAll(".sample-comment-cell").forEach(td => {
      BUNDLE.control.echantillons[td.dataset.i].commentaire = td.textContent;
    });
    const resp = await Api.put(`/api/controls/${REF}/${PERIOD}/control`, BUNDLE.control);
    BUNDLE.control = resp.control;
    BUNDLE.status = resp.status;
    updateStatusBadge();
    renderTraceability();
    ind.saved();
  } catch (e) {
    ind.error(e.message);
  }
}

function wireSamplingTab() {
  const tbody = document.getElementById("sample-tbody");
  tbody.addEventListener("change", (e) => {
    if (e.target.matches("select")) paintStatusSelect(e.target);
    saveSamplingDebounced();
  });
  tbody.addEventListener("input", saveSamplingDebounced);

  document.getElementById("draw-samples-btn").addEventListener("click", async () => {
    if (!BUNDLE.raw_data.rows.length) {
      alert("Importez d'abord les donnees brutes (onglet Donnees brutes) avant de tirer un echantillon.");
      return;
    }
    const hasResults = BUNDLE.control.echantillons.some(e => e.resultat && e.resultat !== "A tester");
    if (hasResults && !confirm("Des resultats existent deja pour cette periode. Tirer de nouveaux echantillons va les remplacer. Continuer ?")) {
      return;
    }
    const n = parseInt(document.getElementById("f-nb-echantillons").value, 10) || 2;
    try {
      const resp = await Api.post(`/api/controls/${REF}/${PERIOD}/draw_samples`, { n });
      BUNDLE.control = resp.control;
      renderSamplingTable();
      renderTraceability();
      const bundle2 = await Api.get(`/api/controls/${REF}/${PERIOD}`);
      BUNDLE.status = bundle2.status;
      updateStatusBadge();
    } catch (e) {
      alert("Erreur lors du tirage : " + e.message);
    }
  });
}

// ---------------------------------------------------------------------
// Onglet Contacts & mails types
// ---------------------------------------------------------------------
async function saveMeta() {
  const resp = await Api.put(`/api/controls/${REF}/meta`, BUNDLE.meta);
  BUNDLE.meta = resp;
}
const saveMetaDebounced = debounce(async () => {
  const ind = saveDot();
  ind.saving();
  try {
    await saveMeta();
    ind.saved();
  } catch (e) {
    ind.error(e.message);
  }
}, 700);

function renderContactsTab() {
  const contacts = BUNDLE.meta.contacts || [];
  const tbody = document.getElementById("contacts-tbody");
  tbody.innerHTML = contacts.map((c, i) => `
    <tr>
      <td contenteditable="true" data-i="${i}" data-key="nom">${escapeHtml(c.nom)}</td>
      <td contenteditable="true" data-i="${i}" data-key="equipe">${escapeHtml(c.equipe)}</td>
      <td contenteditable="true" data-i="${i}" data-key="email">${escapeHtml(c.email)}</td>
      <td contenteditable="true" data-i="${i}" data-key="telephone">${escapeHtml(c.telephone)}</td>
      <td contenteditable="true" data-i="${i}" data-key="sujet">${escapeHtml(c.sujet)}</td>
      <td class="row-actions"><button class="btn small secondary" data-del-contact="${i}">Suppr.</button></td>
    </tr>
  `).join("") || `<tr><td colspan="6" class="empty-state">Aucun contact renseigne pour ce controle.</td></tr>`;

  const templates = BUNDLE.meta.mail_templates || [];
  const list = document.getElementById("templates-list");
  list.innerHTML = templates.map((t, i) => `
    <div class="panel" style="margin-bottom:12px; box-shadow:none; border-style:dashed;">
      <div class="toolbar" style="margin-bottom:10px;">
        <input type="text" class="tpl-titre" data-i="${i}" placeholder="Titre du modele" value="${escapeHtml(t.titre)}" style="font-weight:700; flex:1;">
        <button class="btn small secondary" data-copy-tpl="${i}">Copier</button>
        <button class="btn small secondary" data-del-tpl="${i}">Suppr.</button>
      </div>
      <div class="field-row"><label>Objet</label><input type="text" class="tpl-objet" data-i="${i}" value="${escapeHtml(t.objet)}"></div>
      <div class="field-row"><label>Corps</label><textarea class="tpl-corps" data-i="${i}" rows="5">${escapeHtml(t.corps)}</textarea></div>
    </div>
  `).join("") || `<p class="empty-state">Aucun modele de mail pour ce controle.</p>`;
}

function readContactsFromTable() {
  const trs = document.querySelectorAll("#contacts-tbody tr");
  return Array.from(trs).filter(tr => tr.querySelector("[data-key]")).map(tr => ({
    nom: tr.querySelector('[data-key="nom"]').textContent,
    equipe: tr.querySelector('[data-key="equipe"]').textContent,
    email: tr.querySelector('[data-key="email"]').textContent,
    telephone: tr.querySelector('[data-key="telephone"]').textContent,
    sujet: tr.querySelector('[data-key="sujet"]').textContent,
  }));
}

function readTemplatesFromList() {
  const titres = document.querySelectorAll(".tpl-titre");
  return Array.from(titres).map((_, i) => ({
    titre: document.querySelector(`.tpl-titre[data-i="${i}"]`).value,
    objet: document.querySelector(`.tpl-objet[data-i="${i}"]`).value,
    corps: document.querySelector(`.tpl-corps[data-i="${i}"]`).value,
  }));
}

function wireContactsTab() {
  const tbody = document.getElementById("contacts-tbody");
  tbody.addEventListener("input", () => {
    BUNDLE.meta.contacts = readContactsFromTable();
    saveMetaDebounced();
  });
  tbody.addEventListener("click", (e) => {
    const idx = e.target.dataset.delContact;
    if (idx !== undefined) {
      if (!confirm("Voulez-vous supprimer ce contact ?")) return;
      BUNDLE.meta.contacts.splice(parseInt(idx, 10), 1);
      renderContactsTab();
      saveMeta();
    }
  });
  document.getElementById("add-contact-btn").addEventListener("click", () => {
    BUNDLE.meta.contacts = BUNDLE.meta.contacts || [];
    BUNDLE.meta.contacts.push({ nom: "", equipe: "", email: "", telephone: "", sujet: "" });
    renderContactsTab();
    saveMeta();
  });

  const list = document.getElementById("templates-list");
  list.addEventListener("input", () => {
    BUNDLE.meta.mail_templates = readTemplatesFromList();
    saveMetaDebounced();
  });
  list.addEventListener("click", async (e) => {
    const delIdx = e.target.dataset.delTpl;
    if (delIdx !== undefined) {
      if (!confirm("Voulez-vous supprimer ce modele de mail ?")) return;
      BUNDLE.meta.mail_templates.splice(parseInt(delIdx, 10), 1);
      renderContactsTab();
      saveMeta();
      return;
    }
    const copyIdx = e.target.dataset.copyTpl;
    if (copyIdx !== undefined) {
      const t = BUNDLE.meta.mail_templates[copyIdx];
      const text = `Objet : ${t.objet}\n\n${t.corps}`;
      try {
        await navigator.clipboard.writeText(text);
        e.target.textContent = "Copie !";
        setTimeout(() => { e.target.textContent = "Copier"; }, 1500);
      } catch (err) {
        alert("Impossible de copier automatiquement. Selectionnez le texte manuellement.");
      }
    }
  });
  document.getElementById("add-template-btn").addEventListener("click", () => {
    BUNDLE.meta.mail_templates = BUNDLE.meta.mail_templates || [];
    BUNDLE.meta.mail_templates.push({ titre: "Nouveau modele", objet: "", corps: "" });
    renderContactsTab();
    saveMeta();
  });
}

// ---------------------------------------------------------------------
// Onglet Historique
// ---------------------------------------------------------------------
async function loadHistory() {
  const resp = await Api.get(`/api/controls/${REF}/periods`);
  const tbody = document.getElementById("history-tbody");
  if (!resp.periods.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Aucune periode enregistree.</td></tr>`;
    return;
  }
  const rows = await Promise.all(resp.periods.map(async p => {
    const b = await Api.get(`/api/controls/${REF}/${p}`);
    return { period: p, status: b.status, control: b.control };
  }));
  tbody.innerHTML = rows.map(r => {
    const validated = r.control.validated_by
      ? `<span class="badge OK">Valide</span> ${escapeHtml(r.control.validated_by.display_name)}`
      : `<span class="badge dash">Non valide</span>`;
    const realized = r.control.realized_by ? escapeHtml(r.control.realized_by.display_name) : "-";
    return `
      <tr>
        <td>${escapeHtml(formatPeriod(r.period))}</td>
        <td>${statusBadgeHtml(r.status.statut)}</td>
        <td>${r.status.nb_conformes}/${r.status.nb_echantillons}</td>
        <td>${realized}</td>
        <td>${validated}</td>
        <td><a class="btn small secondary" href="?period=${encodeURIComponent(r.period)}">Ouvrir</a></td>
      </tr>
    `;
  }).join("");
}

document.getElementById("create-period-here-btn")?.addEventListener("click", async () => {
  await Api.post("/api/periods", { period: PERIOD });
  window.location.reload();
});

document.addEventListener("DOMContentLoaded", initControl);
