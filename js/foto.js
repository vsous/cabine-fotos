/* =========================================================
   CELULAR — lógica (foto.html?id=<id>)
   Estados: loading → ready | expired
   Parâmetro extra: ?state=ready|loading|expired só para revisão visual.
   ========================================================= */
(function () {
  const body = document.body;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const params = new URLSearchParams(location.search);
  const id = params.get("id");

  /* Nome de arquivo para cada miniatura (data-open) */
  const FILE_OF = { "tpl-dark": "story-escuro", "tpl-light": "story-claro", "foto-1": "foto-1", "foto-2": "foto-2", "foto-3": "foto-3" };
  const urls = {};    // nome → URL exibida
  const blobs = {};   // nome → Blob (pré-carregado para o compartilhamento ser instantâneo)

  if (params.get("state")) { body.dataset.state = params.get("state"); return; }
  body.dataset.state = "loading";

  const loadImage = (src) => new Promise((ok, fail) => {
    const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = src;
  });

  let hasPhotos = true;   // sessões da galeria têm só os 2 stories

  async function load() {
    if (!PhotoStore.validId(id)) throw new Error("id inválido");
    if (PhotoStore.configured) {
      PhotoStore.FILES.forEach((n) => (urls[n] = PhotoStore.publicUrl(id, n)));
    } else {
      // Modo local: a cabine guardou neste mesmo navegador (teste no próprio computador)
      const s = await PhotoStore.getLocal(id);
      if (!s) throw new Error("sessão não encontrada");
      PhotoStore.FILES.forEach((n) => { if (s.files[n]) { blobs[n] = s.files[n]; urls[n] = URL.createObjectURL(s.files[n]); } });
    }
    // Se o primeiro stories não existir, o link expirou ou está errado
    await Promise.all([loadImage(urls["story-escuro"]), loadImage(urls["story-claro"])]);
    try {
      if (!urls["foto-1"]) throw 0;
      await loadImage(urls["foto-1"]);
      await Promise.all(["foto-2", "foto-3"].map((n) => loadImage(urls[n])));
    } catch (e) {
      hasPhotos = false;
      ["foto-1", "foto-2", "foto-3"].forEach((n) => delete urls[n]);
    }
  }

  function fill() {
    const secFotos = $("#t-fotos").closest("section");
    secFotos.hidden = !hasPhotos;
    $('img[data-story="escuro"]').src = urls["story-escuro"];
    $('img[data-story="claro"]').src = urls["story-claro"];
    $$(".photo[data-photo]").forEach((el) => {
      el.style.backgroundImage = `url("${urls["foto-" + (+el.dataset.photo + 1)]}")`;
    });
  }

  async function prefetch() {
    await Promise.all(Object.keys(urls).map(async (n) => {
      if (blobs[n]) return;
      try { blobs[n] = await (await fetch(urls[n])).blob(); } catch (e) { /* baixa na hora de salvar */ }
    }));
  }

  const minShow = new Promise((r) => setTimeout(r, 700));   // o carregamento não "pisca"
  load()
    .then(async () => { fill(); await minShow; body.dataset.state = "ready"; prefetch(); })
    .catch(async (e) => { console.warn("[foto]", e); await minShow; body.dataset.state = "expired"; });

  /* =========================================================
     VISUALIZADOR
     ========================================================= */
  const viewer = $("#viewer"), media = $("#viewer-media");
  let current = null, lastFocus = null;

  function openViewer(btn) {
    current = FILE_OF[btn.dataset.open];
    lastFocus = btn;
    media.innerHTML = "";
    media.classList.toggle("is-photo", current.startsWith("foto"));
    const img = document.createElement("img");
    img.src = urls[current];
    img.alt = btn.getAttribute("aria-label").replace(/^Abrir /, "");
    img.className = current.startsWith("foto") ? "viewer__img viewer__img--photo" : "tpl";
    media.appendChild(img);
    viewer.classList.remove("is-closing");
    viewer.hidden = false;
    $("#btn-save").focus();
  }

  function closeViewer() {
    if (viewer.hidden || viewer.classList.contains("is-closing")) return;
    viewer.classList.add("is-closing");            // toca a animação de saída…
    $(".viewer__body").addEventListener("animationend", () => {
      viewer.hidden = true;                          // …e só então esconde
      viewer.classList.remove("is-closing");
      if (lastFocus) lastFocus.focus();
    }, { once: true });
  }

  $$("[data-open]").forEach((b) => b.addEventListener("click", () => openViewer(b)));
  $$("[data-close]").forEach((b) => b.addEventListener("click", closeViewer));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeViewer(); });

  /* =========================================================
     SALVAR — Web Share com arquivo (no iPhone: "Salvar imagem" vai direto para Fotos).
     Sem suporte → download comum.
     ========================================================= */
  $("#btn-save").addEventListener("click", async () => {
    const name = current;
    const filename = `uxfor-design-e-produto-${name}.jpg`;
    let blob = blobs[name];
    if (!blob) { try { blob = blobs[name] = await (await fetch(urls[name])).blob(); } catch (e) { /* segue p/ link */ } }

    if (blob && navigator.canShare) {
      const file = new File([blob], filename, { type: "image/jpeg" });
      if (navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file] }); return; }
        catch (e) { if (e.name === "AbortError") return; }   // pessoa fechou a folha: tudo certo
      }
    }
    const a = document.createElement("a");
    a.href = blob ? URL.createObjectURL(blob) : urls[name];
    a.download = filename;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
  });
})();
