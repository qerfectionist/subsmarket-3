export function FamilyCardSkeleton() {
  return (
    <div className="skeleton-card" aria-hidden="true" data-testid="family-card-skeleton">
      <div className="skeleton skeleton-line skeleton-line-sm" />
      <div className="skeleton skeleton-line skeleton-line-lg" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-line-metrics" />
      <div className="skeleton skeleton-line skeleton-line-sm" />
    </div>
  );
}

export function FamilyListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="card-grid" aria-hidden="true" data-testid="family-list-skeleton">
      {Array.from({ length: count }, (_, index) => (
        <FamilyCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function CellListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="cell-list-skeleton" aria-hidden="true" data-testid="cell-list-skeleton">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="cell-list-skeleton-row">
          <div className="skeleton skeleton-avatar" />
          <div className="cell-list-skeleton-copy">
            <div className="skeleton skeleton-line skeleton-line-lg" />
            <div className="skeleton skeleton-line skeleton-line-sm" />
            <div className="skeleton skeleton-line" />
          </div>
          <div className="skeleton skeleton-chevron" />
        </div>
      ))}
    </div>
  );
}

export function PanelSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="panel" aria-hidden="true" data-testid="panel-skeleton">
      <div className="panel-header">
        <div>
          <div className="skeleton skeleton-line skeleton-line-lg" />
          <div className="skeleton skeleton-line skeleton-line-sm" style={{ marginTop: 8 }} />
        </div>
      </div>
      <div className="card-grid">
        {Array.from({ length: lines }, (_, index) => (
          <div key={index} className="skeleton skeleton-block" />
        ))}
      </div>
    </div>
  );
}
