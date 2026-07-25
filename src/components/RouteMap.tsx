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

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={`w-full rounded-2xl bg-[#e7efe4] ${className}`}
      role="img"
      aria-label="Walk route map"
    >
      <polyline
        fill="none"
        stroke="#4b5742"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={d}
      />
      <circle cx={project(points[0]).split(",")[0]} cy={project(points[0]).split(",")[1]} r="5" fill="#c9a227" />
      <circle
        cx={project(points[points.length - 1]).split(",")[0]}
        cy={project(points[points.length - 1]).split(",")[1]}
        r="5"
        fill="#4a7c59"
      />
    </svg>
  );
}
