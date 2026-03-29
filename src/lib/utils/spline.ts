/**
 * Cubic B-spline approximation — produces a smooth curve attracted to
 * (but not passing through) the control points.  Dense clusters of points
 * pull the curve more strongly, giving a natural "weighted average" look.
 *
 * @param points  Raw data points (x, y)
 * @param smoothing  Window size for pre-smoothing control points (1 = use raw
 *   points, higher = smoother curve). Maps to the MA window slider in settings.
 */
export function bSplinePath(
  points: { x: number; y: number }[],
  smoothing = 1,
): string {
  const n = points.length;
  if (n < 2) return "";
  if (n === 2)
    return `M${points[0].x},${points[0].y} L${points[1].x},${points[1].y}`;

  // Pre-smooth: average Y values over a sliding window to reduce control points' noise.
  // X stays at each point's position so the curve spans the full time range.
  let ctrl = points;
  if (smoothing > 1) {
    ctrl = points.map((p, i) => {
      const half = Math.floor(smoothing / 2);
      const lo = Math.max(0, i - half);
      const hi = Math.min(n - 1, i + half);
      let sum = 0;
      let count = 0;
      for (let j = lo; j <= hi; j++) {
        sum += points[j].y;
        count++;
      }
      return { x: p.x, y: sum / count };
    });
  }

  // Pad start/end so the curve reaches the first and last point vicinity
  const pts = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]];
  const m = pts.length;

  // First on-curve point
  const startX = (pts[0].x + 4 * pts[1].x + pts[2].x) / 6;
  const startY = (pts[0].y + 4 * pts[1].y + pts[2].y) / 6;
  const d: string[] = [`M${startX},${startY}`];

  for (let i = 0; i < m - 3; i++) {
    const p1 = pts[i + 1];
    const p2 = pts[i + 2];
    const p3 = pts[i + 3];

    // Convert B-spline segment to cubic Bézier control points
    const cp1x = (2 * p1.x + p2.x) / 3;
    const cp1y = (2 * p1.y + p2.y) / 3;
    const cp2x = (p1.x + 2 * p2.x) / 3;
    const cp2y = (p1.y + 2 * p2.y) / 3;

    // On-curve end point
    const ex = (p1.x + 4 * p2.x + p3.x) / 6;
    const ey = (p1.y + 4 * p2.y + p3.y) / 6;

    d.push(`C${cp1x},${cp1y} ${cp2x},${cp2y} ${ex},${ey}`);
  }

  return d.join(" ");
}
