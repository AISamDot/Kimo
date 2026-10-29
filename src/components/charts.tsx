// Small dependency-free SVG charts.
export function LineChart({
  series,
  height = 180,
  yMax = 100,
}: {
  series: { name: string; color: string; points: { x: string; y: number | null }[] }[];
  height?: number;
  yMax?: number;
}) {
  const n = Math.max(...series.map((s) => s.points.length), 0);
  if (n === 0) return <p className="text-sm text-muted">No data yet.</p>;
  const W = 600;
  const H = height;
  const pad = { l: 30, r: 10, t: 10, b: 22 };
  const x = (i: number) => pad.l + (n === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (n - 1));
  const y = (v: number) => pad.t + (1 - v / yMax) * (H - pad.t - pad.b);
  const labels = series[0]?.points.map((p) => p.x) ?? [];
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Score trend">
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={y(g)} y2={y(g)} stroke="var(--line)" strokeWidth="1" />
            <text x={pad.l - 6} y={y(g) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">
              {g}
            </text>
          </g>
        ))}
        {labels.map((l, i) =>
          n <= 12 || i % Math.ceil(n / 12) === 0 ? (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--muted)">
              {l}
            </text>
          ) : null,
        )}
        {series.map((s) => {
          const pts = s.points.map((p, i) => (p.y == null ? null : ([x(i), y(p.y)] as const))).filter(Boolean) as (readonly [number, number])[];
          return (
            <g key={s.name}>
              {pts.length > 1 && <polyline fill="none" stroke={s.color} strokeWidth="2.25" strokeLinejoin="round" points={pts.map((p) => p.join(",")).join(" ")} />}
              {pts.map(([px, py], i) => (
                <circle key={i} cx={px} cy={py} r="3.5" fill={s.color} />
              ))}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export const SERIES_COLORS = {
  overall: "var(--accent)",
  content: "#7a5cc2",
  delivery: "#c2763a",
  language: "#3b82c4",
  presence: "#b8487a",
};

export function heatColor(v: number | undefined) {
  if (v == null) return "var(--surface-2)";
  if (v >= 4) return "var(--good-soft)";
  if (v >= 3) return "var(--warn-soft)";
  return "var(--bad-soft)";
}
