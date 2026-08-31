// Client API minimal pour le serveur local (server.py)
const Api = {
  async get(path) {
    const r = await fetch(path);
    if (!r.ok) throw await Api._err(r);
    return r.json();
  },
  async put(path, body) {
    const r = await fetch(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw await Api._err(r);
    return r.json();
  },
  async post(path, body) {
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    if (!r.ok) throw await Api._err(r);
    return r.json();
  },
  async _err(r) {
    let msg = r.statusText;
    try {
      const j = await r.json();
      if (j.error) msg = j.error;
    } catch (e) { /* ignore */ }
    return new Error(`${r.status}: ${msg}`);
  },
};
