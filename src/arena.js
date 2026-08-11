export const WIDTH = 1280;
export const HEIGHT = 720;

export const ARENA = {
  left: 220,
  right: 1060,
  top: 520,
  thickness: 34,
  koLine: HEIGHT + 120,
};

// A handful of fixed-seed background silhouettes so the sky isn't flat.
const MOUNTAINS = Array.from({ length: 7 }).map((_, i) => ({
  x: (i / 6) * WIDTH,
  h: 90 + ((i * 53) % 120),
  w: 260 + ((i * 37) % 140),
}));

const CLOUDS = Array.from({ length: 5 }).map((_, i) => ({
  x: (i / 5) * WIDTH + 80,
  y: 90 + ((i * 61) % 140),
  s: 0.6 + ((i * 13) % 5) / 10,
}));

export function drawArena(ctx, t) {
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, '#241246');
  sky.addColorStop(0.55, '#4a1f63');
  sky.addColorStop(1, '#7a2f52');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Sun / moon glow
  const glow = ctx.createRadialGradient(WIDTH / 2, 260, 20, WIDTH / 2, 260, 260);
  glow.addColorStop(0, 'rgba(255, 210, 120, 0.55)');
  glow.addColorStop(1, 'rgba(255, 210, 120, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  for (const c of CLOUDS) {
    const x = ((c.x + t * 6) % (WIDTH + 200)) - 100;
    ctx.beginPath();
    ctx.ellipse(x, c.y, 60 * c.s, 18 * c.s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(15, 6, 28, 0.55)';
  for (const m of MOUNTAINS) {
    ctx.beginPath();
    ctx.moveTo(m.x - m.w / 2, HEIGHT * 0.62);
    ctx.lineTo(m.x, HEIGHT * 0.62 - m.h);
    ctx.lineTo(m.x + m.w / 2, HEIGHT * 0.62);
    ctx.closePath();
    ctx.fill();
  }

  // Void below the platform
  const voidGrad = ctx.createLinearGradient(0, ARENA.top + 60, 0, HEIGHT);
  voidGrad.addColorStop(0, 'rgba(5,2,10,0)');
  voidGrad.addColorStop(1, 'rgba(5,2,10,0.95)');
  ctx.fillStyle = voidGrad;
  ctx.fillRect(0, ARENA.top + 60, WIDTH, HEIGHT - ARENA.top - 60);

  drawPlatform(ctx);
}

function drawPlatform(ctx) {
  const { left, right, top, thickness } = ARENA;
  const w = right - left;

  // Underside shadow columns for a "floating stone slab" look
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(left + w * 0.18, top + thickness, 26, 90);
  ctx.fillRect(left + w * 0.82 - 26, top + thickness, 26, 90);

  const body = ctx.createLinearGradient(0, top, 0, top + thickness);
  body.addColorStop(0, '#8f6a52');
  body.addColorStop(1, '#4d3627');
  ctx.fillStyle = body;
  ctx.fillRect(left, top, w, thickness);

  ctx.fillStyle = '#5fbf6b';
  ctx.fillRect(left, top - 8, w, 10);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(left, top - 8, w, thickness + 8);
}
