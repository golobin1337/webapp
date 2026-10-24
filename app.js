(() => {
  const cfg = window.APP_CONFIG;
  const view = document.getElementById("view");
  const FAV_KEY = "favoritos";
  const EMAIL_KEY = "email";
  const AVISOS_KEY = "avisos_vistos"; // data do último aviso que o aluno já viu

  // Celulares não exibem PDF dentro de iframe de forma confiável,
  // então lá o PDF abre direto no leitor nativo do aparelho.
  const ehCelular = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const icones = {
    voltar: '<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>',
    avancar: '<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>',
    estrela: '<svg viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/></svg>',
    baixar: '<svg viewBox="0 0 24 24"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/></svg>',
    fechar: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    abrir: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    busca: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    cadeado: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  };

  const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Caminhos do Storage viram URL pública; URLs completas passam direto.
  const urlArquivo = (p) =>
    !p ? "" : /^https?:|^img\/|^demo\//.test(p) ? p : `${cfg.supabaseUrl}/storage/v1/object/public/arquivos/${p}`;

  const ler = (k, padrao) => { try { return JSON.parse(localStorage.getItem(k)) ?? padrao; } catch { return padrao; } };
  const gravar = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const lerFavs = () => new Set(ler(FAV_KEY, []));

  // Estado carregado do servidor
  let dados = null; // { nome, produtos: [...] }
  let todos = [];   // materiais liberados, achatados, com referência ao produto

  // Modo de teste: enquanto o Supabase não estiver configurado no config.js,
  // o app aceita o e-mail de teste e mostra produtos de exemplo.
  const modoTeste = !cfg.supabaseUrl || cfg.supabaseUrl.includes("SEU-PROJETO");
  const EMAIL_TESTE = "aluno@gmail.com";

  function dadosTeste(email) {
    if (email !== EMAIL_TESTE) return { autorizado: false };
    const pdf = (id, titulo, descricao) => ({ id, titulo, descricao, arquivo: "demo/exemplo.pdf" });
    return {
      autorizado: true,
      nome: "Aluno Teste",
      produtos: [
        { id: "demo-1", titulo: "Receitas Congeláveis", emoji: "🍲", cor: "#558b2f", capa: "", link_compra: "", liberado: true, total: 2,
          materiais: [pdf("demo-1a", "Cardápio da semana", "Planejamento completo"), pdf("demo-1b", "Lista de compras", "Tudo o que comprar")] },
        { id: "demo-2", titulo: "Marmitas Fit", emoji: "🥗", cor: "#2e7d32", capa: "", link_compra: "", liberado: true, total: 1,
          materiais: [pdf("demo-2a", "Guia de marmitas", "Como montar e congelar")] },
        { id: "demo-3", titulo: "Sobremesas Fit", emoji: "🍓", cor: "#00695c", capa: "", link_compra: "https://exemplo.com", liberado: false, total: 5,
          descricao: "Exemplo de produto bloqueado: o aluno vê o botão de compra.", materiais: [] },
      ],
    };
  }

  async function buscarDados(email) {
    if (modoTeste) return dadosTeste(email);
    const res = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/app_dados`, {
      method: "POST",
      // Chaves "sb_publishable_" não são JWT: vão só no header apikey.
      headers: { apikey: cfg.supabaseKey, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: email }),
    });
    if (!res.ok) throw new Error(`Erro ${res.status}`);
    return res.json();
  }

  function aplicarDados(d) {
    dados = d;
    todos = d.produtos.flatMap((p) => p.materiais.map((m) => ({ ...m, produto: p })));
  }

  // ---------- Montagem inicial ----------
  document.documentElement.style.setProperty("--verde", cfg.corPrincipal);
  document.title = cfg.nome;
  document.getElementById("topbar-title").textContent = cfg.nome;

  const logo = document.getElementById("logo");
  logo.textContent = cfg.nome.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  if (cfg.logo) {
    const img = new Image();
    img.onload = () => { logo.textContent = ""; logo.style.backgroundImage = `url("${cfg.logo}")`; };
    img.src = cfg.logo;
  }

  const fab = document.getElementById("fab");
  if (cfg.suporte) fab.href = cfg.suporte; else fab.remove();

  document.getElementById("btn-busca").onclick = () => {
    location.hash = "#/";
    setTimeout(() => document.getElementById("campo-busca")?.focus(), 50);
  };

  // ---------- Componentes ----------
  const capaStyle = (cor, imagem) =>
    `--cor:${esc(cor)};${imagem ? `background-image:url('${esc(urlArquivo(imagem))}')` : ""}`;

  function carrossel() {
    if (!cfg.banners?.length) return "";
    const slides = cfg.banners.map((b) => `
      <a class="slide ${b.imagem && b.titulo ? "tem-img" : ""}" href="${esc(b.link || "#/")}" style="${capaStyle(b.cor, b.imagem)}"
         ${/^https?:/.test(b.link) ? 'target="_blank" rel="noopener"' : ""}>
        ${b.titulo ? `<strong>${esc(b.titulo)}</strong>` : ""}
        ${b.subtitulo ? `<span>${esc(b.subtitulo)}</span>` : ""}
      </a>`).join("");
    return `
      <div class="carousel">
        <div class="slides">${slides}</div>
        <button class="car-btn prev" aria-label="Anterior">${icones.voltar}</button>
        <button class="car-btn next" aria-label="Próximo">${icones.avancar}</button>
        <div class="dots">${cfg.banners.map(() => "<i></i>").join("")}</div>
      </div>`;
  }

  let timerCarrossel;
  function ativarCarrossel() {
    clearInterval(timerCarrossel);
    const trilho = view.querySelector(".slides");
    if (!trilho) return;
    const dots = [...view.querySelectorAll(".dots i")];
    const total = dots.length;
    const atual = () => Math.round(trilho.scrollLeft / trilho.clientWidth);
    const ir = (i) => trilho.scrollTo({ left: ((i + total) % total) * trilho.clientWidth, behavior: "smooth" });
    const marcar = () => dots.forEach((d, i) => d.classList.toggle("on", i === atual()));

    trilho.addEventListener("scroll", marcar, { passive: true });
    view.querySelector(".prev").onclick = () => ir(atual() - 1);
    view.querySelector(".next").onclick = () => ir(atual() + 1);
    marcar();

    const auto = () => { clearInterval(timerCarrossel); timerCarrossel = setInterval(() => ir(atual() + 1), 5000); };
    trilho.addEventListener("pointerdown", auto);
    auto();
  }

  // No celular o link vai direto para o PDF (abrir via script depois de
  // uma troca de rota é bloqueado como pop-up); no computador abre o leitor.
  const linkPdf = (m) => ehCelular
    ? `href="${esc(urlArquivo(m.arquivo))}" target="_blank" rel="noopener"`
    : `href="#/ler/${m.id}"`;

  function cardProduto(p) {
    // Produto com um único PDF abre o PDF direto, sem tela intermediária.
    const unico = p.liberado && p.materiais.length === 1 ? p.materiais[0] : null;
    const fav = unico && lerFavs().has(unico.id);
    return `
      <div class="cat-wrap">
      ${unico ? `<button class="card-fav ${fav ? "fav" : ""}" data-fav="${unico.id}" aria-label="Favoritar">${icones.estrela}</button>` : ""}
      <a class="cat-card ${p.liberado ? "" : "bloqueado"}" ${unico ? linkPdf(unico) : `href="#/produto/${esc(p.id)}"`}>
        <div class="cat-capa" style="${capaStyle(p.cor, p.capa)}">
          ${p.capa ? "" : esc(p.emoji || "📄")}
          ${p.liberado
            ? `<span class="badge">${p.total} PDF${p.total === 1 ? "" : "s"}</span>`
            : `<span class="badge cadeado">${icones.cadeado} Bloqueado</span>`}
        </div>
        <p>${esc(p.titulo)}</p>
      </a>
      </div>`;
  }

  function itemPdf(m, favs) {
    const fav = favs.has(m.id);
    return `
      <div class="pdf-item">
        <div class="pdf-icone ${/\.xlsx?$/i.test(m.arquivo) ? "planilha" : ""}">${esc((m.arquivo.split(".").pop() || "pdf").slice(0, 4).toUpperCase())}</div>
        <a class="pdf-info" ${linkPdf(m)}>
          <strong>${esc(m.titulo)}</strong>
          <small>${esc(m.descricao || m.produto.titulo)}</small>
        </a>
        <button class="icon-btn ${fav ? "fav" : ""}" data-fav="${m.id}" aria-label="Favoritar">${icones.estrela}</button>
        <a class="icon-btn" href="${esc(urlArquivo(m.arquivo))}" download target="_blank" rel="noopener" aria-label="Baixar">${icones.baixar}</a>
      </div>`;
  }

  const listaPdfs = (itens, msgVazio) => {
    const favs = lerFavs();
    return itens.length
      ? `<div class="lista">${itens.map((m) => itemPdf(m, favs)).join("")}</div>`
      : `<div class="vazio"><div>📭</div>${msgVazio}</div>`;
  };

  // Busca sem diferenciar acentos e maiúsculas ("acucar" acha "Açúcar").
  const normalizar = (s = "") => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  function gradeProdutos(q = "") {
    const achados = dados.produtos.filter((p) => normalizar(p.titulo).includes(normalizar(q)));
    if (!achados.length) {
      return `<div class="vazio"><div>📭</div>${q ? "Nada encontrado." : "Nenhum material disponível ainda."}</div>`;
    }
    const liberados = achados.filter((p) => p.liberado);
    const bloqueados = achados.filter((p) => !p.liberado);
    return `
      ${liberados.length ? `
        <h2 class="secao-titulo">Seus materiais</h2>
        <div class="grid">${liberados.map(cardProduto).join("")}</div>` : ""}
      ${bloqueados.length ? `
        <h2 class="secao-titulo">Desbloqueie também</h2>
        <div class="grid">${bloqueados.map(cardProduto).join("")}</div>` : ""}`;
  }

  const avisos = () => dados.avisos || [];
  const ultimoAviso = () => avisos().reduce((max, a) => (a.criado_em > max ? a.criado_em : max), "");
  const dataBR = (s) => new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  function atualizarBolinhaAvisos() {
    const ultimo = ultimoAviso();
    const tem = !!ultimo && ultimo > ler(AVISOS_KEY, "");
    document.querySelector('[data-tab="avisos"]')?.classList.toggle("novo", tem);
  }

  // ---------- Telas ----------
  const telas = {
    inicio() {
      return `
        ${carrossel()}
        ${dados.produtos.length > 4
          ? `<div class="busca">${icones.busca}<input type="search" id="campo-busca" placeholder="Buscar receitas..." autocomplete="off"></div>`
          : ""}
        <div id="resultado">${gradeProdutos()}</div>`;
    },

    produto(id) {
      const p = dados.produtos.find((x) => x.id === id);
      if (!p) return telas.inicio();
      const topo = `
        <a class="voltar" href="#/">${icones.voltar} Voltar</a>
        <div class="cat-hero ${p.capa ? "tem-img" : ""}" style="${capaStyle(p.cor, p.capa)}">
          ${p.capa ? "" : `<span class="emoji">${esc(p.emoji || "📄")}</span>`}
          <div><h2>${esc(p.titulo)}</h2><small>${p.total} material(is)</small></div>
        </div>`;

      if (p.liberado) {
        return `${topo}${listaPdfs(todos.filter((m) => m.produto === p), "Nenhum material neste produto ainda.")}`;
      }
      return `${topo}
        <div class="card-texto bloqueio">
          <div class="bloqueio-icone">${icones.cadeado}</div>
          <h2>Conteúdo bloqueado</h2>
          ${p.descricao ? `<p>${esc(p.descricao)}</p>` : ""}
          <p>${p.total > 1 ? `Adquira para liberar os ${p.total} materiais deste produto.` : "Adquira para liberar este material."}</p>
          ${p.link_compra ? `<a class="botao grande" href="${esc(p.link_compra)}" target="_blank" rel="noopener">Quero desbloquear</a>` : ""}
          ${cfg.suporte ? `<a class="link-suave" href="${esc(cfg.suporte)}" target="_blank" rel="noopener">Já comprei e não liberou</a>` : ""}
        </div>`;
    },

    avisos() {
      const lista = avisos();
      return `
        <h2 class="secao-titulo">Avisos</h2>
        ${lista.length ? `<div class="lista">${lista.map((a) => `
          <article class="aviso ${a.fixado ? "fixado" : ""}">
            ${a.fixado ? '<span class="aviso-tag">📌 Fixado</span>' : ""}
            <h3>${esc(a.titulo)}</h3>
            <time>${dataBR(a.criado_em)}</time>
            ${a.texto ? `<p>${esc(a.texto)}</p>` : ""}
            ${a.link ? `<a class="botao" href="${esc(a.link)}" target="_blank" rel="noopener">Saiba mais</a>` : ""}
          </article>`).join("")}</div>`
        : '<div class="vazio"><div>📣</div>Nenhum aviso por enquanto.</div>'}`;
    },

    favoritos() {
      const favs = lerFavs();
      return `
        <h2 class="secao-titulo">Seus favoritos</h2>
        ${listaPdfs(todos.filter((m) => favs.has(m.id)), "Toque na ⭐ de um material para salvá-lo aqui.")}`;
    },

    sobre() {
      const liberados = dados.produtos.filter((p) => p.liberado).length;
      // Já aberto como app instalado: o tutorial de instalação não faz sentido.
      const instalado = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
      return `
        <div class="card-texto">
          <h2>${esc(dados.nome || "Minha conta")}</h2>
          <p class="texto-suave">${esc(ler(EMAIL_KEY, ""))}</p>
          ${modoTeste ? '<p class="erro">Modo de teste: configure o Supabase no config.js para usar os alunos e PDFs reais.</p>' : ""}
          <p>Você tem <b>${liberados}</b> produto(s) liberado(s), com <b>${todos.length}</b> materiais.</p>
          ${cfg.suporte ? `<a class="botao" href="${esc(cfg.suporte)}" target="_blank" rel="noopener">Falar com o suporte</a>` : ""}
          <button class="botao secundario" id="btn-sair">Sair</button>
        </div>
        ${instalado ? "" : `
        <div class="card-texto tutorial">
          <h2>📲 Dica: instale o app no celular!</h2>

          <h3>🍎 iPhone</h3>
          <p>Abra no Safari → Compartilhar → “Adicionar à Tela de Início”.</p>
          <figure>
            <img src="img/passo1.webp" alt="Toque nos três pontinhos ao lado do endereço" loading="lazy">
            <figcaption><b>Passo 1:</b> toque nos três pontinhos (···) ao lado do endereço.</figcaption>
          </figure>
          <figure>
            <img src="img/passo2.webp" alt="Toque em Adicionar à Tela de Início" loading="lazy">
            <figcaption><b>Passo 2:</b> toque em “Adicionar à Tela de Início”.</figcaption>
          </figure>

          <h3>🤖 Android</h3>
          <p>Abra no Chrome → Toque nos três pontinhos (⋮) → “Instalar app” ou “Adicionar à tela inicial”.</p>

          <p class="tutorial-fim">✅ Pronto! Acesse seus materiais com apenas um toque.</p>
        </div>`}`;
    },
  };

  // ---------- Login ----------
  function telaLogin(msg = "") {
    document.body.classList.add("deslogado");
    view.innerHTML = `
      <form class="login" id="form-login">
        <div class="login-logo">${cfg.logo
          ? `<img src="${esc(cfg.logo)}" alt="" onerror="this.replaceWith(${esc(JSON.stringify(logo.textContent))})">`
          : esc(logo.textContent)}</div>
        ${cfg.logo ? "" : `<h2>${esc(cfg.nome)}</h2>`}
        <p>Digite o e-mail que você usou na compra para acessar seus materiais.</p>
        <input type="email" id="campo-email" placeholder="seu@email.com" required autocomplete="email" inputmode="email">
        <p class="erro" id="erro-login">${esc(msg)}</p>
        <button class="botao grande" type="submit">Entrar</button>
        ${cfg.suporte ? `<a class="link-suave" href="${esc(cfg.suporte)}" target="_blank" rel="noopener">Precisa de ajuda?</a>` : ""}
      </form>`;

    document.getElementById("form-login").onsubmit = async (e) => {
      e.preventDefault();
      const email = document.getElementById("campo-email").value.trim().toLowerCase();
      const btn = e.target.querySelector("button");
      const erro = document.getElementById("erro-login");
      btn.disabled = true; btn.textContent = "Entrando...";
      try {
        const d = await buscarDados(email);
        if (!d.autorizado) {
          erro.textContent = "E-mail não encontrado. Confira se é o mesmo e-mail usado na compra.";
          return;
        }
        gravar(EMAIL_KEY, email);
        aplicarDados(d);
        document.body.classList.remove("deslogado");
        location.hash = "#/";
        render();
      } catch {
        erro.textContent = "Não foi possível conectar. Verifique sua internet e tente de novo.";
      } finally {
        btn.disabled = false; btn.textContent = "Entrar";
      }
    };
  }

  function sair() {
    gravar(EMAIL_KEY, null);
    dados = null; todos = [];
    telaLogin();
  }

  // ---------- Leitor ----------
  function abrirLeitor(id) {
    const m = todos.find((x) => x.id === id);
    if (!m) return (location.hash = "#/");
    const url = urlArquivo(m.arquivo);

    if (ehCelular) {
      // Volta para a tela anterior e abre o PDF no leitor do aparelho.
      history.back();
      window.open(url, "_blank");
      return;
    }

    const el = document.createElement("div");
    el.className = "leitor";
    el.innerHTML = `
      <div class="leitor-topo">
        <button class="icon-btn" data-fechar aria-label="Fechar">${icones.fechar}</button>
        <strong>${esc(m.titulo)}</strong>
        <a class="icon-btn" href="${esc(url)}" target="_blank" rel="noopener" aria-label="Abrir em nova aba">${icones.abrir}</a>
        <a class="icon-btn" href="${esc(url)}" download aria-label="Baixar">${icones.baixar}</a>
      </div>
      <iframe src="${esc(url)}" title="${esc(m.titulo)}"></iframe>`;
    el.querySelector("[data-fechar]").onclick = () => history.back();
    document.body.appendChild(el);
  }

  // ---------- Roteamento ----------
  function render() {
    if (!dados) return;
    document.querySelector(".leitor")?.remove();
    const [, rota = "", param] = location.hash.split("/");

    if (rota === "ler") return abrirLeitor(param);

    const tela = telas[rota] ? rota : "inicio";
    view.innerHTML = telas[tela](param);

    const aba = tela === "produto" ? "inicio" : tela;
    document.querySelectorAll(".tabbar a").forEach((a) => a.classList.toggle("ativo", a.dataset.tab === aba));

    if (tela === "inicio") ativarCarrossel(); else clearInterval(timerCarrossel);

    const campo = document.getElementById("campo-busca");
    if (campo) {
      campo.oninput = () => {
        document.getElementById("resultado").innerHTML = gradeProdutos(campo.value.trim());
      };
    }

    if (tela === "avisos") gravar(AVISOS_KEY, ultimoAviso());
    atualizarBolinhaAvisos();
    document.getElementById("btn-sair")?.addEventListener("click", sair);
    window.scrollTo(0, 0);
  }

  // Favoritar (delegação, funciona em todas as listas)
  view.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-fav]");
    if (!btn) return;
    const favs = lerFavs();
    const id = btn.dataset.fav;
    favs.has(id) ? favs.delete(id) : favs.add(id);
    gravar(FAV_KEY, [...favs]);
    if (location.hash === "#/favoritos") render();
    else btn.classList.toggle("fav", favs.has(id));
  });

  window.addEventListener("hashchange", render);

  // A cada abertura, confere de novo os acessos (pega liberações novas
  // e derruba quem foi removido).
  async function iniciar() {
    const email = ler(EMAIL_KEY, "");
    if (!email) return telaLogin();
    document.body.classList.add("deslogado");
    view.innerHTML = '<div class="vazio"><div>⏳</div>Carregando...</div>';
    try {
      const d = await buscarDados(email);
      if (!d.autorizado) { gravar(EMAIL_KEY, null); return telaLogin("Seu acesso não foi encontrado. Fale com o suporte."); }
      aplicarDados(d);
      document.body.classList.remove("deslogado");
      render();
    } catch {
      view.innerHTML = `<div class="vazio"><div>📡</div>Sem conexão.<br><button class="botao" id="tentar">Tentar de novo</button></div>`;
      document.getElementById("tentar").onclick = iniciar;
    }
  }
  iniciar();

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
