(() => {
  const cfg = window.APP_CONFIG;
  const sb = supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
  const view = document.getElementById("view");
  const BUCKET = "arquivos";

  document.documentElement.style.setProperty("--verde", cfg.corPrincipal);
  document.getElementById("logo").textContent = "⚙";

  const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const urlArquivo = (p) =>
    !p ? "" : /^https?:|^img\//.test(p) ? p : `${cfg.supabaseUrl}/storage/v1/object/public/${BUCKET}/${p}`;

  let timerToast;
  function toast(msg, erro = false) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.className = `toast on ${erro ? "erro" : ""}`;
    clearTimeout(timerToast);
    timerToast = setTimeout(() => (t.className = "toast"), 3000);
  }

  // Lança o erro do Supabase para cair no catch de quem chamou.
  const ok = ({ data, error }) => { if (error) throw error; return data; };

  async function enviarArquivo(pasta, file) {
    const ext = file.name.split(".").pop().toLowerCase();
    const caminho = `${pasta}/${crypto.randomUUID()}.${ext}`;
    ok(await sb.storage.from(BUCKET).upload(caminho, file, { contentType: file.type }));
    return caminho;
  }
  async function apagarArquivos(caminhos) {
    const lista = caminhos.filter((c) => c && !/^https?:|^img\//.test(c));
    if (lista.length) await sb.storage.from(BUCKET).remove(lista);
  }

  // ---------- Estado ----------
  let produtos = [], alunos = [], acessos = [], materiais = [], avisos = [];
  let avisosAtivo = true; // false se o avisos.sql ainda não foi rodado
  let aba = "alunos";
  let editando = null; // produto aberto no editor (objeto, ou {} para novo)
  let filtro = "";

  async function carregar() {
    [produtos, alunos, acessos, materiais] = await Promise.all([
      sb.from("produtos").select("*").order("ordem").order("criado_em").then(ok),
      sb.from("alunos").select("*").order("criado_em", { ascending: false }).then(ok),
      sb.from("acessos").select("*").then(ok),
      sb.from("materiais").select("*").order("ordem").order("criado_em").then(ok),
    ]);
    const r = await sb.from("avisos").select("*").order("fixado", { ascending: false }).order("criado_em", { ascending: false });
    avisosAtivo = !r.error;
    avisos = r.data || [];
  }

  const temAcesso = (email, pid) => acessos.some((a) => a.email === email && a.produto_id === pid);

  // ---------- Login ----------
  function telaLogin(msg = "") {
    document.getElementById("abas").hidden = true;
    document.getElementById("btn-sair").hidden = true;
    view.innerHTML = `
      <form class="login" id="form-login" style="min-height:auto;padding-top:60px">
        <h2>Entrar no painel</h2>
        <p>Use o e-mail e a senha de admin criados no Supabase.</p>
        <input class="campo" type="email" id="email" placeholder="E-mail" required autocomplete="username">
        <input class="campo" type="password" id="senha" placeholder="Senha" required autocomplete="current-password">
        <p class="erro">${esc(msg)}</p>
        <button class="botao grande">Entrar</button>
      </form>`;
    document.getElementById("form-login").onsubmit = async (e) => {
      e.preventDefault();
      const { error } = await sb.auth.signInWithPassword({
        email: document.getElementById("email").value.trim(),
        password: document.getElementById("senha").value,
      });
      if (error) {
        const motivos = {
          invalid_credentials: "E-mail ou senha incorretos.",
          email_not_confirmed: "Usuário não confirmado. No Supabase, recrie o usuário marcando “Auto Confirm User”.",
        };
        return telaLogin(motivos[error.code] || `Erro: ${error.message}`);
      }
      iniciar();
    };
  }

  async function iniciar() {
    const { data } = await sb.auth.getSession();
    if (!data.session) return telaLogin();
    const { data: admin } = await sb.rpc("is_admin");
    if (!admin) {
      await sb.auth.signOut();
      return telaLogin("Este e-mail não está cadastrado como admin (tabela admins).");
    }
    document.getElementById("abas").hidden = false;
    document.getElementById("btn-sair").hidden = false;
    view.innerHTML = '<div class="vazio"><div>⏳</div>Carregando...</div>';
    try {
      await carregar();
      render();
    } catch (err) {
      view.innerHTML = `<div class="vazio"><div>⚠️</div>${esc(err.message)}</div>`;
    }
  }

  document.getElementById("btn-sair").onclick = async () => { await sb.auth.signOut(); telaLogin(); };
  document.getElementById("abas").onclick = (e) => {
    const b = e.target.closest("[data-aba]");
    if (!b) return;
    aba = b.dataset.aba;
    editando = null;
    document.querySelectorAll("#abas button").forEach((x) => x.classList.toggle("ativo", x === b));
    render();
  };

  function render() {
    if (aba === "avisos") {
      view.innerHTML = telaAvisos();
      return ligarAvisos();
    }
    view.innerHTML = aba === "alunos" ? telaAlunos() : editando ? telaEditor() : telaProdutos();
    (aba === "alunos" ? ligarAlunos : editando ? ligarEditor : ligarProdutos)();
  }

  // ---------- Avisos ----------
  function telaAvisos() {
    if (!avisosAtivo) {
      return `<div class="painel"><h2>Avisos</h2>
        <p>Para ativar, rode o arquivo <b>avisos.sql</b> no Supabase → SQL Editor e recarregue esta página.</p></div>`;
    }
    const data = (s) => new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    return `
      <form class="painel" id="form-aviso">
        <h2>Novo aviso</h2>
        <label>Título</label>
        <input class="campo" name="titulo" required placeholder="Ex: Novo livro de receitas liberado!">
        <label>Mensagem</label>
        <textarea class="campo" name="texto" placeholder="Escreva o aviso para os alunos"></textarea>
        <label>Link (opcional — vira um botão "Saiba mais")</label>
        <input class="campo" name="link" type="url" placeholder="https://...">
        <label class="chip" style="margin-top:12px;display:inline-flex"><input type="checkbox" name="fixado">📌 Fixar no topo</label>
        <div><button class="botao" style="margin-top:14px">Publicar aviso</button></div>
      </form>

      <div class="painel">
        <h2>Publicados (${avisos.length})</h2>
        ${avisos.map((a) => `
          <div class="aluno">
            <div class="aluno-topo">
              <strong>${a.fixado ? "📌 " : ""}${esc(a.titulo)} <small>· ${data(a.criado_em)}</small></strong>
              <button class="btn-mini" data-fixar="${a.id}">${a.fixado ? "Desafixar" : "Fixar"}</button>
              <button class="btn-mini perigo" data-apagar-aviso="${a.id}">Apagar</button>
            </div>
            ${a.texto ? `<p class="dica" style="white-space:pre-line">${esc(a.texto)}</p>` : ""}
          </div>`).join("") || '<p class="dica">Nenhum aviso publicado.</p>'}
      </div>`;
  }

  function ligarAvisos() {
    const form = document.getElementById("form-aviso");
    if (!form) return;
    form.onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(form);
      try {
        ok(await sb.from("avisos").insert({
          titulo: f.get("titulo").trim(),
          texto: f.get("texto").trim(),
          link: f.get("link").trim(),
          fixado: f.get("fixado") === "on",
        }));
        await carregar(); render(); toast("Aviso publicado.");
      } catch (err) { toast(err.message, true); }
    };
    view.querySelectorAll("[data-fixar]").forEach((b) => {
      b.onclick = async () => {
        const a = avisos.find((x) => x.id === b.dataset.fixar);
        try {
          ok(await sb.from("avisos").update({ fixado: !a.fixado }).eq("id", a.id));
          await carregar(); render();
        } catch (err) { toast(err.message, true); }
      };
    });
    view.querySelectorAll("[data-apagar-aviso]").forEach((b) => {
      b.onclick = async () => {
        if (!confirm("Apagar este aviso?")) return;
        try {
          ok(await sb.from("avisos").delete().eq("id", b.dataset.apagarAviso));
          await carregar(); render(); toast("Aviso apagado.");
        } catch (err) { toast(err.message, true); }
      };
    });
  }

  // ---------- Alunos ----------
  function telaAlunos() {
    const lista = alunos.filter((a) => (a.email + " " + a.nome).toLowerCase().includes(filtro.toLowerCase()));
    return `
      <form class="painel" id="form-aluno">
        <h2>Adicionar alunos</h2>
        <label>E-mails (um por linha, ou separados por vírgula)</label>
        <textarea class="campo" id="emails" placeholder="aluno@email.com" required></textarea>
        <label>Nome (opcional, só quando for um e-mail)</label>
        <input class="campo" id="nome" placeholder="Nome do aluno">
        <label>Liberar produtos</label>
        <div class="checks">
          ${produtos.map((p) => `<label class="chip"><input type="checkbox" value="${p.id}">${esc(p.emoji)} ${esc(p.titulo)}</label>`).join("")
            || '<p class="dica">Crie um produto na aba Produtos primeiro.</p>'}
        </div>
        <p class="dica">Se o aluno já existir, os produtos marcados são somados aos que ele já tem.</p>
        <button class="botao" style="margin-top:14px">Salvar</button>
      </form>

      <div class="painel">
        <h2>Alunos (${alunos.length})</h2>
        <input class="campo" id="filtro" placeholder="Buscar por e-mail ou nome" value="${esc(filtro)}">
        <p class="dica">Toque num produto para liberar ou bloquear.</p>
        ${lista.map((a) => `
          <div class="aluno">
            <div class="aluno-topo">
              <strong>${esc(a.email)} ${a.nome ? `<small>· ${esc(a.nome)}</small>` : ""}</strong>
              <button class="btn-mini perigo" data-remover="${esc(a.email)}">Remover</button>
            </div>
            <div class="checks">
              ${produtos.map((p) => `<span class="chip ${temAcesso(a.email, p.id) ? "on" : ""}" data-email="${esc(a.email)}" data-produto="${p.id}">${esc(p.emoji)} ${esc(p.titulo)}</span>`).join("")}
            </div>
          </div>`).join("") || '<p class="dica">Nenhum aluno encontrado.</p>'}
      </div>`;
  }

  function ligarAlunos() {
    document.getElementById("form-aluno").onsubmit = async (e) => {
      e.preventDefault();
      const emails = [...new Set(document.getElementById("emails").value
        .split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter((s) => s.includes("@")))];
      if (!emails.length) return toast("Nenhum e-mail válido.", true);
      const nome = emails.length === 1 ? document.getElementById("nome").value.trim() : "";
      const pids = [...e.target.querySelectorAll("input[type=checkbox]:checked")].map((c) => c.value);
      try {
        ok(await sb.from("alunos").upsert(emails.map((email) => (nome ? { email, nome } : { email })), { onConflict: "email" }));
        if (pids.length) {
          ok(await sb.from("acessos").upsert(
            emails.flatMap((email) => pids.map((produto_id) => ({ email, produto_id }))),
            { onConflict: "email,produto_id", ignoreDuplicates: true }));
        }
        await carregar();
        render();
        toast(`${emails.length} aluno(s) salvo(s).`);
      } catch (err) { toast(err.message, true); }
    };

    const filtroEl = document.getElementById("filtro");
    filtroEl.oninput = () => {
      filtro = filtroEl.value;
      render();
      const novo = document.getElementById("filtro");
      novo.focus(); novo.setSelectionRange(filtro.length, filtro.length);
    };

    view.querySelectorAll("[data-produto]").forEach((chip) => {
      chip.onclick = async () => {
        const { email, produto: produto_id } = chip.dataset;
        const liberar = !chip.classList.contains("on");
        try {
          ok(liberar
            ? await sb.from("acessos").insert({ email, produto_id })
            : await sb.from("acessos").delete().match({ email, produto_id }));
          if (liberar) acessos.push({ email, produto_id });
          else acessos = acessos.filter((a) => !(a.email === email && a.produto_id === produto_id));
          chip.classList.toggle("on", liberar);
        } catch (err) { toast(err.message, true); }
      };
    });

    view.querySelectorAll("[data-remover]").forEach((b) => {
      b.onclick = async () => {
        const email = b.dataset.remover;
        if (!confirm(`Remover ${email}? O aluno perde o acesso a tudo.`)) return;
        try {
          ok(await sb.from("alunos").delete().eq("email", email));
          await carregar(); render(); toast("Aluno removido.");
        } catch (err) { toast(err.message, true); }
      };
    });
  }

  // ---------- Produtos ----------
  function telaProdutos() {
    return `
      <div class="painel">
        <h2>Envio em massa</h2>
        <p class="dica">Selecione vários PDFs de uma vez. Cada arquivo vai para o produto com o mesmo nome
          (ignorando acentos, maiúsculas e sufixos como "_compressed"). Produtos que já têm PDF são pulados.</p>
        <label class="upload">
          📚 Toque para escolher os PDFs
          <input type="file" id="massa" accept="application/pdf" multiple>
        </label>
        <div id="massa-status" class="dica" style="white-space:pre-line;margin-top:10px"></div>
      </div>

      <div class="painel">
        <div class="linha" style="margin-bottom:12px">
          <h2 style="margin:0;flex:1">Produtos (${produtos.length})</h2>
          <button class="botao" id="novo" style="margin:0">+ Novo produto</button>
        </div>
        ${produtos.map((p) => {
          const n = materiais.filter((m) => m.produto_id === p.id).length;
          const donos = acessos.filter((a) => a.produto_id === p.id).length;
          return `
            <button class="prod" data-abrir="${p.id}">
              <span class="prod-capa" style="--cor:${esc(p.cor)};${p.capa ? `background-image:url('${esc(urlArquivo(p.capa))}')` : ""}">${p.capa ? "" : esc(p.emoji)}</span>
              <div><strong>${esc(p.titulo)}</strong><small>${n} PDF(s) · ${donos} aluno(s) com acesso</small></div>
            </button>`;
        }).join("") || '<p class="dica">Nenhum produto ainda. Crie o primeiro!</p>'}
      </div>`;
  }

  function ligarProdutos() {
    document.getElementById("novo").onclick = () => {
      editando = { titulo: "", descricao: "", emoji: "📄", cor: cfg.corPrincipal, capa: "", link_compra: "", ordem: produtos.length };
      render();
    };
    view.querySelectorAll("[data-abrir]").forEach((b) => {
      b.onclick = () => { editando = produtos.find((p) => p.id === b.dataset.abrir); render(); };
    });
    document.getElementById("massa").onchange = (e) => envioEmMassa([...e.target.files]);
  }

  const LIMITE_MB = 50; // limite por arquivo do plano grátis do Supabase
  const nomeBase = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/\.pdf$/, "")
    .replace(/\s*\(\d+\)$/, "") // cópias do Windows: "arquivo (1)"
    .replace(/[\s_-]+(compressed|comprimido|otimizado|compactado|min)$/, "")
    .replace(/[_\s]+/g, " ").trim();

  async function envioEmMassa(arquivos) {
    const status = document.getElementById("massa-status");
    const linhas = [];
    const mostrar = (txt) => { linhas.push(txt); status.textContent = linhas.join("\n"); };
    const porNome = new Map(produtos.map((p) => [nomeBase(p.titulo), p]));
    let enviados = 0;

    for (const file of arquivos) {
      const p = porNome.get(nomeBase(file.name));
      if (!p) { mostrar(`⚠️ ${file.name}: nenhum produto com esse nome`); continue; }
      if (materiais.some((m) => m.produto_id === p.id)) { mostrar(`⏭️ ${file.name}: "${p.titulo}" já tem PDF`); continue; }
      const mb = file.size / 1048576;
      if (mb > LIMITE_MB) { mostrar(`❌ ${file.name}: ${mb.toFixed(1)} MB (limite ${LIMITE_MB} MB)`); continue; }

      status.textContent = [...linhas, `⏳ Enviando ${file.name} (${mb.toFixed(1)} MB)...`].join("\n");
      try {
        const arquivo = await enviarArquivo("pdfs", file);
        const novo = ok(await sb.from("materiais").insert({ produto_id: p.id, titulo: p.titulo, arquivo }).select().single());
        materiais.push(novo);
        enviados++;
        mostrar(`✅ ${file.name} → ${p.titulo}`);
      } catch (err) {
        mostrar(`❌ ${file.name}: ${err.message}`);
      }
    }
    mostrar(`\nPronto: ${enviados} enviado(s) de ${arquivos.length}.`);
    toast(`${enviados} PDF(s) enviado(s).`);
  }

  function telaEditor() {
    const p = editando;
    const mats = materiais.filter((m) => m.produto_id === p.id);
    return `
      <a class="voltar" href="#" id="voltar">← Voltar</a>
      <form class="painel" id="form-produto">
        <h2>${p.id ? "Editar produto" : "Novo produto"}</h2>
        ${p.id ? `<p class="dica">ID (para usar em banners: <code>#/produto/ID</code>) — toque para copiar:<br><span class="id-copia" id="copiar-id">${p.id}</span></p>` : ""}
        <label>Nome</label>
        <input class="campo" name="titulo" value="${esc(p.titulo)}" required>
        <label>Descrição (aparece para quem ainda não comprou)</label>
        <textarea class="campo" name="descricao">${esc(p.descricao)}</textarea>
        <label>Link de compra (checkout)</label>
        <input class="campo" name="link_compra" type="url" value="${esc(p.link_compra)}" placeholder="https://pay.kiwify.com.br/...">
        <div class="linha">
          <div style="flex:1"><label>Emoji</label><input class="campo" name="emoji" value="${esc(p.emoji)}"></div>
          <div style="flex:1"><label>Cor</label><input class="campo" name="cor" type="color" value="${esc(p.cor)}" style="height:50px;padding:4px"></div>
          <div style="flex:1"><label>Ordem</label><input class="campo" name="ordem" type="number" value="${p.ordem ?? 0}"></div>
        </div>
        <label>Capa (imagem quadrada)</label>
        <div class="linha">
          <div class="capa-preview" id="capa-preview" style="--cor:${esc(p.cor)};${p.capa ? `background-image:url('${esc(urlArquivo(p.capa))}')` : ""}">${p.capa ? "" : esc(p.emoji)}</div>
          <div>
            <label class="btn-mini upload" style="display:inline-block;padding:10px 14px;margin:0">Escolher imagem<input type="file" id="capa" accept="image/*"></label>
            ${p.capa ? '<button type="button" class="btn-mini perigo" id="tirar-capa">Tirar capa</button>' : ""}
          </div>
        </div>
        <div class="linha" style="margin-top:18px">
          <button class="botao" style="margin:0">${p.id ? "Salvar alterações" : "Criar produto"}</button>
          ${p.id ? '<button type="button" class="btn-mini perigo" id="excluir">Excluir produto</button>' : ""}
        </div>
      </form>

      ${p.id ? `
        <div class="painel">
          <h2>PDFs (${mats.length})</h2>
          ${mats.map((m) => `
            <div class="material">
              <input class="campo" data-titulo="${m.id}" value="${esc(m.titulo)}">
              <a href="${esc(urlArquivo(m.arquivo))}" target="_blank" rel="noopener">Ver</a>
              <button class="btn-mini perigo" data-apagar="${m.id}">Apagar</button>
            </div>`).join("") || '<p class="dica">Nenhum PDF ainda.</p>'}
          <p class="dica">Edite o nome e clique fora para salvar.</p>
          <label class="upload" id="area-upload">
            📄 Toque para enviar PDFs (pode escolher vários)
            <input type="file" id="pdfs" accept="application/pdf" multiple>
          </label>
        </div>` : '<p class="dica" style="margin:0 16px">Depois de criar o produto, você poderá enviar os PDFs.</p>'}`;
  }

  function ligarEditor() {
    const p = editando;
    const form = document.getElementById("form-produto");
    let novaCapa = null;
    let tirarCapa = false;

    document.getElementById("voltar").onclick = (e) => { e.preventDefault(); editando = null; render(); };
    document.getElementById("copiar-id")?.addEventListener("click", () => {
      navigator.clipboard?.writeText(p.id).then(() => toast("ID copiado."));
    });

    document.getElementById("capa").onchange = (e) => {
      novaCapa = e.target.files[0];
      if (!novaCapa) return;
      tirarCapa = false;
      const prev = document.getElementById("capa-preview");
      prev.textContent = "";
      prev.style.backgroundImage = `url('${URL.createObjectURL(novaCapa)}')`;
    };
    document.getElementById("tirar-capa")?.addEventListener("click", (e) => {
      tirarCapa = true; novaCapa = null;
      const prev = document.getElementById("capa-preview");
      prev.style.backgroundImage = "";
      prev.textContent = form.emoji.value;
      e.target.remove();
    });

    form.onsubmit = async (e) => {
      e.preventDefault();
      const btn = form.querySelector(".botao");
      btn.disabled = true; btn.textContent = "Salvando...";
      try {
        const f = new FormData(form);
        const campos = {
          titulo: f.get("titulo").trim(),
          descricao: f.get("descricao").trim(),
          link_compra: f.get("link_compra").trim(),
          emoji: f.get("emoji").trim() || "📄",
          cor: f.get("cor"),
          ordem: Number(f.get("ordem")) || 0,
        };
        const capaAntiga = p.capa;
        if (novaCapa) campos.capa = await enviarArquivo("capas", novaCapa);
        else if (tirarCapa) campos.capa = "";

        const salvo = p.id
          ? ok(await sb.from("produtos").update(campos).eq("id", p.id).select().single())
          : ok(await sb.from("produtos").insert(campos).select().single());
        if ((novaCapa || tirarCapa) && capaAntiga) await apagarArquivos([capaAntiga]);

        await carregar();
        editando = produtos.find((x) => x.id === salvo.id);
        render();
        toast(p.id ? "Produto salvo." : "Produto criado! Agora envie os PDFs.");
      } catch (err) {
        toast(err.message, true);
        btn.disabled = false; btn.textContent = "Salvar";
      }
    };

    document.getElementById("excluir")?.addEventListener("click", async () => {
      if (!confirm(`Excluir "${p.titulo}" e todos os PDFs dele? Isso não pode ser desfeito.`)) return;
      try {
        const arquivos = materiais.filter((m) => m.produto_id === p.id).map((m) => m.arquivo);
        ok(await sb.from("produtos").delete().eq("id", p.id));
        await apagarArquivos([...arquivos, p.capa]);
        await carregar();
        editando = null; render(); toast("Produto excluído.");
      } catch (err) { toast(err.message, true); }
    });

    if (!p.id) return;

    view.querySelectorAll("[data-titulo]").forEach((inp) => {
      inp.onchange = async () => {
        try {
          ok(await sb.from("materiais").update({ titulo: inp.value.trim() }).eq("id", inp.dataset.titulo));
          materiais.find((m) => m.id === inp.dataset.titulo).titulo = inp.value.trim();
          toast("Nome salvo.");
        } catch (err) { toast(err.message, true); }
      };
    });

    view.querySelectorAll("[data-apagar]").forEach((b) => {
      b.onclick = async () => {
        const m = materiais.find((x) => x.id === b.dataset.apagar);
        if (!confirm(`Apagar "${m.titulo}"?`)) return;
        try {
          ok(await sb.from("materiais").delete().eq("id", m.id));
          await apagarArquivos([m.arquivo]);
          materiais = materiais.filter((x) => x.id !== m.id);
          render(); toast("PDF apagado.");
        } catch (err) { toast(err.message, true); }
      };
    });

    document.getElementById("pdfs").onchange = async (e) => {
      const arquivos = [...e.target.files];
      const area = document.getElementById("area-upload");
      const base = materiais.filter((m) => m.produto_id === p.id).length;
      let enviados = 0;
      for (const [i, file] of arquivos.entries()) {
        area.firstChild.textContent = `⏳ Enviando ${i + 1} de ${arquivos.length}: ${file.name}`;
        try {
          const arquivo = await enviarArquivo("pdfs", file);
          ok(await sb.from("materiais").insert({
            produto_id: p.id,
            titulo: file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim(),
            arquivo,
            ordem: base + i,
          }));
          enviados++;
        } catch (err) {
          toast(`${file.name}: ${err.message}`, true);
        }
      }
      await carregar();
      render();
      if (enviados) toast(`${enviados} PDF(s) enviado(s).`);
    };
  }

  iniciar();
})();
