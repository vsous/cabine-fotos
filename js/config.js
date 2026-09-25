/* =========================================================
   CONFIGURAÇÃO — o único arquivo que precisa ser editado.
   Passo a passo em LEIA-ME.md.
   ========================================================= */
window.CABINE_CONFIG = {
  // Supabase (Project Settings → API). A chave "anon/public" pode ficar aqui:
  // ela só consegue ENVIAR e LER arquivos do bucket abaixo (regras no LEIA-ME).
  supabaseUrl: "https://huzkgcstyaefsytphnbf.supabase.co",            // ex.: "https://abcdefgh.supabase.co"
  supabaseKey: "sb_publishable_evToj-kUpLrG8N90vFtsyA_BC0X4E19",            // ex.: "eyJhbGciOi..."
  bucket: "cabine-fotos",

  // Endereço público onde o site está publicado (é para onde o QR code aponta).
  // Vazio = o mesmo endereço em que a cabine está aberta.
  siteUrl: "https://vsous.github.io/cabine-fotos",                // ex.: "https://cabine-uxfor.netlify.app"

  // Tempos da cabine (segundos)
  countdown: 3,               // contagem antes de cada foto
  idleCamera: 45,             // câmera aberta sem ninguém usar → volta ao início

  // A foto salva sai espelhada, igual à pessoa se viu na tela (padrão de selfie).
  mirror: true,
};
