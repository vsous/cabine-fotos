# Cabine de fotos — como colocar no ar

Tudo já funciona. Faltam só **3 coisas que dependem de contas suas**: onde as fotos ficam guardadas (Supabase), onde o site fica publicado (Netlify) e o teste no local do evento. Leva uns 20 minutos.

> **Dá para testar agora, sem configurar nada:** abra o `index.html` com o Live Server do VS Code (ou `npx serve`) e use `index.html?dev=1`. Sem Supabase, a cabine entra em **modo local**: as fotos ficam guardadas no próprio navegador e, na tela final, **clicar no QR abre a página do celular numa nova aba**. Só não dá para abrir no celular de verdade.

---

## 1. Supabase — onde as fotos ficam (grátis)

1. Crie uma conta em **supabase.com** → **New project** (qualquer nome, região *South America (São Paulo)*). Guarde a senha do banco, mas não vamos usá-la.
2. Menu **Storage** → **New bucket**
   - Nome: `cabine-fotos`
   - **Public bucket: ligado** (é o que deixa o celular abrir as fotos pelo link)
   - *Restrict file upload size*: `5 MB` · *Allowed MIME types*: `image/jpeg`
3. Menu **SQL Editor** → cole e rode (**Run**):

   ```sql
   create policy "cabine: enviar fotos"
   on storage.objects for insert to anon
   with check (bucket_id = 'cabine-fotos');
   ```

   Isso deixa a cabine **enviar** fotos e nada mais. Ninguém consegue listar, trocar ou apagar as fotos de outras pessoas — só abre quem tem o link (o id tem 32 caracteres aleatórios).
4. Menu **Project Settings → API** (ou *Data API*): copie **Project URL** e a chave **anon public**.
5. Abra `js/config.js` e preencha:

   ```js
   supabaseUrl: "https://SEU-PROJETO.supabase.co",
   supabaseKey: "eyJhbGciOi... (a chave anon public)",
   ```

## 2. Netlify — publicar o site (grátis, com HTTPS)

1. Entre em **app.netlify.com/drop** (crie conta).
2. **Arraste a pasta `cabine-fotos` inteira** para a página. Em segundos aparece um endereço tipo `https://nome-aleatorio.netlify.app` (dá para renomear em *Site configuration → Change site name*, ex.: `cabine-uxfor`).
3. Coloque esse endereço em `js/config.js`:

   ```js
   siteUrl: "https://cabine-uxfor.netlify.app",
   ```

4. **Arraste a pasta de novo** (em *Deploys*, área "Drag and drop") para publicar a versão com o `siteUrl`. Toda vez que mudar algum arquivo, é só arrastar de novo.

> Por que HTTPS importa: sem ele o navegador não libera a câmera, e o celular não consegue usar "Salvar imagem".

## 3. Teste antes do evento (faça no local, se der)

1. No Mac, abra `https://SEU-SITE/index.html` **no Chrome** (o filtro da foto salva depende dele) → permita a câmera.
2. Tire uma sessão, leia o QR com **um iPhone e um Android usando 4G** (não o Wi-Fi do evento) → abra os stories → **Salvar no dispositivo** → confira no app Fotos.
3. Poste um stories de teste para ver o enquadramento.
4. Deixe rodando 20–30 sessões seguidas.

## No dia

- Mac **na tomada**. No Terminal: `caffeinate -d` (a tela não apaga; a página também pede isso ao navegador).
- Abra `index.html` no Chrome e aperte **F** (tela cheia).
- Atalhos do operador:
  - **Espaço**: começar / tirar fotos (um clicker de apresentação que envie Espaço também funciona)
  - **1 / 2 / 3** ou **↑ / ↓**: filtro (Sem filtro / Sépia / P&B)
  - **Esc**: volta ao início na hora (na tela do QR, só o botão "Terminei" volta)
  - **F**: tela cheia
- Se a internet cair no envio: a tela "Não conseguimos enviar" aparece e as fotos **ficam guardadas no Mac**. "Tentar de novo" reenvia. Para recuperar depois as que não foram: abra `index.html?pendentes=1` e elas são baixadas.
- Se aparecer "Cabine em ajuste": câmera sem permissão ou desconectada → confira o cadeado da barra de endereço → **⌘R**.

## Depois do evento

- As fotos **não se apagam sozinhas**. A página do celular diz que ficam disponíveis por 30 dias: depois disso, em **Storage → cabine-fotos**, selecione tudo e apague.
- O plano grátis tem 1 GB: cada sessão ocupa ~1,5 MB, então cabem ~600 sessões.

## Endereços úteis

| | |
|---|---|
| `index.html` | cabine |
| `index.html?dev=1` | teste rápido (contagem de 1 s, link da sessão no console) |
| `index.html?state=qr` | ver uma tela sem usar a câmera (`inicio`, `camera`, `processing`, `qr`, `upload-error`, `camera-error`) |
| `index.html?pendentes=1` | baixar sessões que falharam no envio |
| `foto.html?state=ready` | ver a página do celular (`loading`, `ready`, `expired`) |
