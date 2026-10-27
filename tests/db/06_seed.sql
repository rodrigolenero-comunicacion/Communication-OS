-- El seed de desarrollo carga, es reentrante y respeta las restricciones.
\ir ../../supabase/seed.sql
\ir ../../supabase/seed.sql
select test.ok((select count(*) from public.brands where slug = 'demo') = 1, 'Seed demo cargado una sola vez');
select test.ok((select count(*) from public.content_pieces where title not like '[DEMO]%') = 0, 'Todo lo sembrado está rotulado [DEMO]');
select test.ok((select count(*) from public.publications where status = 'scheduled' and scheduled_at < now()) = 1, 'Incluye una programación vencida');
