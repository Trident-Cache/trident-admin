/**
 * Trident Admin 2.0 presentational primitives (ported from admin2.0/primitives.jsx).
 * Pure/server-safe (no client hooks) so they can render in Server Components.
 */
import React from 'react';

// ---------------------------------------------------------------------------
// Icon
// ---------------------------------------------------------------------------
export type IconName =
  | 'dashboard' | 'cache' | 'purge' | 'backends' | 'dns' | 'bans' | 'launch'
  | 'denoise' | 'events' | 'config' | 'stats' | 'refresh' | 'search' | 'bell'
  | 'chev' | 'chevDown' | 'play' | 'pause' | 'plus' | 'close' | 'trash'
  | 'download' | 'filter' | 'arrowUp' | 'arrowDown' | 'info' | 'check' | 'eye'
  | 'warmer' | 'reflect' | 'queue';

const ICON_PATHS: Record<IconName, React.ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  cache: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>,
  purge: <><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></>,
  backends: <><rect x="3" y="4" width="18" height="6" rx="1.5" /><rect x="3" y="14" width="18" height="6" rx="1.5" /><path d="M7 7h.01M7 17h.01" /></>,
  dns: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a13 13 0 0 1 0 18M12 3a13 13 0 0 0 0 18" /></>,
  bans: <><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></>,
  launch: <><path d="M4.5 16.5l3 3M9 14l-4 7 7-4M14 3c4 0 7 3 7 7l-9 9-4-4 9-9c0-1.5-1.5-3-3-3z" /><circle cx="15" cy="9" r="1.5" /></>,
  denoise: <><circle cx="6" cy="12" r="2" /><circle cx="12" cy="6" r="2" /><circle cx="12" cy="18" r="2" /><circle cx="18" cy="12" r="2" /><path d="M7.5 11l3-3M13.5 8l3 3M16.5 13l-3 3M10.5 16l-3-3" /></>,
  events: <path d="M13 2L4.5 13H12l-1 9 8.5-11H13l0-9z" />,
  config: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4 1a7 7 0 0 0-2.1-1.2L14 3h-4l-.4 2.6a7 7 0 0 0-2.1 1.2l-2.4-1-2 3.5 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 2.1 1.2L10 21h4l.4-2.6a7 7 0 0 0 2.1-1.2l2.4 1 2-3.5-2-1.5c.1-.4.1-.8.1-1.2z" /></>,
  stats: <><path d="M3 20h18" /><rect x="5" y="12" width="3" height="6" /><rect x="11" y="6" width="3" height="12" /><rect x="17" y="9" width="3" height="9" /></>,
  refresh: <><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v5h-5" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0 -2 -3 -2 -3 -9z" /><path d="M10 21a2 2 0 0 0 4 0" /></>,
  chev: <path d="M9 6l6 6-6 6" />,
  chevDown: <path d="M6 9l6 6 6-6" />,
  play: <path d="M6 4l14 8-14 8z" />,
  pause: <><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  close: <path d="M6 6l12 12M18 6l-12 12" />,
  trash: <><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></>,
  download: <><path d="M12 3v14M5 12l7 7 7-7M3 21h18" /></>,
  filter: <path d="M3 4h18l-7 9v6l-4 2v-8z" />,
  arrowUp: <path d="M12 19V5M5 12l7-7 7 7" />,
  arrowDown: <path d="M12 5v14M5 12l7 7 7-7" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v5h1" /></>,
  check: <path d="M5 13l4 4L19 7" />,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  // new-feature icons
  warmer: <><path d="M12 3c0 4-4 5-4 9a4 4 0 0 0 8 0c0-1.5-1-2.5-1.5-3.5" /><path d="M12 21a4 4 0 0 1-4-4" /></>,
  reflect: <><path d="M12 3v18" /><path d="M8 7l-4 5 4 5" /><path d="M16 7l4 5-4 5" /></>,
  queue: <><rect x="3" y="5" width="18" height="4" rx="1" /><rect x="3" y="11" width="18" height="4" rx="1" /><rect x="3" y="17" width="12" height="4" rx="1" /></>,
};

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      {ICON_PATHS[name] ?? null}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Page head / Card
// ---------------------------------------------------------------------------
export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {sub && <div className="page-sub">{sub}</div>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Card({ title, sub, actions, children, padded = true, className = '' }: {
  title?: React.ReactNode; sub?: string; actions?: React.ReactNode;
  children: React.ReactNode; padded?: boolean; className?: string;
}) {
  return (
    <div className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          <div>
            {title && <h3 className="card-title">{title}</h3>}
            {sub && <div className="card-sub" style={{ marginTop: 2 }}>{sub}</div>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      <div style={padded ? { padding: 16 } : undefined}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat tile
// ---------------------------------------------------------------------------
export function StatCard({ label, value, unit, delta, deltaDir, hint, spark }: {
  label: string; value: React.ReactNode; unit?: string;
  delta?: string; deltaDir?: 'up' | 'down'; hint?: string; spark?: number[];
}) {
  return (
    <div className="stat">
      <div className="stat-label">{label}{hint && <span className="text-subtle" style={{ fontWeight: 400 }}>· {hint}</span>}</div>
      <div className="stat-value tnum">{value}{unit && <span className="unit">{unit}</span>}</div>
      {delta != null && (
        <div className={`stat-delta ${deltaDir ?? ''}`}>
          {deltaDir === 'up' ? '↑ ' : deltaDir === 'down' ? '↓ ' : ''}{delta}
        </div>
      )}
      {spark && spark.length > 1 && (
        <div className="stat-spark"><Sparkline data={spark} width={80} height={28} fill /></div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------
export function Badge({ variant = 'default', children, dot = false }: {
  variant?: 'default' | 'success' | 'warn' | 'danger' | 'info' | 'accent';
  children: React.ReactNode; dot?: boolean;
}) {
  return (
    <span className={`badge ${variant === 'default' ? '' : 'badge-' + variant}`}>
      {dot && <span className="dot" />}{children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------
export function Progress({ value, max = 100, variant, thin = false }: {
  value: number; max?: number; variant?: 'success' | 'warn' | 'danger'; thin?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div className={`progress ${thin ? 'thin' : ''} ${variant ?? ''}`}>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sparkline / AreaChart / Ring (pure SVG)
// ---------------------------------------------------------------------------
export function Sparkline({ data, width = 80, height = 28, color = 'var(--accent)', fill = false }: {
  data: number[]; width?: number; height?: number; color?: string; fill?: boolean;
}) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => `${i * step},${height - ((v - min) / range) * height}`).join(' ');
  return (
    <svg className="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {fill && <polygon points={`0,${height} ${pts} ${width},${height}`} fill={color} opacity={0.12} />}
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function AreaChart({ data, width = 560, height = 180, color = 'var(--accent)' }: {
  data: number[]; width?: number; height?: number; color?: string;
}) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => `${i * step},${height - (v / max) * (height - 12) - 4}`).join(' ');
  const gridY = [0.25, 0.5, 0.75].map((f) => height * f);
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {gridY.map((y) => <line key={y} x1={0} x2={width} y1={y} y2={y} stroke="var(--border)" strokeDasharray="2 4" />)}
      <polygon points={`0,${height} ${pts} ${width},${height}`} fill={color} opacity={0.1} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" />
    </svg>
  );
}

export function Ring({ value, max = 100, color = 'var(--accent)', label = '%', size = 96, thickness = 8 }: {
  value: number; max?: number; color?: string; label?: string; size?: number; thickness?: number;
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / (max || 1)));
  return (
    <div className="ring-chart" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-2)" strokeWidth={thickness} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={thickness} fill="none"
          strokeDasharray={`${c * pct} ${c}`} strokeLinecap="round" />
      </svg>
      <div className="ring-label"><span>{value.toFixed(1)}<small>{label}</small></span></div>
    </div>
  );
}
