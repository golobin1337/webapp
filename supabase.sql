-- =============================================================
--  Cole TUDO isto no Supabase → SQL Editor → Run
--  Antes, troque SEU_EMAIL_AQUI (última linha) pelo seu e-mail de admin.
-- =============================================================

create table if not exists produtos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text not null default '',
  emoji text not null default '📄',
  cor text not null default '#2e7d32',
  capa text not null default '',        -- caminho no Storage ou URL
  link_compra text not null default '', -- checkout (Kiwify, Hotmart, etc.)
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);

create table if not exists materiais (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references produtos on delete cascade,
  titulo text not null,
  descricao text not null default '',
  arquivo text not null,                -- caminho do PDF no Storage
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);

create table if not exists alunos (
  email text primary key check (email = lower(trim(email))),
  nome text not null default '',
  criado_em timestamptz not null default now()
);

create table if not exists acessos (
  email text not null references alunos on delete cascade on update cascade,
  produto_id uuid not null references produtos on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (email, produto_id)
);

create table if not exists admins (
  email text primary key
);

alter table produtos  enable row level security;
alter table materiais enable row level security;
alter table alunos    enable row level security;
alter table acessos   enable row level security;
alter table admins    enable row level security;

-- Quem está logado no painel com um e-mail da tabela admins?
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where email = lower(auth.jwt() ->> 'email'));
$$;

-- Só o admin lê/escreve as tabelas diretamente.
do $$
declare t text;
begin
  foreach t in array array['produtos', 'materiais', 'alunos', 'acessos'] loop
    execute format('drop policy if exists admin_tudo on %I', t);
    execute format('create policy admin_tudo on %I for all to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

-- O app do aluno chama só esta função: devolve os produtos,
-- e os PDFs apenas dos produtos liberados para aquele e-mail.
create or replace function app_dados(p_email text) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  v_email text := lower(trim(p_email));
begin
  if not exists (select 1 from alunos where email = v_email) then
    return json_build_object('autorizado', false);
  end if;

  return json_build_object(
    'autorizado', true,
    'nome', (select nome from alunos where email = v_email),
    'produtos', coalesce((
      select json_agg(x order by x.ordem, x.criado_em)
      from (
        select p.id, p.titulo, p.descricao, p.emoji, p.cor, p.capa, p.link_compra, p.ordem, p.criado_em,
               (a.email is not null) as liberado,
               (select count(*) from materiais m where m.produto_id = p.id) as total,
               case when a.email is null then '[]'::json else coalesce((
                 select json_agg(json_build_object(
                          'id', m.id, 'titulo', m.titulo, 'descricao', m.descricao, 'arquivo', m.arquivo)
                        order by m.ordem, m.criado_em)
                 from materiais m where m.produto_id = p.id), '[]'::json)
               end as materiais
        from produtos p
        left join acessos a on a.produto_id = p.id and a.email = v_email
      ) x
    ), '[]'::json)
  );
end $$;

revoke all on function app_dados(text) from public;
grant execute on function app_dados(text) to anon, authenticated;
grant execute on function is_admin() to authenticated;

-- Bucket público para PDFs e capas. Os arquivos recebem nomes aleatórios,
-- e o link só é entregue pelo app_dados para quem tem acesso.
insert into storage.buckets (id, name, public)
values ('arquivos', 'arquivos', true)
on conflict (id) do nothing;

drop policy if exists "admin le arquivos" on storage.objects;
drop policy if exists "admin envia arquivos" on storage.objects;
drop policy if exists "admin apaga arquivos" on storage.objects;
create policy "admin le arquivos" on storage.objects for select to authenticated
  using (bucket_id = 'arquivos' and public.is_admin());
create policy "admin envia arquivos" on storage.objects for insert to authenticated
  with check (bucket_id = 'arquivos' and public.is_admin());
create policy "admin apaga arquivos" on storage.objects for delete to authenticated
  using (bucket_id = 'arquivos' and public.is_admin());

-- 👇 TROQUE pelo seu e-mail (o mesmo que vai usar para entrar no painel)
insert into admins (email) values (lower('SEU_EMAIL_AQUI')) on conflict do nothing;

-- Depois deste arquivo, rode também o avisos.sql (ativa a aba Avisos).
