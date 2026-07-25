type Point = { lat: number; lng: number };

/** Lightweight privacy-safe route preview (no map API key required). */
export function RouteMap({
  points,
  className = "",
}: {
  points: Point[];
  className?: string;
}) {
  if (points.length < 2) {
    return (
      <div
        className={`grid place-items-center rounded-2xl bg-olive-100 text-sm text-muted ${className}`}
      >
        Route map will appear after GPS points are recorded
      </div>
    );
  }

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const pad = 0.0004;
  const w = 320;
  const h = 220;

  const project = (p: Point) => {
    const x = ((p.lng - (minLng - pad)) / (maxLng - minLng + pad * 2)) * w;
    const y = (1 - (p.lat - (minLat - pad)) / (maxLat - minLat + pad * 2)) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  };

  const d = points.map(project).join(" ");

  const start = project(points[0]).split(",");
  const end = project(points[points.length - 1]).split(",");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={`w-full rounded-2xl bg-[radial-gradient(circle_at_30%_20%,#f7f4ec,transparent_45%),linear-gradient(160deg,#e7efe4,#d9e4d4)] ${className}`}
      role="img"
      aria-label="Walk route map"
    >
      <defs>
        <filter id="pp-route-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodColor="#2b3026" floodOpacity="0.18" />
        </filter>
      </defs>
      <polyline
        fill="none"
        stroke="#4b5742"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={d}
        filter="url(#pp-route-soft)"
      />
      <circle cx={start[0]} cy={start[1]} r="6" fill="#c9a227" stroke="#fbf8f3" strokeWidth="2" />
      <circle cx={end[0]} cy={end[1]} r="6" fill="#4a7c59" stroke="#fbf8f3" strokeWidth="2" />
    </svg>
  );
}
