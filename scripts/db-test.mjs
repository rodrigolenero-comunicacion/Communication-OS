// Pruebas de integración PostgreSQL: base limpia por archivo, shim de auth,
// migraciones reales y casos en tests/db/NN_*.sql. Requiere psql y un servidor
// PostgreSQL local (PGHOST/PGPORT/PGUSER). No usa ningún proyecto Supabase.
import { execFileSync, spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const migrations = readdirSync(join(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
const only = process.argv[2];
const cases = readdirSync(join(root, "tests/db"))
  .filter((f) => /^\d+_.*\.(sql|mjs)$/.test(f) && (!only || f.includes(only)))
  .sort();

const psql = (db, args, opts = {}) =>
  execFileSync("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", db, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });

export function freshDatabase(name) {
  psql("postgres", ["-c", `drop database if exists ${name} with (force)`, "-c", `create database ${name}`]);
  psql(name, ["-f", join(root, "tests/db/_auth_shim.sql")]);
  for (const m of migrations) psql(name, ["-f", join(root, "supabase/migrations", m)]);
  psql(name, ["-f", join(root, "tests/db/_harness.sql")]);
}

function run(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code, out }));
  });
}

let failed = 0;
let passed = 0;
for (const file of cases) {
  const db = `cos_test_${file.replace(/\W/g, "_").toLowerCase()}`;
  try {
    freshDatabase(db);
  } catch (e) {
    console.error(`✗ ${file}: no se pudo preparar la base\n${e.stderr ?? e.message}`);
    failed++;
    continue;
  }
  const res = file.endsWith(".sql")
    ? await run("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", db, "-f", join(root, "tests/db", file)])
    : await run("node", [join(root, "tests/db", file), db]);
  const passes = (res.out.match(/PASS: /g) ?? []).length;
  passed += passes;
  if (res.code === 0 && !/FAIL: /.test(res.out)) {
    console.log(`✓ ${file} (${passes} aserciones)`);
  } else {
    failed++;
    console.log(`✗ ${file}\n${res.out.split("\n").filter((l) => /PASS|FAIL|ERROR|error/.test(l)).join("\n")}`);
  }
  if (process.env.VERBOSE) console.log(res.out);
}
console.log(`\nAserciones PASS: ${passed} · archivos con fallo: ${failed}`);
process.exit(failed ? 1 : 0);
