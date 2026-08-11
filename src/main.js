import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import InputManager from './input.js';
import { buildArenaScene } from './arena.js';
import { Player } from './player.js';
import { EffectsManager } from './effects.js';
import { clamp, randRange } from './utils.js';

const canvas = document.getElementById('game');
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

const STATE = { MENU: 'menu', PLAYING: 'playing', ROUND_END: 'round_end', MATCH_END: 'match_end' };

const game = {
  state: STATE.MENU,
  mode: 'cpu',
  pointsToWin: 5,
  banner: '',
  bannerTimer: 0,
  transitionTimer: 0,
  shake: 0,
  time: 0,
};

// ---------- Three.js scene ----------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 300);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

buildArenaScene(scene);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.5,
  0.4,
  0.86
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, true);
  composer.setSize(w, h);
}
window.addEventListener('resize', resize);
resize();

// ---------- Players ----------
const p1 = new Player({ id: 0, name: 'PLAYER 1', color: '#38e0ff', spawnX: -3.6, spawnZ: 0 });
const p2 = new Player({ id: 1, name: 'PLAYER 2', color: '#ff5c7a', spawnX: 3.6, spawnZ: 0 });
scene.add(p1.body, p1.weapon, p1.trail.line, p2.body, p2.weapon, p2.trail.line);

const effects = new EffectsManager(scene);

// ---------- Dynamic tracking camera ----------
const CAM_DIR = new THREE.Vector3(0, 1, 1.35).normalize();
const camPos = new THREE.Vector3(0, 7.5, 11);
const camLookAt = new THREE.Vector3(0, 1.1, 0);
camera.position.copy(camPos);
camera.lookAt(camLookAt);
camera.updateMatrixWorld();

function updateCamera(dt) {
  const mid = new THREE.Vector3().addVectors(p1.position, p2.position).multiplyScalar(0.5);
  mid.y += 1.05;
  const sep = p1.position.distanceTo(p2.position);
  const dist = clamp(9.5 + sep * 0.62, 9.5, 17);
  const desired = mid.clone().addScaledVector(CAM_DIR, dist);

  camPos.lerp(desired, clamp(dt * 3.2, 0, 1));
  camLookAt.lerp(mid, clamp(dt * 4.5, 0, 1));

  let px = camPos.x;
  let py = camPos.y;
  let pz = camPos.z;
  if (game.shake > 0) {
    px += (Math.random() * 2 - 1) * game.shake * 0.02;
    py += (Math.random() * 2 - 1) * game.shake * 0.02;
    pz += (Math.random() * 2 - 1) * game.shake * 0.02;
  }
  camera.position.set(px, py, pz);
  camera.lookAt(camLookAt);
  camera.updateMatrixWorld();
}

function buildAimVector3(stick, camRight, camUp) {
  if (!stick || (stick.x === 0 && stick.y === 0)) return null;
  const v = new THREE.Vector3();
  v.addScaledVector(camRight, stick.x);
  v.addScaledVector(camUp, -stick.y);
  if (v.lengthSq() < 1e-8) return null;
  return v;
}

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

// ---------- Gamepad helpers ----------
const gamepadState = { 0: { prevButtons: [] }, 1: { prevButtons: [] } };

function readGamepad(index) {
  const pad = input.getGamepad(index);
  if (!pad || !pad.connected) return null;
  const st = gamepadState[index];
  const buttons = pad.buttons.map((b) => b.pressed);
  const jumpPressed = buttons[0] && !st.prevButtons[0];
  const bracePressed = buttons[4] || buttons[5] || buttons[7];
  st.prevButtons = buttons;

  const dead = 0.18;
  const mx = Math.abs(pad.axes[0]) > dead ? pad.axes[0] : 0;
  const mz = Math.abs(pad.axes[1]) > dead ? pad.axes[1] : 0;
  const ax = Math.abs(pad.axes[2]) > dead ? pad.axes[2] : 0;
  const ay = Math.abs(pad.axes[3]) > dead ? pad.axes[3] : 0;

  return { moveX: mx, moveZ: mz, jumpPressed, brace: bracePressed, stick: { x: ax, y: ay } };
}

// ---------- Human command builders ----------
function rawCommandP1() {
  const gp = readGamepad(0);
  if (gp) return gp;
  const moveX = (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0);
  const moveZ = (input.isDown('KeyS') ? 1 : 0) - (input.isDown('KeyW') ? 1 : 0);
  const jumpPressed = input.justPressed('Space');
  const brace = input.isDown('ShiftLeft');
  const stick = input.getMouseStick();
  return { moveX, moveZ, jumpPressed, brace, stick };
}

function rawCommandP2Human() {
  const gp = readGamepad(1);
  if (gp) return gp;
  const moveX = (input.isDown('ArrowRight') ? 1 : 0) - (input.isDown('ArrowLeft') ? 1 : 0);
  const moveZ = (input.isDown('ArrowDown') ? 1 : 0) - (input.isDown('ArrowUp') ? 1 : 0);
  const jumpPressed = input.justPressed('ShiftRight');
  const brace = input.isDown('ControlLeft') || input.isDown('ControlRight');
  const ax = (input.isDown('KeyL') ? 1 : 0) - (input.isDown('KeyJ') ? 1 : 0);
  const ay = (input.isDown('KeyK') ? 1 : 0) - (input.isDown('KeyI') ? 1 : 0);
  return { moveX, moveZ, jumpPressed, brace, stick: { x: ax, y: ay } };
}

// ---------- Simple CPU AI (full 3D — aims true world-space directions) ----------
const aiState = { phase: 'approach', timer: 0, windupDir: new THREE.Vector3(0, 1, -1) };

function commandForCPU(dt) {
  const dx = p1.position.x - p2.position.x;
  const dz = p1.position.z - p2.position.z;
  const distXZ = Math.hypot(dx, dz) || 0.001;
  const dirX = dx / distXZ;
  const dirZ = dz / distXZ;
  const perpX = -dirZ;
  const perpZ = dirX;

  aiState.timer -= dt;
  if (aiState.timer <= 0) {
    if (aiState.phase === 'windup') {
      aiState.phase = 'strike';
      aiState.timer = 0.16;
    } else {
      aiState.phase = 'windup';
      aiState.timer = randRange(0.22, 0.42);
      aiState.windupDir
        .set(-dirX + randRange(-0.6, 0.6), 0.6 + randRange(-0.3, 0.3), -dirZ + randRange(-0.6, 0.6))
        .normalize();
    }
  }

  let moveX = 0;
  let moveZ = 0;
  if (distXZ > 3.4) {
    moveX = dirX * 0.9;
    moveZ = dirZ * 0.9;
  } else if (distXZ < 1.5) {
    moveX = -dirX * 0.4;
    moveZ = -dirZ * 0.4;
  } else {
    moveX = perpX * Math.sin(game.time * 2.1) * 0.4;
    moveZ = perpZ * Math.sin(game.time * 2.1) * 0.4;
  }

  let jumpPressed = false;
  if (p1.position.y - p2.position.y > 1.4 && p2.grounded && Math.random() < 0.02) jumpPressed = true;
  if (Math.random() < 0.004 && p2.grounded) jumpPressed = true;

  let aimVector3;
  if (distXZ < 4.2) {
    if (aiState.phase === 'windup') {
      aimVector3 = aiState.windupDir;
    } else {
      aimVector3 = new THREE.Vector3(dx, p1.position.y - p2.position.y + 0.6, dz);
    }
  } else {
    aimVector3 = new THREE.Vector3(dirX, -0.3, dirZ);
  }

  let brace = false;
  if (distXZ < 3.2 && p1.isSwingLive() && Math.random() < 0.6) brace = true;

  return { moveX, moveZ, jumpPressed, brace, aimVector3 };
}

// ---------- Round / match flow ----------
function handleRoundEnd(loserPlayer, winnerPlayer) {
  winnerPlayer.score += 1;
  renderPips();
  game.shake = 16;

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
    p2.applyHit(hit12.strength, p1.handPos);
    p1.hasHitThisSwing = true;
    effects.spawnHit(hit12.point, p1.color);
    game.shake = Math.max(game.shake, 6 + hit12.strength * 1.4);
  }
  const hit21 = p2.checkHitAgainst(p1);
  if (hit21) {
    p1.applyHit(hit21.strength, p2.handPos);
    p2.hasHitThisSwing = true;
    effects.spawnHit(hit21.point, p2.color);
    game.shake = Math.max(game.shake, 6 + hit21.strength * 1.4);
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
  if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 26);

  updateCamera(dt);
  const camRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  const camUp = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();

  if (game.state === STATE.PLAYING) {
    const raw1 = rawCommandP1();
    const cmd1 = {
      moveX: raw1.moveX,
      moveZ: raw1.moveZ,
      jumpPressed: raw1.jumpPressed,
      brace: raw1.brace,
      aimVector3: buildAimVector3(raw1.stick, camRight, camUp),
    };

    let cmd2;
    if (game.mode === 'cpu') {
      cmd2 = commandForCPU(dt);
    } else {
      const raw2 = rawCommandP2Human();
      cmd2 = {
        moveX: raw2.moveX,
        moveZ: raw2.moveZ,
        jumpPressed: raw2.jumpPressed,
        brace: raw2.brace,
        aimVector3: buildAimVector3(raw2.stick, camRight, camUp),
      };
    }

    p1.update(dt, cmd1, p2.position);
    p2.update(dt, cmd2, p1.position);
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

  effects.update(dt);
  composer.render();
  input.endFrame();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
