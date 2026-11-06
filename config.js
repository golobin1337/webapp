// =============================================================
//  CONFIGURAÇÃO DO APP
// =============================================================
//  Produtos, PDFs e alunos você gerencia no painel de admin.
//  Aqui ficam só o visual e a conexão com o Supabase.
// =============================================================

window.APP_CONFIG = {
  // Supabase → Project Settings → API (Project URL e chave anon/publishable)
  supabaseUrl: "https://lryuvrmmlojehxzaxnrz.supabase.co",
  supabaseKey: "sb_publishable_esNBpodyBSkK-tyM6zMJbA_9jIJfp5e",

  nome: "CONGELA FÁCIL FIT",
  logo: "img/logo.jpg", // opcional — se não existir, mostra as iniciais
  corPrincipal: "#2e7d32",

  // Carrossel do topo. "link" pode ser:
  //   "#/produto/ID-DO-PRODUTO"  (o ID aparece no painel)
  //   "#/favoritos", "#/avisos"
  //   "https://..."  (site externo, ex: checkout)
  // "imagem" é opcional (ex: "img/banner1.jpg").
  banners: [
    { imagem: "img/banner-natal.webp", cor: "#7f1d1d", link: "https://pay.wiapy.com/6SocIf06HcLO" }, // Receitas Natalinas R$ 14,90
    { imagem: "img/banner1.webp", cor: "#1b5e20", link: "#/" },
    { imagem: "img/banner2.webp", cor: "#1b5e20", link: "https://pay.wiapy.com/IzXj_WwQVL1X" }, // checkout do combo R$ 37,90
  ],

  // Botão flutuante e "já comprei" (ex: WhatsApp). Deixe "" para esconder.
  suporte: "https://wa.me/5542988654609?text=" + encodeURIComponent("Olá! Preciso de ajuda com o app Congela Fácil Fit."),
};
