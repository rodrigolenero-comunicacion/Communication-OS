"use client";

/** Error de servidor en una vista: mensaje comprensible y referencia para buscar en los logs. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="max-w-xl rounded-lg border border-bad/30 bg-bad/5 p-4">
      <h1 className="text-lg font-semibold">No se pudo cargar esta vista</h1>
      <p className="mt-1 text-sm">
        Ocurrió un error en el servidor. No se guardó ningún cambio parcial: las operaciones son transaccionales.
      </p>
      {error.digest && <p className="mt-2 text-xs text-muted">Referencia para los logs: {error.digest}</p>}
      <button onClick={reset} className="btn mt-3 border border-line bg-paper">Reintentar</button>
    </div>
  );
}
