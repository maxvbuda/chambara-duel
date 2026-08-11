export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

// Wraps an angle to the range [-PI, PI].
export function normalizeAngle(a) {
  a = a % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Shortest angular difference from a to b, in [-PI, PI].
export function angleDiff(a, b) {
  return normalizeAngle(b - a);
}

// Closest point on segment ab to point p, plus the distance to it.
export function pointSegmentDistance(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  let t = lenSq === 0 ? 0 : ((px - ax) * abx + (py - ay) * aby) / lenSq;
  t = clamp(t, 0, 1);
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return { dist: dist(px, py, cx, cy), x: cx, y: cy };
}

export function randRange(min, max) {
  return min + Math.random() * (max - min);
}
