-- =============================================================
--  Cria os 16 produtos (vazios). Cole no Supabase → SQL Editor → Run.
--  Pode rodar mais de uma vez: produtos com o mesmo nome não são duplicados.
--  Depois, no painel de admin (aba Produtos), abra cada um e envie o PDF.
-- =============================================================

insert into produtos (titulo, emoji, cor, descricao, ordem)
select v.titulo, v.emoji, v.cor, v.descricao, v.ordem
from (values
  ('+350 Marmitas pra Congelar',              '🍱', '#2e7d32', 'Mais de 350 marmitas para preparar de uma vez e congelar.', 1),
  ('272 Marmitas Proteicas Fit',              '💪', '#1b5e20', 'Marmitas ricas em proteína para quem treina ou quer emagrecer.', 2),
  ('Guia de Congelamento',                    '❄️', '#0277bd', 'Como congelar e descongelar cada alimento do jeito certo.', 3),
  ('+200 Café da Manhã e Lanches',            '🥪', '#ef6c00', 'Ideias rápidas para o café da manhã e os lanches do dia.', 5),
  ('196 Cafés da Manhã na Air Fryer',         '☕', '#6d4c41', 'Cafés da manhã práticos feitos na air fryer.', 6),
  ('80 Receitas na Air Fryer',                '🍟', '#f57f17', 'Receitas variadas e fáceis para fazer na air fryer.', 7),
  ('70 Receitas de Frango',                   '🍗', '#e65100', 'Frango de 70 jeitos diferentes, do simples ao especial.', 8),
  ('180 Receitas com Carne Moída',            '🥩', '#b71c1c', 'Carne moída versátil para o almoço e o jantar.', 9),
  ('180 Receitas de Caldos, Sopas e Cremes',  '🍲', '#8d6e63', 'Caldos, sopas e cremes nutritivos que congelam muito bem.', 10),
  ('365 Maneiras de Comer Ovo',               '🍳', '#f9a825', 'Uma receita com ovo para cada dia do ano.', 11),
  ('+20 Molhos que Viciam',                   '🥫', '#c62828', 'Molhos caseiros para transformar qualquer prato.', 12),
  ('+160 Petiscos de Boteco',                 '🍢', '#5d4037', 'Petiscos de boteco para receber os amigos.', 13),
  ('Bolos Saudáveis para o Dia a Dia',        '🍰', '#ad1457', 'Bolos gostosos e mais leves para o dia a dia.', 14),
  ('Livro Sem Açúcar',                        '🍓', '#c2185b', 'Receitas doces e salgadas sem açúcar.', 15),
  ('Livro Sem Glúten',                        '🌾', '#827717', 'Receitas sem glúten para todas as refeições.', 16),
  ('Congela Kids',                            '🧒', '#00897b', '200 receitas nutritivas que as crianças comem com gosto, em 5 volumes.', 17)
) as v(titulo, emoji, cor, descricao, ordem)
where not exists (select 1 from produtos p where p.titulo = v.titulo);

-- Confere o resultado
select ordem, emoji, titulo from produtos order by ordem;
