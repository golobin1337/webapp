# Como colocar o app no ar

## 1. Criar o Supabase (uma vez só)

1. Crie uma conta em https://supabase.com e clique em **New project** (o plano grátis serve).
2. No menu da esquerda, abra **SQL Editor**, cole todo o conteúdo do arquivo `supabase.sql`,
   troque `SEU_EMAIL_AQUI` (última linha) pelo seu e-mail e clique em **Run**.
3. Vá em **Authentication → Users → Add user → Create new user**.
   Use o **mesmo e-mail** do passo anterior, crie uma senha e marque **Auto Confirm User**.
4. Vá em **Authentication → Sign In / Providers** e **desligue** "Allow new users to sign up".
5. Vá em **Project Settings → API Keys** (ou **Data API**) e copie:
   - a **Project URL** (`https://xxxx.supabase.co`)
   - a chave **anon** / **publishable** (nunca a `service_role` / `secret`)
6. Abra o arquivo `config.js` e cole esses dois valores em `supabaseUrl` e `supabaseKey`.

## 2. Publicar

O app está publicado na Vercel a partir do GitHub (repositório privado).
Cada envio para o GitHub atualiza o site sozinho.

- **App do aluno:** https://appreceitas-kappa.vercel.app
- **Seu painel:** o arquivo `painel-….html` desta pasta. O endereço é de propósito
  difícil de adivinhar — não divulgue e não coloque em arquivos públicos.

Sempre que mudar algum arquivo daqui (ex: `config.js`), envie para o GitHub.
Produtos, PDFs e alunos **não** precisam republicar: é tudo pelo painel.

## 3. Usar o painel

**Produtos:** "+ Novo produto" → nome, descrição, link de compra, capa → Criar.
Depois envie os PDFs (pode escolher vários de uma vez).

**Alunos:** cole o e-mail (ou vários, um por linha), marque os produtos e salve.
Na lista, toque num produto ao lado do aluno para liberar ou bloquear.

O aluno entra no app só com o e-mail. Produtos que ele não tem aparecem com cadeado
e o botão "Quero desbloquear", que leva ao link de compra.

## Personalizar

- **Logo:** salve como `img/logo.jpg`
- **Banners, cor, nome, WhatsApp:** em `config.js`
- **Limite:** cada PDF pode ter até 50 MB no plano grátis do Supabase.
