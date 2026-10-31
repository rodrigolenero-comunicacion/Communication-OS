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
for (const m of migrations.slice(calendarIndex)) psql(db, ["-f", join(root, "supabase/migrations", m)]);

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
psql("postgres", ["-c", `drop database if exists ${db} with (force)`]);
