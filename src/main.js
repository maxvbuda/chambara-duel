import InputManager from './input.js';
import { ARENA, WIDTH, HEIGHT, drawArena } from './arena.js';
import { Player, BODY_RADIUS, WEAPON_LENGTH } from './player.js';
import { clamp, dist, randRange } from './utils.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = new InputManager(canvas);

const overlay = document.getElementById('overlay');
const menuPanel = document.getElementById('menuPanel');
const howToPanel = document.getElementById('howToPanel');
const hud = document.getElementById('hud');
const pauseHint = document.getElementById('pauseHint');
const roundBannerEl = document.getElementById('roundBanner');
const p1NameEl = document.getElementById('p1Name');
const p2NameEl = document.getElementById('p2Name');
const p1PipsEl = document.getElementById('p1Pips');
const p2PipsEl = document.getElementById('p2Pips');

const STATE = { MENU: 'menu', HOWTO: 'howto', PLAYING: 'playing', ROUND_END: 'round_end', MATCH_END: 'match_end' };

const game = {
  state: STATE.MENU,
  mode: 'cpu', // 'cpu' | '2p'
  pointsToWin: 5,
  banner: '',
  bannerTimer: 0,
  transitionTimer: 0,
  shake: 0,
  time: 0,
};

const p1 = new Player({ id: 0, name: 'PLAYER 1', color: '#38e0ff', spawnX: 460, spawnY: ARENA.top - BODY_RADIUS });
const p2 = new Player({ id: 1, name: 'PLAYER 2', color: '#ff5c7a', spawnX: 820, spawnY: ARENA.top - BODY_RADIUS });

const gamepadState = {
  0: { prevButtons: [] },
  1: { prevButtons: [] },
};

const aiState = { phase: 'approach', timer: 0, windupAngle: 0 };

// ---------- Menu wiring ----------
document.querySelectorAll('[data-mode]').forEach((btn) => {
  btn.addEventListener('click', () => {
    game.mode = btn.dataset.mode;
    p2.name = game.mode === 'cpu' ? 'CPU' : 'PLAYER 2';
    startMatch();
  });
});

document.querySelectorAll('[data-points]').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('[data-points]').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    game.pointsToWin = parseInt(chip.dataset.points, 10);
  });
});

document.getElementById('howToPlayBtn').addEventListener('click', () => {
  menuPanel.classList.add('hidden');
  howToPanel.classList.remove('hidden');
});
document.getElementById('backBtn').addEventListener('click', () => {
  howToPanel.classList.add('hidden');
  menuPanel.classList.remove('hidden');
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && (game.state === STATE.PLAYING || game.state === STATE.ROUND_END)) {
    goToMenu();
  }
});

function startMatch() {
  p1.score = 0;
  p2.score = 0;
  p1.respawn();
  p2.respawn();
  p1NameEl.textContent = p1.name;
  p2NameEl.textContent = p2.name;
  renderPips();
  overlay.classList.add('hidden');
  hud.classList.remove('hidden');
  pauseHint.classList.remove('hidden');
  game.banner = 'DUEL!';
  game.bannerTimer = 1.2;
  game.state = STATE.PLAYING;
}

function goToMenu() {
  game.state = STATE.MENU;
  overlay.classList.remove('hidden');
  menuPanel.classList.remove('hidden');
  howToPanel.classList.add('hidden');
  hud.classList.add('hidden');
  pauseHint.classList.add('hidden');
}

function renderPips() {
  p1PipsEl.innerHTML = '';
  p2PipsEl.innerHTML = '';
  for (let i = 0; i < game.pointsToWin; i++) {
    const a = document.createElement('div');
    a.className = 'pip' + (i < p1.score ? ' filled left-pip' : '');
    p1PipsEl.appendChild(a);
    const b = document.createElement('div');
    b.className = 'pip' + (i < p2.score ? ' filled right-pip' : '');
    p2PipsEl.appendChild(b);
  }
}

// ---------- Resize / letterboxing ----------
function resize() {
  const targetRatio = WIDTH / HEIGHT;
  const w = window.innerWidth;
  const h = window.innerHeight;
  let cw, ch;
  if (w / h > targetRatio) {
    ch = h;
    cw = h * targetRatio;
  } else {
    cw = w;
    ch = w / targetRatio;
  }
  canvas.style.width = `${cw}px`;
  canvas.style.height = `${ch}px`;
}
window.addEventListener('resize', resize);
resize();

// ---------- Gamepad helpers ----------
function readGamepad(index) {
  const pad = input.getGamepad(index);
  if (!pad || !pad.connected) return null;
  const st = gamepadState[index];
  const buttons = pad.buttons.map((b) => b.pressed);
  const jumpPressed = buttons[0] && !st.prevButtons[0];
  const bracePressed = buttons[4] || buttons[5] || buttons[7];
  st.prevButtons = buttons;

  const dead = 0.2;
  const mx = Math.abs(pad.axes[0]) > dead ? pad.axes[0] : 0;
  const ax = Math.abs(pad.axes[2]) > dead ? pad.axes[2] : 0;
  const ay = Math.abs(pad.axes[3]) > dead ? pad.axes[3] : 0;

  return {
    moveX: mx,
    jumpPressed,
    brace: bracePressed,
    aimVector: ax !== 0 || ay !== 0 ? { x: ax, y: ay } : null,
  };
}

// ---------- Human command builders ----------
function commandForP1() {
  const gp = readGamepad(0);
  if (gp) return gp;

  const moveX = (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0);
  const jumpPressed = input.justPressed('KeyW');
  const brace = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
  const aimVector = { x: input.mouse.x - p1.handX, y: input.mouse.y - p1.handY };
  return { moveX, jumpPressed, brace, aimVector };
}

function commandForP2Human() {
  const gp = readGamepad(1);
  if (gp) return gp;

  const moveX = (input.isDown('ArrowRight') ? 1 : 0) - (input.isDown('ArrowLeft') ? 1 : 0);
  const jumpPressed = input.justPressed('ArrowUp');
  const brace = input.isDown('ControlLeft') || input.isDown('ControlRight');
  const ax = (input.isDown('KeyL') ? 1 : 0) - (input.isDown('KeyJ') ? 1 : 0);
  const ay = (input.isDown('KeyK') ? 1 : 0) - (input.isDown('KeyI') ? 1 : 0);
  const aimVector = ax !== 0 || ay !== 0 ? { x: ax, y: ay } : null;
  return { moveX, jumpPressed, brace, aimVector };
}

// ---------- Simple CPU AI ----------
function commandForCPU(dt) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const distance = Math.abs(dx);
  const dirToPlayer = Math.sign(dx) || 1;

  aiState.timer -= dt;
  if (aiState.timer <= 0) {
    if (aiState.phase === 'windup') {
      aiState.phase = 'strike';
      aiState.timer = 0.16;
    } else {
      aiState.phase = 'windup';
      aiState.timer = randRange(0.22, 0.42);
      aiState.windupAngle = Math.atan2(-1, -dirToPlayer) + randRange(-0.3, 0.3);
    }
  }

  let moveX = 0;
  if (distance > 150) moveX = dirToPlayer * 0.9;
  else if (distance < 70) moveX = -dirToPlayer * 0.4;
  else moveX = Math.sin(game.time * 2.3) * 0.3;

  let jumpPressed = false;
  if (dy < -70 && p2.grounded && Math.random() < 0.02) jumpPressed = true;
  if (Math.random() < 0.004 && p2.grounded) jumpPressed = true;

  let aimVector;
  if (distance < 190) {
    if (aiState.phase === 'windup') {
      aimVector = { x: Math.cos(aiState.windupAngle), y: Math.sin(aiState.windupAngle) };
    } else {
      aimVector = { x: dx, y: dy - 30 };
    }
  } else {
    aimVector = { x: dirToPlayer, y: -0.4 };
  }

  let brace = false;
  if (distance < 150 && p1.isSwingLive() && Math.random() < 0.6) brace = true;

  return { moveX, jumpPressed, brace, aimVector };
}

// ---------- Round / match flow ----------
function handleRoundEnd(loserPlayer, winnerPlayer) {
  winnerPlayer.score += 1;
  renderPips();
  game.shake = 14;

  if (winnerPlayer.score >= game.pointsToWin) {
    game.banner = `${winnerPlayer.name} WINS THE MATCH!`;
    game.state = STATE.MATCH_END;
    game.transitionTimer = 3.2;
  } else {
    game.banner = `${winnerPlayer.name} SCORES!`;
    game.state = STATE.ROUND_END;
    game.transitionTimer = 1.3;
  }
  game.bannerTimer = game.transitionTimer;
}

function resolveHits() {
  const hit12 = p1.checkHitAgainst(p2);
  if (hit12) {
    p2.applyHit(hit12.strength, p1.handX, p1.handY);
    p1.hasHitThisSwing = true;
    game.shake = Math.max(game.shake, 6 + hit12.strength);
  }
  const hit21 = p2.checkHitAgainst(p1);
  if (hit21) {
    p1.applyHit(hit21.strength, p2.handX, p2.handY);
    p2.hasHitThisSwing = true;
    game.shake = Math.max(game.shake, 6 + hit21.strength);
  }
}

// ---------- Main loop ----------
let lastTime = performance.now();
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 1 / 30);
  lastTime = now;
  game.time += dt;

  if (game.bannerTimer > 0) {
    game.bannerTimer -= dt;
    roundBannerEl.textContent = game.bannerTimer > 0 ? game.banner : '';
  }
  if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 40);

  if (game.state === STATE.PLAYING) {
    const cmd1 = commandForP1();
    const cmd2 = game.mode === 'cpu' ? commandForCPU(dt) : commandForP2Human();
    p1.update(dt, cmd1);
    p2.update(dt, cmd2);
    resolveHits();

    if (!p1.alive) handleRoundEnd(p1, p2);
    else if (!p2.alive) handleRoundEnd(p2, p1);
  } else if (game.state === STATE.ROUND_END || game.state === STATE.MATCH_END) {
    game.transitionTimer -= dt;
    if (game.transitionTimer <= 0) {
      if (game.state === STATE.ROUND_END) {
        p1.respawn();
        p2.respawn();
        game.state = STATE.PLAYING;
      } else {
        goToMenu();
      }
    }
  }

  render();
  input.endFrame();
  requestAnimationFrame(loop);
}

function drawPlayer(p) {
  ctx.save();
  if (!p.alive) {
    ctx.restore();
    return;
  }

  // Hit flash halo
  if (p.hitFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${clamp(p.hitFlash / 0.18, 0, 1) * 0.6})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, BODY_RADIUS + 10, 0, Math.PI * 2);
    ctx.fill();
  }

  // Weapon
  const tip = p.tip;
  const live = p.isSwingLive();
  ctx.strokeStyle = live ? '#ffe27a' : p.brace ? '#ffffff' : p.color;
  ctx.lineWidth = live ? 8 : 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(p.handX, p.handY);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();
  ctx.fillStyle = live ? '#fff3c4' : '#dcdcdc';
  ctx.beginPath();
  ctx.arc(tip.x, tip.y, live ? 7 : 5, 0, Math.PI * 2);
  ctx.fill();

  // Guard crossbar near hand
  const gx = p.handX + Math.cos(p.weaponAngle) * 18;
  const gy = p.handY + Math.sin(p.weaponAngle) * 18;
  const perp = p.weaponAngle + Math.PI / 2;
  ctx.strokeStyle = '#c8b060';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(gx - Math.cos(perp) * 12, gy - Math.sin(perp) * 12);
  ctx.lineTo(gx + Math.cos(perp) * 12, gy + Math.sin(perp) * 12);
  ctx.stroke();

  // Body
  const bodyGrad = ctx.createRadialGradient(p.x - 8, p.y - 10, 4, p.x, p.y, BODY_RADIUS + 4);
  bodyGrad.addColorStop(0, '#ffffff');
  bodyGrad.addColorStop(0.25, p.color);
  bodyGrad.addColorStop(1, '#0c0c14');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.arc(p.x, p.y, BODY_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = p.brace ? '#ffffff' : 'rgba(0,0,0,0.4)';
  ctx.lineWidth = p.brace ? 4 : 2;
  ctx.stroke();

  // Eye (facing indicator)
  ctx.fillStyle = '#0b0b12';
  ctx.beginPath();
  ctx.arc(p.x + p.facing * 9, p.y - 4, 4.5, 0, Math.PI * 2);
  ctx.fill();

  // Name tag
  ctx.font = 'bold 13px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(p.name, p.x, p.y - BODY_RADIUS - 14);

  ctx.restore();
}

function render() {
  ctx.save();
  const shakeX = game.shake ? randRange(-game.shake, game.shake) : 0;
  const shakeY = game.shake ? randRange(-game.shake, game.shake) : 0;
  ctx.translate(shakeX, shakeY);

  drawArena(ctx, game.time);
  drawPlayer(p1);
  drawPlayer(p2);

  ctx.restore();
}

requestAnimationFrame(loop);
