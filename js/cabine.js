/* =========================================================
   CABINE — lógica (index.html)
   O layout é todo CSS: este arquivo só troca body[data-state] e preenche conteúdo.

   Fluxo: inicio → camera → (countdown → flash) ×3 → processing → qr → inicio
   Erros: upload-error (a partir de processing) · camera-error (a qualquer momento)

   Parâmetros de URL:
     ?dev=1          contagem de 1 s, mostra o id no console
     ?state=qr       só mostra um estado para revisão visual (não liga a câmera)
     ?pendentes=1    baixa as sessões que falharam no envio (ficam guardadas neste navegador)

   Atalhos (operação): Espaço = começar/tirar · 1/2/3 ou ↑/↓ = filtro · F = tela cheia · Esc = volta ao início (menos na tela do QR)
   ========================================================= */
(function () {
  const cfg = Object.assign({ countdown: 3, idleCamera: 45, mirror: true }, window.CABINE_CONFIG);
  const params = new URLSearchParams(location.search);
  const DEV = params.has("dev");
  if (DEV) Object.assign(cfg, { countdown: 1 });

  const IS_PHONE = matchMedia("(max-width: 600px) and (orientation: portrait)").matches;
  const body = document.body;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const setState = (s) => { body.dataset.state = s; };

  /* ---------- Modo revisão: ?state=… ---------- */
  if (params.get("state")) { setState(params.get("state")); return; }

  const RING = ["var(--brand-1)", "var(--brand-4)", "var(--brand-2)"];   // rosa → roxo → azul
  let busy = false, runId = 0, tickCount = 0;
  let shots = [];          // canvases das 3 fotos (já com filtro)
  let session = null;      // { id, files: {nome: Blob} }
  let objectUrls = [];
  let idleTimer = null;

  /* =========================================================
     CÂMERA — liga só quando sai do início (economiza bateria/calor)
     ========================================================= */
  const video = $("#camera");
  const cam = $("#cam");
  let stream = null;

  async function cameraOn() {
    if (stream) return true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: "user" },
        audio: false,
      });
    } catch (e) {
      console.error("[cabine] câmera:", e);
      cameraError();
      return false;
    }
    video.srcObject = stream;
    $$(".filter__video").forEach((v) => (v.srcObject = stream));
    stream.getVideoTracks()[0].addEventListener("ended", cameraError);   // câmera desconectada
    await new Promise((r) => (video.readyState >= 2 ? r() : (video.onloadeddata = r)));
    body.classList.add("has-camera");
    return true;
  }
  function cameraOff() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
    $$(".filter__video").forEach((v) => (v.srcObject = null));
    body.classList.remove("has-camera");
  }
  function cameraError() {
    runId++; busy = false;
    clearTimeout(idleTimer);
    cameraOff();
    setState("camera-error");
  }

  /* =========================================================
     FILTROS — mesmas strings do CSS (--filter-sepia / --filter-pb)
     ========================================================= */
  const css = getComputedStyle(document.documentElement);
  const FILTERS = {
    none: "none",
    sepia: css.getPropertyValue("--filter-sepia").trim(),
    pb: css.getPropertyValue("--filter-pb").trim(),
  };
  const ORDER = ["none", "sepia", "pb"];
  let filter = "none";
  const grain = new Image();
  grain.src = "assets/grao.png";

  function setFilter(f) {
    filter = f;
    cam.dataset.filter = f;
    $$(".filter").forEach((b) => {
      const on = b.dataset.filter === f;
      b.classList.toggle("is-selected", on);
      b.setAttribute("aria-checked", on);
    });
  }

  /* =========================================================
     CAPTURA — resolução nativa da câmera + mesmo filtro da tela
     ========================================================= */
  function capture() {
    const W = video.videoWidth || 1280, H = video.videoHeight || 720;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d");
    if (cfg.mirror) { x.translate(W, 0); x.scale(-1, 1); }
    x.drawImage(video, 0, 0, W, H);
    x.setTransform(1, 0, 0, 1, 0, 0);
    if (filter !== "none") {
      applyCssFilter(x, W, H, FILTERS[filter]);
      // granulado (mesmo PNG da tela, em overlay)
      if (grain.complete && grain.naturalWidth) {
        x.globalCompositeOperation = "overlay"; x.globalAlpha = 0.75;
        x.fillStyle = x.createPattern(grain, "repeat");
        x.fillRect(0, 0, W, H);
        x.globalCompositeOperation = "source-over"; x.globalAlpha = 1;
      }
      // vinheta leve
      const v = x.createRadialGradient(W / 2, H * 0.48, Math.min(W, H) * 0.42, W / 2, H * 0.48, Math.max(W, H) * 0.62);
      v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.5)");
      x.fillStyle = v; x.fillRect(0, 0, W, H);
    }
    return c;
  }

  /* Aplica a mesma string de filtro do CSS pixel a pixel (funciona em qualquer navegador,
     inclusive no Safari, que não aplica ctx.filter). Mesmas fórmulas da especificação CSS. */
  function applyCssFilter(ctx, W, H, str) {
    const ops = [...str.matchAll(/([a-z-]+)\(([-\d.]+)(deg)?\)/g)].map((m) => [m[1], parseFloat(m[2])]);
    const img = ctx.getImageData(0, 0, W, H), d = img.data;
    const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
    const mats = ops.map(([name, a]) => {
      if (name === "grayscale") { const t = 1 - Math.min(a, 1);
        return [0.2126 + 0.7874 * t, 0.7152 - 0.7152 * t, 0.0722 - 0.0722 * t,
                0.2126 - 0.2126 * t, 0.7152 + 0.2848 * t, 0.0722 - 0.0722 * t,
                0.2126 - 0.2126 * t, 0.7152 - 0.7152 * t, 0.0722 + 0.9278 * t, 0]; }
      if (name === "sepia") { const t = 1 - Math.min(a, 1);
        return [0.393 + 0.607 * t, 0.769 - 0.769 * t, 0.189 - 0.189 * t,
                0.349 - 0.349 * t, 0.686 + 0.314 * t, 0.168 - 0.168 * t,
                0.272 - 0.272 * t, 0.534 - 0.534 * t, 0.131 + 0.869 * t, 0]; }
      if (name === "saturate") { const t = a;
        return [0.213 + 0.787 * t, 0.715 - 0.715 * t, 0.072 - 0.072 * t,
                0.213 - 0.213 * t, 0.715 + 0.285 * t, 0.072 - 0.072 * t,
                0.213 - 0.213 * t, 0.715 - 0.715 * t, 0.072 + 0.928 * t, 0]; }
      if (name === "hue-rotate") { const r = (a * Math.PI) / 180, c = Math.cos(r), n = Math.sin(r);
        return [0.213 + c * 0.787 - n * 0.213, 0.715 - c * 0.715 - n * 0.715, 0.072 - c * 0.072 + n * 0.928,
                0.213 - c * 0.213 + n * 0.143, 0.715 + c * 0.285 + n * 0.140, 0.072 - c * 0.072 - n * 0.283,
                0.213 - c * 0.213 - n * 0.787, 0.715 - c * 0.715 + n * 0.715, 0.072 + c * 0.928 + n * 0.072, 0]; }
      if (name === "contrast") return [a, 0, 0, 0, a, 0, 0, 0, a, 0.5 - 0.5 * a];
      if (name === "brightness") return [a, 0, 0, 0, a, 0, 0, 0, a, 0];
      return null;
    }).filter(Boolean);
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      for (const m of mats) {
        const nr = clamp(m[0] * r + m[1] * g + m[2] * b + m[9]);
        const ng = clamp(m[3] * r + m[4] * g + m[5] * b + m[9]);
        const nb = clamp(m[6] * r + m[7] * g + m[8] * b + m[9]);
        r = nr; g = ng; b = nb;
      }
      d[i] = r * 255; d[i + 1] = g * 255; d[i + 2] = b * 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  const toBlob = (canvas, q = 0.9) => new Promise((ok, fail) =>
    canvas.toBlob((b) => (b ? ok(b) : fail(new Error("toBlob falhou"))), "image/jpeg", q));

  function objectUrl(blob) { const u = URL.createObjectURL(blob); objectUrls.push(u); return u; }

  function thumbnail(canvas) {
    const t = document.createElement("canvas");
    t.width = 320; t.height = Math.round(320 * canvas.height / canvas.width);
    t.getContext("2d").drawImage(canvas, 0, 0, t.width, t.height);
    return t.toDataURL("image/jpeg", 0.8);
  }

  function renderThumbs() {
    $$(".thumbs .thumb").forEach((li, i) => {
      li.innerHTML = shots[i] ? `<img src="${thumbnail(shots[i])}" alt="Foto ${i + 1}">` : "";
    });
  }

  /* =========================================================
     CONTAGEM — pulso colorido a cada segundo
     ========================================================= */
  function tick(n) {
    const ring = $(".ring");
    $("#countdown-number").textContent = n;
    ring.style.setProperty("--ring-color", RING[tickCount++ % RING.length]);
    ring.classList.remove("is-tick"); void ring.offsetWidth; ring.classList.add("is-tick");
  }

  /* =========================================================
     QR CODE (js/vendor/qrcode.js)
     ========================================================= */
  function sessionUrl(id) {
    const root = (cfg.siteUrl || location.href.replace(/[^/]*([?#].*)?$/, "")).replace(/\/?$/, "/");
    return `${root}foto.html?id=${id}`;
  }
  function renderQr(url) {
    const qr = qrcode(0, "M");
    qr.addData(url);
    qr.make();
    const svg = qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
    $("#qr-code").src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  /* =========================================================
     FLUXO
     ========================================================= */
  async function begin() {
    if (body.dataset.state !== "inicio") return;
    if (!(await cameraOn())) return;
    setState("camera");
    armIdle();
  }

  async function start() {
    if (busy || body.dataset.state !== "camera") return;
    clearTimeout(idleTimer);
    busy = true;
    const my = ++runId;
    shots = []; tickCount = 0;
    renderThumbs();
    for (let i = 0; i < 3; i++) {
      setState("countdown");
      for (let n = cfg.countdown; n >= 1; n--) {
        tick(n);
        await wait(1000);
        if (my !== runId) return;
      }
      setState("flash");
      shots[i] = capture();
      renderThumbs();
      await wait(450);
      if (my !== runId) return;
      if (i < 2) { setState("countdown"); $("#countdown-number").textContent = ""; await wait(900); }
      if (my !== runId) return;
    }
    await build(my);
  }

  /** Monta os 2 stories + as 3 fotos, mostra a prévia e envia. */
  async function build(my) {
    setState("processing");
    cameraOff();
    const minShow = wait(1200);   // o carregamento aparece ao menos um instante
    try {
      const files = {};
      for (const v of ["escuro", "claro"]) files["story-" + v] = await toBlob(await composeStory(v, shots), 0.92);
      for (let i = 0; i < 3; i++) files["foto-" + (i + 1)] = await toBlob(shots[i]);
      session = { id: PhotoStore.newId(), files };
      if (DEV) console.info("[cabine] sessão", session.id, sessionUrl(session.id));
      // prévia da tira na tela do QR
      $$(".strip__photo").forEach((el, i) => { el.innerHTML = `<img src="${objectUrl(files["foto-" + (i + 1)])}" alt="Foto ${i + 1}">`; });
    } catch (e) {
      console.error("[cabine] montagem:", e);
    }
    if (my !== runId) return;
    await minShow;
    await send(my);
  }

  async function send(my = runId) {
    if (!session) { setState("upload-error"); busy = false; return; }
    setState("processing");
    try {
      if (PhotoStore.configured) {
        await PhotoStore.upload(session.id, session.files);
        PhotoStore.deleteLocal(session.id).catch(() => {});   // se era uma nova tentativa
      } else {
        // Modo local (sem Supabase): guarda neste navegador. O QR só abre neste computador.
        console.warn("[cabine] Supabase não configurado — modo local (js/config.js).");
        await PhotoStore.saveLocal(session.id, session.files, false);
      }
    } catch (e) {
      console.error("[cabine] envio:", e);
      if (my !== runId) return;
      PhotoStore.saveLocal(session.id, session.files, true).catch((err) => console.error("[cabine] cópia local:", err));
      setState("upload-error");
      busy = false;
      return;
    }
    if (my !== runId) return;
    // No celular a pessoa já está no aparelho dela: vai direto para as fotos, sem QR
    if (IS_PHONE) { location.assign(`foto.html?id=${session.id}`); return; }
    renderQr(sessionUrl(session.id));
    // Modo local: clicar no QR abre a página do celular neste computador (para testar)
    $("#qr-code").onclick = PhotoStore.configured ? null : ((u) => () => window.open(u, "_blank"))(sessionUrl(session.id));
    setState("qr");
    busy = false;
  }

  function armIdle() {
    clearTimeout(idleTimer);
    if (IS_PHONE) return;   // no celular a câmera fica aberta até a pessoa tirar as fotos
    idleTimer = setTimeout(() => { if (body.dataset.state === "camera") toInicio(); }, cfg.idleCamera * 1000);
  }

  /** Volta ao início e limpa tudo da sessão (evita vazar memória em horas de uso). */
  function toInicio() {
    clearTimeout(idleTimer);
    runId++; busy = false;
    cameraOff();
    shots = []; session = null;
    objectUrls.forEach((u) => URL.revokeObjectURL(u)); objectUrls = [];
    $$(".strip__photo").forEach((el) => (el.innerHTML = ""));
    $("#qr-code").removeAttribute("src");
    renderThumbs();
    setFilter("none");
    setState("inicio");
    if (IS_PHONE) begin();  // no celular não existe tela inicial: volta direto para a câmera
  }

  /* =========================================================
     EVENTOS
     ========================================================= */
  $("#btn-begin").addEventListener("click", begin);
  $("#btn-start").addEventListener("click", start);
  $$(".filter").forEach((b) => b.addEventListener("click", () => { setFilter(b.dataset.filter); b.blur(); armIdle(); }));
  $("#btn-new-session").addEventListener("click", toInicio);
  $("#btn-retry").addEventListener("click", () => { if (!busy) { busy = true; send(runId); } });
  $("#btn-restart-error").addEventListener("click", toInicio);

  document.addEventListener("keydown", (e) => {
    const s = body.dataset.state;
    if (e.code === "Space" && !e.target.closest("button")) {
      e.preventDefault();
      if (s === "inicio") begin(); else if (s === "camera") start();
    }
    if (e.key === "f" || e.key === "F") {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
      else document.exitFullscreen();
    }
    if (e.key === "Escape" && s !== "inicio" && s !== "camera-error" && s !== "qr") toInicio();
    if (s === "camera") {
      armIdle();
      const keys = { 1: "none", 2: "sepia", 3: "pb" };
      if (keys[e.key]) setFilter(keys[e.key]);
      const k = ORDER.indexOf(filter);
      if (e.key === "ArrowDown") { e.preventDefault(); setFilter(ORDER[(k + 1) % 3]); }
      if (e.key === "ArrowUp") { e.preventDefault(); setFilter(ORDER[(k + 2) % 3]); }
    }
  });
  document.addEventListener("pointermove", () => { if (body.dataset.state === "camera") armIdle(); });

  /* Tela não apaga enquanto a cabine está aberta */
  let wakeLock = null;
  async function keepAwake() {
    try { wakeLock = await navigator.wakeLock?.request("screen"); } catch (e) { /* sem suporte: use caffeinate -d */ }
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") keepAwake(); });
  keepAwake();

  /* ?pendentes=1 → baixa as sessões que não foram enviadas */
  if (params.has("pendentes")) {
    PhotoStore.listLocal().then((list) => {
      const pend = list.filter((s) => s.pending);
      console.info(`[cabine] ${pend.length} sessão(ões) pendente(s)`);
      pend.forEach((s) => PhotoStore.FILES.forEach((n) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(s.files[n]);
        a.download = `cabine-${s.id.slice(0, 8)}-${n}.jpg`;
        a.click();
      }));
      alert(pend.length ? `Baixando ${pend.length} sessão(ões) pendente(s).` : "Nenhuma sessão pendente.");
    });
  }

  setState("inicio");
  if (IS_PHONE) begin();
})();
