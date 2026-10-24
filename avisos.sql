-- =============================================================
--  Ativa a aba "Avisos". Cole no Supabase → SQL Editor → Run.
--  Pode rodar mais de uma vez sem problema.
-- =============================================================

create table if not exists avisos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  texto text not null default '',
  link text not null default '',
  fixado boolean not null default false,
  criado_em timestamptz not null default now()
);

alter table avisos enable row level security;
drop policy if exists admin_tudo on avisos;
create policy admin_tudo on avisos for all to authenticated using (is_admin()) with check (is_admin());

-- Mesma função do supabase.sql, agora devolvendo também os avisos.
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
    ), '[]'::json),
    'avisos', coalesce((
      select json_agg(v order by v.fixado desc, v.criado_em desc)
      from (select id, titulo, texto, link, fixado, criado_em from avisos
            order by fixado desc, criado_em desc limit 50) v
    ), '[]'::json)
  );
end $$;

revoke all on function app_dados(text) from public;
grant execute on function app_dados(text) to anon, authenticated;
