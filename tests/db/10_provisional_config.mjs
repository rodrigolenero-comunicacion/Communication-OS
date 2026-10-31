// Aplica 0008 sobre una base con clientes existentes (como producción) y verifica
// la configuración provisional D3: colores por slug, 4 ejes Tec provisionales, IJLV sin ejes (D2).
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname;
const db = `${process.argv[2]}_pre`;
const psql = (d, args) => execFileSync("psql", ["-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-d", d, ...args], { encoding: "utf8" }).trim();
const ok = (cond, label) => { console.log(`${cond ? "PASS" : "FAIL"}: ${label}`); if (!cond) process.exitCode = 1; };

psql("postgres", ["-c", `drop database if exists ${db} with (force)`, "-c", `create database ${db}`]);
psql(db, ["-f", join(root, "tests/db/_auth_shim.sql")]);
const migrations = readdirSync(join(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
const calendarIndex = migrations.findIndex((m) => m.includes("_calendar_first"));
for (const m of migrations.slice(0, calendarIndex)) psql(db, ["-f", join(root, "supabase/migrations", m)]);
psql(db, ["-c", "insert into public.brands (name, slug) values ('Tecnológico de Monterrey','tec'),('Instituto Juan Luis Vives','ijlv'),('Solotu.IA','solotu'),('Otra','otra')"]);
const brainIndex = migrations.findIndex((m) => m.includes("_client_brain"));
for (const m of migrations.slice(calendarIndex, brainIndex)) psql(db, ["-f", join(root, "supabase/migrations", m)]);

const colors = psql(db, ["-c", "select string_agg(slug || '=' || color || '/' || coalesce(short_label,''), ',' order by slug) from public.brands"]);
ok(colors === "ijlv=yellow/IJLV,otra=gray/,solotu=purple/SOLOTU,tec=blue/TEC", `Colores provisionales por slug (${colors})`);
const tec = psql(db, ["-c", "select count(*) || ':' || bool_and(provisional) || ':' || bool_and(source_note like 'Provisional%') from public.brand_axes a join public.brands b on b.id = a.brand_id where b.slug = 'tec' and a.kind = 'pillar'"]);
ok(tec === "4:true:true", `4 ejes Tec marcados como provisionales con nota (${tec})`);
const names = psql(db, ["-c", "select string_agg(name, '|' order by sort) from public.brand_axes"]);
ok(names === "Vivencia Tec|Cultura Tec|Nuestra Huella|Modelo Tec", `Nombres y orden de ejes Tec (${names})`);
const ijlv = psql(db, ["-c", "select count(*) from public.brand_axes a join public.brands b on b.id = a.brand_id where b.slug = 'ijlv'"]);
ok(ijlv === "0", "IJLV sin ejes hasta incorporar v1.4 (D2)");
const origins = psql(db, ["-c", "select string_agg(slug || '=' || array_to_string(content_origins, '+'), ',' order by slug) from public.brands"]);
ok(origins === "ijlv=organic,otra=organic,solotu=organic,tec=organic+event_coverage+existing_material", `Orígenes por cliente: Tec los tres, resto orgánico (${origins})`);
const pieces = psql(db, ["-c", "select count(*) from public.content_pieces"]);
ok(pieces === "0", "La migración no crea contenido");

// V0.3: carga inicial del Client Brain sobre la misma base (como en producción).
for (const m of migrations.slice(brainIndex)) psql(db, ["-f", join(root, "supabase/migrations", m)]);
const q = (sql) => psql(db, ["-c", sql]);
const brand = (slug) => `(select id from public.brands where slug = '${slug}')`;
ok(q(`select count(*) from public.brain_entries where brand_id = ${brand("otra")}`) === "0" &&
   q(`select count(*) from public.source_references where brand_id = ${brand("otra")}`) === "0", "Cliente sin fuente no recibe contenido");
ok(q(`select string_agg(content, '|' order by sort) from public.brain_entries where brand_id = ${brand("ijlv")} and category = 'identity'`) === "Aprender a ser|Educando con amor",
   "IJLV: campaña madre y lema");
ok(q(`select string_agg(coalesce(code, '') || name, '|' order by kind, sort) from public.brand_axes where brand_id = ${brand("ijlv")}`) ===
   "P1Aquí aprendemos|P2Pequeños grandes pasos|P3Crecer juntos|P4La vida en el Vives|Humanidad|Pensamiento|Proceso|Mundo",
   "IJLV: pilares y territorios en brand_axes (sin duplicar en el Brain)");
ok(q(`select string_agg(document_version || ':' || status, ',' order by document_version) from public.source_references where brand_id = ${brand("ijlv")}`) === "1.2:superseded,1.4:active",
   "IJLV: v1.4 activa y v1.2 superseded");
ok(q(`select count(*) from public.brain_entries e join public.source_references s on s.id = e.source_reference_id where e.brand_id = ${brand("ijlv")} and s.document_version = '1.4'`) ===
   q(`select count(*) from public.brain_entries where brand_id = ${brand("ijlv")}`), "IJLV: todas sus entradas rastreables a la v1.4");
ok(q(`select count(*) from public.brain_entries where brand_id = ${brand("ijlv")} and category = 'segment'`) === "4" &&
   q(`select count(*) from public.accounts where brand_id = ${brand("ijlv")}`) === "0", "IJLV: etapas como segmentos, no como cuentas");
ok(q(`select bool_and(a.provisional) || ':' || bool_and(s.status = 'provisional') from public.brand_axes a join public.source_references s on s.id = a.source_reference_id where a.brand_id = ${brand("tec")}`) === "true:true",
   "Tec: ejes siguen provisionales y su fuente también");
ok(q(`select count(*) from public.brain_entries where brand_id = ${brand("tec")} and category in ('voice','editorial_rule')`) === "13", "Tec: 13 reglas de voz/editoriales");
ok(q(`select count(*) from public.brain_entries where brand_id = ${brand("solotu")}`) === "6" &&
   q(`select title from public.source_references where brand_id = ${brand("solotu")}`) === "Solotu_Cerebro", "Solotu: 6 entradas con Solotu_Cerebro como fuente");
const leak = q(`select count(*) from public.brain_entries e join public.source_references s on s.id = e.source_reference_id where s.brand_id <> e.brand_id`);
const sharedTitles = q(`select count(*) from public.brain_entries a join public.brain_entries b on a.title = b.title and a.brand_id <> b.brand_id`);
ok(leak === "0" && sharedTitles === "0", "Sin contaminación entre clientes (fuentes ni reglas compartidas)");
ok(q(`select count(*) from public.content_pieces`) === "0", "La carga del Brain no crea contenido");
psql("postgres", ["-c", `drop database if exists ${db} with (force)`]);
