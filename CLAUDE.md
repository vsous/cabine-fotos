# Cabine de fotos — "A Relação Entre Design e Produto" (/uxfor.br)

Photo booth web para o evento (ter 29/09). Um MacBook numa cabine mostra a câmera; a pessoa tira 3 fotos (contagem de 3 s cada, com filtro opcional), a cabine monta 2 templates de stories (fundo preto e fundo branco) e mostra um QR code. O QR abre `foto.html?id=…` no celular com os 2 stories + as 3 fotos para salvar.

**Status: design aprovado e funcionalidade implementada.** Para publicar: ver `LEIA-ME.md` (Supabase + Netlify).

## Stack e regras

- HTML + CSS + JavaScript puro. **Sem framework, sem build.** Edite os arquivos direto.
- Site estático (Netlify Drop / GitHub Pages). HTTPS é obrigatório (câmera e Web Share API).
- Fotos no **Supabase Storage** (bucket público `cabine-fotos`, só política de INSERT para `anon`), via REST com `fetch` — sem SDK.
- Fontes self-hosted em `assets/fonts/` (a internet do evento pode cair). Não trocar por Google Fonts.
- Cabine testada no Chrome. O filtro da foto salva é aplicado pixel a pixel (`applyCssFilter` em cabine.js), então funciona também no Safari.

## Estrutura

```
index.html              cabine (notebook, tela cheia, horizontal)
foto.html               página do celular → foto.html?id=<32 hex>
LEIA-ME.md              passo a passo para colocar no ar e operar no dia
css/base.css            tokens (primitivos → semânticos, API de botões estilo shadcn) + componentes/animações compartilhados
css/cabine.css          só da cabine (prancheta Figma 1126×735 escalada por --u)
css/foto.css            só do celular (mobile-first, máx. 480px)
js/config.js            ÚNICO arquivo de configuração (Supabase, siteUrl, tempos, espelhar)
js/storage.js           window.PhotoStore — upload REST, URLs públicas, cópia local em IndexedDB
js/story.js             window.composeStory(variant, fotos) → canvas 1080×1920
js/cabine.js            lógica da cabine
js/foto.js              lógica do celular
js/vendor/qrcode.js     qrcode-generator 1.4.4 (MIT, Kazuhiko Arase)
assets/stories/         template-escuro.svg, template-claro.svg (fundo, sem balões) + chip-design.svg, chip-produto.svg
assets/grao.png         textura de granulado dos filtros (tela e foto salva)
assets/icons/*.svg      ícones/adesivos do KV
```

## Estados (não quebrar isso)

- `<body data-state="…">`; cada bloco declara onde aparece com `data-show="countdown flash"`. O CSS mostra/esconde; **o JS só troca o estado e preenche conteúdo.**
- Cabine: `inicio → camera → (countdown → flash) ×3 → processing → qr → inicio`. Erros: `upload-error`, `camera-error`.
- Celular: `loading → ready | expired`. Visualizador `#viewer` com animação de entrada e de saída (`.is-closing`, esconde no `animationend`).
- `?state=<estado>` em qualquer das páginas mostra só aquele estado (revisão visual, sem câmera/rede).

## Cabine (`js/cabine.js`)

- Câmera liga só ao sair do `inicio` (botão "Clique aqui" ou Espaço) e desliga no `processing`/volta ao início.
- Filtros: `none | sepia | pb`. Mesmas strings em CSS (`--filter-sepia`, `--filter-pb`) e no canvas; sépia/P&B também recebem granulado (overlay 0,75) + vinheta. Atalhos 1/2/3, ↑/↓.
- Captura na resolução nativa (pede 1920×1080), **espelhada** (`mirror: true` em config) como a pessoa se viu.
- `processing`: monta `story-escuro`, `story-claro` (JPEG 0,92) e `foto-1..3` (JPEG 0,9); envia os 5 em paralelo (timeout 30 s cada).
- Falha no envio → cópia em IndexedDB (`pending: true`) + `upload-error`. "Tentar de novo" reenvia (409/"already exists" conta como sucesso). `?pendentes=1` baixa o que ficou pendente.
- Sem Supabase configurado → **modo local**: salva no IndexedDB e o celular (mesmo navegador) lê de lá; clicar no QR abre a página.
- QR → `siteUrl` (ou a pasta atual) + `foto.html?id=<id>`; id = `crypto.randomUUID()` sem hífens.
- Volta ao início: na tela do QR, SÓ pelo botão "Terminei" (sem tempo automático). Câmera ociosa por 45 s ou Esc (fora do QR) também voltam. Limpa canvases, blobs e object URLs.
- `?dev=1`: contagem 1 s, loga o link da sessão. Tecla F = tela cheia. Wake Lock mantém a tela acesa.

## Templates de stories (`js/story.js`)

Camadas: `template-<variante>.svg` → 3 fotos (cover-crop, 407,91×414,92) nos espaços com
`setTransform(0.99572, -0.09244, 0.09244, 0.99572, x, y)` em (204.94, 252.70), (246.99, 705.68), (289.04, 1158.65) → balões por cima: Design (660, 644, 209×100) e Produto (60, 1060, 220×95; o cursor sobrepõe a foto 3).
Fonte: Figma `6pb0jvJF8pBi5vEa4rEdoJ`, frames `1:2` (escuro) e `1:4` (claro). Se o template mudar no Figma, reexportar os SVGs e conferir as coordenadas.

## Celular (`js/foto.js`)

- Valida o id; carrega as 5 imagens; se `story-escuro` não existir → `expired`.
- Pré-baixa os blobs para o compartilhamento ser imediato. Salvar = `navigator.share({ files })` (no iPhone, "Salvar imagem" vai para Fotos); sem suporte → `<a download>`.
- Na grade as fotos aparecem quadradas; no visualizador e no arquivo salvo, inteiras (16:9).

## Tokens e acessibilidade

Usar variáveis de `css/base.css`, nunca hex solto. Texto sobre rosa é preto. `prefers-reduced-motion` desliga animações (corações e reticências aparecem inteiros).

## Decisões em aberto

- Apagar as fotos após 30 dias é manual (texto do celular promete 30 dias).
- Fontes licenciadas do KV (BDRmono 2006, Config Mono): se vierem, adicionar `@font-face` com esses nomes.
