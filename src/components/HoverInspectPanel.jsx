function fmtValue(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '—';
    if (Math.abs(value) >= 1000) return Math.round(value).toLocaleString();
    return Number.isInteger(value) ? `${value}` : value.toFixed(2);
  }
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  return String(value);
}

function Rows({ rows = [] }) {
  if (!rows.length) return null;
  return (
    <div className="hover-inspect-rows">
      {rows.map((row, idx) => (
        <div key={`${row.label}_${idx}`} className="hover-inspect-row">
          <span className="hover-inspect-row__label">{row.label}</span>
          <span className="hover-inspect-row__value">{fmtValue(row.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function HoverInspectPanel({ target, debugMode = false, mobileMode = false, allowMobile = false }) {
  if (!target || (mobileMode && !allowMobile)) return null;

  const hp = target.health ?? null;
  const hpPct = hp?.max > 0 ? Math.max(0, Math.min(1, hp.current / hp.max)) : 0;

  return (
    <aside className={`hover-inspect-panel${debugMode ? ' hover-inspect-panel--debug' : ''}${allowMobile ? ' hover-inspect-panel--mobile-lock' : ''}`} aria-live="polite">
      <div className="hover-inspect-main">
        <div className="hover-inspect-head">
          <div className="hover-inspect-kicker">Hovered</div>
          <div className="hover-inspect-title">{target.name}</div>
          {target.subtitle && <div className="hover-inspect-subtitle">{target.subtitle}</div>}
        </div>

        {hp && (
          <div className="hover-inspect-hp">
            <div className="hover-inspect-hp__meta">
              <span>HP</span>
              <span>{Math.ceil(hp.current)} / {Math.round(hp.max)}</span>
            </div>
            <div className="hover-inspect-hp__bar">
              <span style={{ width: `${Math.round(hpPct * 100)}%` }} />
            </div>
          </div>
        )}

        <Rows rows={target.details} />
      </div>

      {debugMode && (
        <div className="hover-inspect-debug-section">
          <div className="hover-inspect-debug-title">Developer Details (F3)</div>
          <Rows rows={target.debugDetails} />
        </div>
      )}
    </aside>
  );
}
