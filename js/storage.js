/* =========================================================
   ARMAZENAMENTO das fotos (usado pela cabine e pelo celular)

   Cada sessão tem um id aleatório longo e 5 arquivos:
     story-escuro.jpg · story-claro.jpg · foto-1.jpg · foto-2.jpg · foto-3.jpg

   - Supabase Storage (bucket público): envio direto do navegador via REST, sem SDK.
   - IndexedDB deste navegador: cópia de segurança quando o envio falha, e "modo local"
     quando o Supabase ainda não foi configurado (a página do celular também lê daqui,
     então dá para testar tudo no próprio Mac).
   ========================================================= */
(function () {
  const cfg = window.CABINE_CONFIG || {};
  const FILES = ["story-escuro", "story-claro", "foto-1", "foto-2", "foto-3"];
  const configured = Boolean(cfg.supabaseUrl && cfg.supabaseKey);
  const base = (cfg.supabaseUrl || "").replace(/\/+$/, "");

  function newId() {
    if (crypto.randomUUID) return crypto.randomUUID().replace(/-/g, "");
    const a = new Uint8Array(16); crypto.getRandomValues(a);
    return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  const validId = (id) => /^[a-f0-9]{32}$/i.test(id || "");

  const publicUrl = (id, name) => `${base}/storage/v1/object/public/${cfg.bucket}/${id}/${name}.jpg`;

  async function putOne(id, name, blob, timeoutMs) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${base}/storage/v1/object/${cfg.bucket}/${id}/${name}.jpg`, {
        method: "POST",
        headers: {
          apikey: cfg.supabaseKey,
          ...(cfg.supabaseKey.startsWith("eyJ") ? { Authorization: `Bearer ${cfg.supabaseKey}` } : {}),
          "Content-Type": "image/jpeg",
          "cache-control": "31536000",
        },
        body: blob,
        signal: ctrl.signal,
      });
      if (res.ok) return;
      const text = await res.text().catch(() => "");
      // Nova tentativa: o arquivo já tinha subido antes → tudo certo
      if (res.status === 409 || /already exists|duplicate/i.test(text)) return;
      throw new Error(`Upload ${name}: HTTP ${res.status} ${text}`);
    } finally { clearTimeout(t); }
  }

  /** Envia os 5 arquivos. files = { "story-escuro": Blob, ... } */
  async function upload(id, files, timeoutMs = 30000) {
    if (!configured) throw new Error("Supabase não configurado (js/config.js)");
    await Promise.all(Object.keys(files).map((n) => putOne(id, n, files[n], timeoutMs)));
  }

  /* ---------- IndexedDB ---------- */
  function db() {
    return new Promise((ok, fail) => {
      const r = indexedDB.open("cabine-fotos", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("sessoes", { keyPath: "id" });
      r.onsuccess = () => ok(r.result);
      r.onerror = () => fail(r.error);
    });
  }
  async function tx(mode, fn) {
    const d = await db();
    return new Promise((ok, fail) => {
      const t = d.transaction("sessoes", mode);
      const req = fn(t.objectStore("sessoes"));
      t.oncomplete = () => { d.close(); ok(req && req.result); };
      t.onerror = () => { d.close(); fail(t.error); };
    });
  }
  /** pending = true → envio falhou e precisa ser recuperado */
  const saveLocal = (id, files, pending) => tx("readwrite", (s) => s.put({ id, files, pending, createdAt: Date.now() }));
  const getLocal = (id) => tx("readonly", (s) => s.get(id));
  const listLocal = () => tx("readonly", (s) => s.getAll());
  const deleteLocal = (id) => tx("readwrite", (s) => s.delete(id));

  window.PhotoStore = { FILES, configured, newId, validId, publicUrl, upload, saveLocal, getLocal, listLocal, deleteLocal };
})();
