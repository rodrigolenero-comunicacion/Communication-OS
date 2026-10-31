import { loadContext, newRequestId } from "@/application/context";
import type { AxisRow } from "@/infrastructure/data";
import { CommandForm } from "@/components/CommandForm";
import { BUCKET_LABEL, HEALTH_LABEL, HEALTH_TONE, SOURCE_LABEL, fmtDate, fmtWeek } from "@/components/format";
import { Badge, Card, Details, Empty, Field, PageHeader, SafeLink, Section } from "@/components/ui";
import { horizonWeeks } from "@/domain/planning";
import { currentWeekStart } from "@/domain/time";

/** Valores documentados en las fuentes recibidas. Se ofrecen con atribución; nunca se activan solos. */
const REFERENCE_TARGETS = [
  "Campus Puebla: feed 5/semana (manual ST Hub, baseline dbbd5bf)",
  "PrepaTec Puebla: feed 4/semana (manual ST Hub)",
  "Directora / Rectora: sin cuota (manual ST Hub)",
  "IJLV: mínimo 3/semana (Sistema Editorial IJLV v1.2)",
  "Solotu.IA: sin frecuencia verificada",
  "Stories Tec: 3 diarias en ST Hub; no se convierte a cuota semanal",
];

export default async function PortfolioPage() {
  const { snapshot, reports } = await loadContext();
  const { brands, accounts, channels, accountChannels, targetRows, references, now, axes } = snapshot;
  const mondays = horizonWeeks(now, 13);
  const w0 = currentWeekStart(now);

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle="Marcas, cuentas editoriales, canales activos y objetivos semanales. Los objetivos se configuran con tu confirmación; no hay valores precargados."
      />

      <Section title="Marcas y cuentas">
        {brands.length === 0 && <Empty>No hay marcas. Crea la primera abajo o usa el portfolio sugerido en Control Tower.</Empty>}
        <div className="space-y-6">
          {brands.map((brand) => (
            <Card key={brand.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className={`client-${brand.color ?? "gray"}`}>
                  <h3 className="text-lg font-semibold">
                    <span className="client-dot mr-2" aria-hidden="true" />
                    {brand.name} <span className="client-tag text-sm">{brand.short_label}</span>
                  </h3>
                  {!brand.active && <Badge>Inactivo</Badge>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Details summary="Editar cliente">
                    <CommandForm command="update_brand" requestId={newRequestId()} hidden={{ brand_id: brand.id, expected_version: brand.version }} submitLabel="Guardar">
                      <Field label="Nombre"><input name="name" defaultValue={brand.name} required className="input" /></Field>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={brand.active} /> Activo</label>
                    </CommandForm>
                  </Details>
                  {snapshot.formats.length > 0 && (
                    <Details summary="Apariencia">
                      <CommandForm command="set_brand_appearance" requestId={newRequestId()} hidden={{ brand_id: brand.id, expected_version: brand.version }} submitLabel="Guardar">
                        <Field label="Color en el calendario" hint="Siempre se muestra junto a la etiqueta.">
                          <select name="color" defaultValue={brand.color ?? "gray"} className="input">
                            {Object.entries(COLOR_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        </Field>
                        <Field label="Etiqueta corta (máx. 12)"><input name="short_label" defaultValue={brand.short_label ?? ""} maxLength={12} className="input" /></Field>
                      </CommandForm>
                    </Details>
                  )}
                </div>
              </div>

              {snapshot.formats.length > 0 && (
                <div className="mt-4 rounded-md border border-line p-3">
                  <h4 className="text-sm font-semibold">Pilares y territorios</h4>
                  {axes.filter((x) => x.brand_id === brand.id).length === 0 ? (
                    <p className="mt-1 text-sm text-muted">Sin ejes configurados.</p>
                  ) : (
                    <ul className="mt-2 space-y-2 text-sm">
                      {axes.filter((x) => x.brand_id === brand.id).map((x) => (
                        <li key={x.id}>
                          <Details summary={`${x.kind === "pillar" ? "Pilar" : "Territorio"} · ${x.code ? `${x.code} · ` : ""}${x.name}${x.provisional ? " · provisional" : ""}${x.active ? "" : " · inactivo"}`}>
                            {x.source_note && <p className="mb-2 text-xs text-warn">{x.source_note}</p>}
                            <AxisForm axis={x} brandId={brand.id} />
                          </Details>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-2">
                    <Details summary="Agregar pilar o territorio">
                      <AxisForm brandId={brand.id} />
                    </Details>
                  </div>
                </div>
              )}

              <div className="mt-4 space-y-4">
                {accounts.filter((a) => a.brand_id === brand.id).map((account) => {
                  const report = reports.get(account.id)!;
                  const targets = targetRows.filter((t) => t.account_id === account.id);
                  const open = targets.filter((t) => t.active_until === null || t.active_until > w0);
                  return (
                    <div key={account.id} id={account.id} className="rounded-md border border-line p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold">{account.name}</h4>
                        <Badge tone={HEALTH_TONE[report.health]}>{HEALTH_LABEL[report.health]}</Badge>
                        {!account.active && <Badge>Inactiva</Badge>}
                      </div>
                      {account.context_notes && <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{account.context_notes}</p>}

                      <div className="mt-3 grid gap-4 lg:grid-cols-2">
                        <div>
                          <h5 className="text-sm font-semibold">Canales</h5>
                          <ul className="mt-1 space-y-1">
                            {channels.map((ch) => {
                              const active = accountChannels.some((ac) => ac.account_id === account.id && ac.channel_id === ch.id && ac.active);
                              return (
                                <li key={ch.id} className="flex items-center gap-2 text-sm">
                                  <span className="w-24">{ch.name}</span>
                                  <Badge tone={active ? "good" : "neutral"}>{active ? "Activo" : "Inactivo"}</Badge>
                                  <CommandForm command="set_account_channel" requestId={newRequestId()} inline tone="secondary"
                                    hidden={{ account_id: account.id, channel_key: ch.key, active: active ? "false" : "true" }}
                                    submitLabel={active ? "Desactivar" : "Activar"} />
                                </li>
                              );
                            })}
                          </ul>
                          <p className="mt-1 text-xs text-muted">No se guardan handles, contraseñas ni tokens de redes.</p>
                        </div>

                        <div>
                          <h5 className="text-sm font-semibold">Objetivos semanales</h5>
                          {targets.length === 0 ? (
                            <p className="text-sm text-muted">
                              {account.coverage_mode === "not_required" ? "Sin cuota (declarado)." : "Sin objetivo configurado."}
                            </p>
                          ) : (
                            <ul className="mt-1 space-y-2 text-sm">
                              {targets.map((t) => {
                                const isOpen = t.active_until === null || t.active_until > w0;
                                return (
                                  <li key={t.id}>
                                    {BUCKET_LABEL[t.bucket]}: <strong>{t.required_count}</strong> pieza(s)/semana · buffer {t.buffer_target_days} día(s) ·
                                    desde {fmtDate(t.active_from)} {t.active_until ? `hasta ${fmtDate(t.active_until)} (exclusivo)` : "sin fin"}
                                    {isOpen && (
                                      <CommandForm command="end_target_policy" requestId={newRequestId()} inline tone="secondary" className="mt-1"
                                        hidden={{ target_id: t.id }} submitLabel="Cerrar vigencia">
                                        <select name="active_until" className="input w-auto" aria-label="Fin de vigencia (lunes, exclusivo)">
                                          {mondays.map((m) => <option key={m} value={m}>lunes {fmtDate(m)}</option>)}
                                        </select>
                                      </CommandForm>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 lg:grid-cols-3">
                        <Details summary="Configurar objetivo">
                          <CommandForm command="set_target_policy" requestId={newRequestId()} hidden={{ account_id: account.id }} submitLabel="Guardar objetivo">
                            <p className="text-xs text-muted">
                              Mide piezas editoriales por semana, no publicaciones por canal. Un cambio en la semana actual recalcula esa semana.
                            </p>
                            <Field label="Bucket">
                              <select name="bucket" className="input"><option value="feed">Feed</option><option value="stories">Stories</option></select>
                            </Field>
                            <Field label="Piezas por semana"><input name="required_count" type="number" min={1} max={200} required className="input" /></Field>
                            <Field label="Buffer objetivo (días)"><input name="buffer_target_days" type="number" min={0} max={365} defaultValue={7} required className="input" /></Field>
                            <Field label="Vigente desde (lunes)">
                              <select name="active_from" className="input">
                                {mondays.map((m) => <option key={m} value={m}>{fmtWeek(m)}</option>)}
                              </select>
                            </Field>
                          </CommandForm>
                        </Details>
                        <Details summary="Editar cuenta">
                          <CommandForm command="update_account" requestId={newRequestId()} hidden={{ account_id: account.id, expected_version: account.version }} submitLabel="Guardar">
                            <Field label="Nombre"><input name="name" defaultValue={account.name} required className="input" /></Field>
                            <Field label="Notas de contexto"><textarea name="context_notes" defaultValue={account.context_notes ?? ""} rows={3} className="input" /></Field>
                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={account.active} /> Activa</label>
                          </CommandForm>
                        </Details>
                        <Details summary="Modo de cobertura">
                          <p className="mb-2 text-sm">Actual: <strong>{account.coverage_mode === "weekly" ? "Semanal" : account.coverage_mode === "not_required" ? "Sin cuota" : "Sin configurar"}</strong></p>
                          {open.length > 0 ? (
                            <p className="text-xs text-muted">Para declarar «sin cuota» cierra antes las políticas vigentes o futuras.</p>
                          ) : (
                            <CommandForm command="set_coverage_mode" requestId={newRequestId()} hidden={{ account_id: account.id, expected_version: account.version }} submitLabel="Cambiar modo" tone="secondary">
                              <Field label="Modo">
                                <select name="mode" className="input">
                                  <option value="not_required">Sin cuota (decisión deliberada)</option>
                                  <option value="unconfigured">Sin configurar</option>
                                </select>
                              </Field>
                              <Field label="Motivo" hint="Obligatorio para «sin cuota»."><input name="reason" className="input" /></Field>
                            </CommandForm>
                          )}
                        </Details>
                      </div>
                    </div>
                  );
                })}
                <Details summary={`Nueva cuenta en ${brand.name}`}>
                  <CommandForm command="create_account" requestId={newRequestId()} hidden={{ brand_id: brand.id }} submitLabel="Crear cuenta">
                    <Field label="Nombre"><input name="name" required className="input" /></Field>
                    <Field label="Identificador" hint="Minúsculas, números y guiones (p. ej. campus-puebla)."><input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" className="input" /></Field>
                    <Field label="Notas de contexto"><textarea name="context_notes" rows={2} className="input" /></Field>
                  </CommandForm>
                </Details>
              </div>
            </Card>
          ))}
        </div>
        <div className="mt-4 max-w-md">
          <Details summary="Nueva marca">
            <CommandForm command="create_brand" requestId={newRequestId()} submitLabel="Crear marca">
              <Field label="Nombre"><input name="name" required className="input" /></Field>
              <Field label="Identificador" hint="Minúsculas, números y guiones."><input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" className="input" /></Field>
            </CommandForm>
          </Details>
        </div>
      </Section>

      <Section title="Referencias documentales de frecuencia" description="Solo información atribuida para ayudarte a decidir. Nada de esto está activado.">
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          {REFERENCE_TARGETS.map((r) => <li key={r}>{r}</li>)}
        </ul>
      </Section>

      <Section
        title="Fuentes de contexto"
        description="Referencias que respaldan claims o piezas locales. No cambian el ownership y solo sirven dentro de su ámbito (cuenta, marca o pública general)."
      >
        {references.filter((r) => r.relation_kind === "context_reference").length === 0 ? (
          <Empty>Sin fuentes registradas.</Empty>
        ) : (
          <ul className="space-y-1 text-sm">
            {references.filter((r) => r.relation_kind === "context_reference").map((r) => (
              <li key={r.id}>
                <SafeLink href={r.source_url}>{r.title}</SafeLink> · {SOURCE_LABEL[r.source_system]} · ámbito{" "}
                {r.scope_kind === "account" ? `cuenta ${accounts.find((a) => a.id === r.account_id)?.name}` :
                  r.scope_kind === "brand" ? `marca ${brands.find((b) => b.id === r.brand_id)?.name}` : "público general"}
                {r.locator && <span className="text-muted"> · {r.locator}</span>}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 max-w-xl">
          <Details summary="Registrar fuente">
            <CommandForm command="create_context_reference" requestId={newRequestId()} submitLabel="Registrar fuente">
              <Field label="Título"><input name="title" required className="input" /></Field>
              <Field label="Sistema"><select name="source_system" className="input">{Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="Ámbito">
                <select name="scope_kind" className="input">
                  <option value="account">Cuenta</option><option value="brand">Marca</option><option value="public_general">Público general (sin datos privados)</option>
                </select>
              </Field>
              <Field label="Cuenta (si el ámbito es cuenta)">
                <select name="account_id" className="input"><option value="">—</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
              </Field>
              <Field label="Marca (si el ámbito es marca)">
                <select name="brand_id" className="input"><option value="">—</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
              </Field>
              <Field label="URL (http/https)"><input name="source_url" type="url" className="input" /></Field>
              <Field label="Localizador" hint="Sección, página o identificador dentro de la fuente."><input name="locator" className="input" /></Field>
            </CommandForm>
          </Details>
        </div>
      </Section>
    </>
  );
}

const COLOR_LABEL: Record<string, string> = {
  blue: "Azul", yellow: "Amarillo", purple: "Morado", green: "Verde", red: "Rojo",
  teal: "Turquesa", orange: "Naranja", pink: "Rosa", gray: "Gris",
};

function AxisForm({ axis, brandId }: { axis?: AxisRow; brandId: string }) {
  return (
    <CommandForm command="upsert_brand_axis" requestId={newRequestId()} submitLabel="Guardar"
      hidden={{ axis_id: axis?.id, expected_version: axis?.version, brand_id: brandId }}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Tipo">
          {axis ? (
            <><input type="hidden" name="kind" value={axis.kind} /><span className="text-sm">{axis.kind === "pillar" ? "Pilar" : "Territorio"}</span></>
          ) : (
            <select name="kind" className="input"><option value="pillar">Pilar</option><option value="territory">Territorio</option></select>
          )}
        </Field>
        <Field label="Código (opcional)"><input name="code" defaultValue={axis?.code ?? ""} maxLength={12} className="input" /></Field>
        <Field label="Orden"><input name="sort" type="number" defaultValue={axis?.sort ?? 0} className="input" /></Field>
      </div>
      <Field label="Nombre"><input name="name" defaultValue={axis?.name ?? ""} required className="input" /></Field>
      <Field label="Nota de fuente" hint="De dónde sale este eje (documento, versión, fecha)."><input name="source_note" defaultValue={axis?.source_note ?? ""} className="input" /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="provisional" defaultChecked={axis?.provisional ?? false} /> Provisional (pendiente de validar contra fuente)</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={axis?.active ?? true} /> Activo</label>
    </CommandForm>
  );
}
