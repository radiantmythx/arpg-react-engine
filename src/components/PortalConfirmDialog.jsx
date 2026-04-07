export function PortalConfirmDialog({ portalsRemaining = 0, onConfirm, onCancel }) {
  return (
    <div className="overlay portal-confirm-overlay">
      <div className="portal-confirm-panel">
        <div className="portal-confirm-title">Return To Hub?</div>
        <p className="portal-confirm-copy">
          Spend 1 portal to return to the Hub now?
        </p>
        <p className="portal-confirm-subcopy">
          Portals remaining after travel: {Math.max(0, portalsRemaining - 1)}
        </p>
        <div className="portal-confirm-actions">
          <button className="btn btn-primary" onClick={onConfirm}>Yes, Use Portal</button>
          <button className="btn btn-secondary" onClick={onCancel}>No, Stay In Map</button>
        </div>
      </div>
    </div>
  );
}
