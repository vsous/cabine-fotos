/* Monta o template de stories (1080×1920) com as 3 fotos.
   Uso: const blob = await composeStory('escuro' | 'claro', [img1, img2, img3], base)
   img = HTMLImageElement | HTMLCanvasElement | ImageBitmap (qualquer proporção: é cortada em "cover").
   base = caminho da pasta assets (padrão "assets").
   Camadas: template (fundo, tira, letras, adesivos) → fotos nos 3 espaços → balões Produto/Design por cima. */
(function () {
  const W = 1080, H = 1920;
  // Espaços das fotos, medidos no Figma (frames 1:2 e 1:4). Inclinação −5,3°.
  const SLOT = { w: 407.91, h: 414.92, a: 0.99572, b: -0.09244, c: 0.09244, d: 0.99572 };
  const SLOTS = [[204.94, 252.70], [246.99, 705.68], [289.04, 1158.65]];
  const CHIPS = [
    { file: 'chip-design.svg', x: 660, y: 644, w: 209, h: 100 },
    { file: 'chip-produto.svg', x: 60, y: 1060, w: 220, h: 95 }, // cursor sobrepõe o canto da foto 3
  ];
  const cache = {};
  function load(src) {
    return cache[src] || (cache[src] = new Promise((ok, fail) => {
      const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = src;
    }));
  }
  function size(img) { return [img.naturalWidth || img.videoWidth || img.width, img.naturalHeight || img.videoHeight || img.height]; }

  async function composeStory(variant, photos, base = 'assets') {
    const url = (f) => (window.STORY_ASSETS && window.STORY_ASSETS[f]) || base + '/stories/' + f;
    const [tpl, ...chips] = await Promise.all([load(url('template-' + variant + '.svg')), ...CHIPS.map((c) => load(url(c.file)))]);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.drawImage(tpl, 0, 0, W, H);
    photos.forEach((img, i) => {
      if (!img || !SLOTS[i]) return;
      const [iw, ih] = size(img);
      const s = Math.max(SLOT.w / iw, SLOT.h / ih);          // cover
      const sw = SLOT.w / s, sh = SLOT.h / s;
      ctx.save();
      ctx.setTransform(SLOT.a, SLOT.b, SLOT.c, SLOT.d, SLOTS[i][0], SLOTS[i][1]);
      ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, SLOT.w, SLOT.h);
      ctx.restore();
    });
    CHIPS.forEach((c, i) => ctx.drawImage(chips[i], c.x, c.y, c.w, c.h));
    return cv;
  }
  window.composeStory = composeStory;
})();
