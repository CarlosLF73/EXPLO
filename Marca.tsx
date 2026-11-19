/** Logotipo textual de la app. */
export function Marca({ claro = false }: { claro?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-2 select-none">
      <span
        className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-wide"
        style={{ color: claro ? "var(--ink-text)" : "var(--text)" }}
      >
        EXPLO
      </span>
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: claro ? "#9fb0c4" : "var(--muted)" }}
      >
        LiquidMedia
      </span>
    </span>
  );
}
