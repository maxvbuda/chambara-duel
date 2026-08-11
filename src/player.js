import { clamp, normalizeAngle, angleDiff, pointSegmentDistance } from './utils.js';
import { ARENA } from './arena.js';

const GRAVITY = 2200;
const MOVE_ACCEL = 3400;
const AIR_ACCEL = 2000;
const MAX_SPEED = 420;
const GROUND_FRICTION = 2600;
const JUMP_VELOCITY = 880;
const BODY_RADIUS = 26;

const WEAPON_LENGTH = 108;
const WEAPON_PIVOT_OFFSET_Y = -8;
const WEAPON_SPRING = 46; // how eagerly the weapon chases the aim angle
const WEAPON_DAMPING = 6.2;
const REST_ANGLE = Math.PI / 2 + 0.5; // hanging down-ish when idle

const SWING_HIT_ANGVEL = 3.2; // rad/s required to count as a live swing
const HIT_RADIUS = 20;
const HITSTUN_BASE = 0.28;
const KNOCKBACK_BASE = 300;
const KNOCKBACK_SCALE = 60;
const BRACE_KNOCKBACK_MULT = 0.14;

export class Player {
  constructor({ id, name, color, spawnX, spawnY }) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.spawnX = spawnX;
    this.spawnY = spawnY;

    this.x = spawnX;
    this.y = spawnY;
    this.vx = 0;
    this.vy = 0;
    this.facing = id === 0 ? 1 : -1;
    this.grounded = false;

    this.weaponAngle = REST_ANGLE;
    this.weaponAngVel = 0;
    this.swingSpeed = 0; // magnitude used for hit-strength, decays after each hit
    this.hasHitThisSwing = false;

    this.hitstun = 0;
    this.brace = false;
    this.score = 0;
    this.alive = true;
    this.koFlashTimer = 0;
    this.hitFlash = 0;
  }

  respawn() {
    this.x = this.spawnX;
    this.y = this.spawnY;
    this.vx = 0;
    this.vy = 0;
    this.weaponAngVel = 0;
    this.hitstun = 0;
    this.alive = true;
  }

  get handX() {
    return this.x;
  }
  get handY() {
    return this.y + WEAPON_PIVOT_OFFSET_Y;
  }
  get tip() {
    return {
      x: this.handX + Math.cos(this.weaponAngle) * WEAPON_LENGTH,
      y: this.handY + Math.sin(this.weaponAngle) * WEAPON_LENGTH,
    };
  }
  get mid() {
    return {
      x: this.handX + Math.cos(this.weaponAngle) * WEAPON_LENGTH * 0.6,
      y: this.handY + Math.sin(this.weaponAngle) * WEAPON_LENGTH * 0.6,
    };
  }

  isSwingLive() {
    return Math.abs(this.weaponAngVel) > SWING_HIT_ANGVEL && !this.hasHitThisSwing;
  }

  // cmd: { moveX: -1..1, jumpPressed: bool, aimVector: {x,y}|null, brace: bool }
  update(dt, cmd) {
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.koFlashTimer > 0) this.koFlashTimer -= dt;
    if (!this.alive) return;

    this.brace = !!cmd.brace && this.hitstun <= 0;
    const stunned = this.hitstun > 0;
    if (stunned) this.hitstun -= dt;

    // --- Horizontal movement ---
    const canAct = !stunned;
    const moveX = canAct ? clamp(cmd.moveX, -1, 1) : 0;
    const accel = this.grounded ? MOVE_ACCEL : AIR_ACCEL;
    if (moveX !== 0 && !this.brace) {
      this.vx += moveX * accel * dt;
      this.facing = moveX > 0 ? 1 : -1;
    } else if (this.grounded) {
      const drop = GROUND_FRICTION * dt;
      if (Math.abs(this.vx) <= drop) this.vx = 0;
      else this.vx -= Math.sign(this.vx) * drop;
    }
    this.vx = clamp(this.vx, -MAX_SPEED, MAX_SPEED);

    // --- Jump ---
    if (canAct && cmd.jumpPressed && this.grounded && !this.brace) {
      this.vy = -JUMP_VELOCITY;
      this.grounded = false;
    }

    // --- Gravity & integration ---
    this.vy += GRAVITY * dt;
    const prevBottom = this.y + BODY_RADIUS;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // --- Platform collision (one-way, top surface only) ---
    this.grounded = false;
    const bottom = this.y + BODY_RADIUS;
    if (
      this.vy >= 0 &&
      prevBottom <= ARENA.top + 2 &&
      bottom >= ARENA.top &&
      this.x + BODY_RADIUS * 0.5 > ARENA.left &&
      this.x - BODY_RADIUS * 0.5 < ARENA.right
    ) {
      this.y = ARENA.top - BODY_RADIUS;
      this.vy = 0;
      this.grounded = true;
    }

    // Keep players from sliding off the extreme edges too easily going sideways
    // while grounded — but still allow being knocked off (only clamp if slow).
    if (this.grounded && Math.abs(this.vx) < 40) {
      this.x = clamp(this.x, ARENA.left + 6, ARENA.right - 6);
    }

    // --- Weapon spring physics ---
    if (this.brace) {
      // Locked guard stance: weapon snaps to a raised block angle, no swinging.
      const targetGuard = this.facing > 0 ? -2.4 : -0.7;
      const diff = angleDiff(this.weaponAngle, targetGuard);
      this.weaponAngVel = diff * 10;
      this.weaponAngle = normalizeAngle(this.weaponAngle + this.weaponAngVel * dt);
      this.hasHitThisSwing = false;
    } else {
      let targetAngle = null;
      if (cmd.aimVector && (cmd.aimVector.x !== 0 || cmd.aimVector.y !== 0)) {
        targetAngle = Math.atan2(cmd.aimVector.y, cmd.aimVector.x);
      }
      if (canAct && targetAngle !== null) {
        const diff = angleDiff(this.weaponAngle, targetAngle);
        this.weaponAngVel += diff * WEAPON_SPRING * dt;
      }
      this.weaponAngVel -= this.weaponAngVel * WEAPON_DAMPING * dt;
      this.weaponAngle = normalizeAngle(this.weaponAngle + this.weaponAngVel * dt);

      // Reset "already hit" lock once the swing slows down / reverses, so
      // the next arc can land a fresh hit.
      if (Math.abs(this.weaponAngVel) < SWING_HIT_ANGVEL * 0.5) {
        this.hasHitThisSwing = false;
      }
    }

    if (this.isSwingLive()) {
      this.swingSpeed = Math.max(this.swingSpeed, Math.abs(this.weaponAngVel));
    } else if (!this.brace) {
      this.swingSpeed = 0;
    }

    // --- Ring out ---
    if (this.y > ARENA.koLine) {
      this.alive = false;
      this.hitFlash = 0;
    }
  }

  // Returns hit info if this player's live weapon connects with `other`, else null.
  checkHitAgainst(other) {
    if (!this.alive || !other.alive) return null;
    if (!this.isSwingLive()) return null;
    if (other.hitstun > 0.15) return null; // avoid re-hitting a already-flying opponent

    const tip = this.tip;
    const mid = this.mid;
    const dTip = pointSegmentDistance(tip.x, tip.y, this.handX, this.handY, other.x, other.y);
    const dMid = pointSegmentDistance(mid.x, mid.y, this.handX, this.handY, other.x, other.y);
    const best = Math.min(dTip.dist, dMid.dist);
    if (best > HIT_RADIUS + BODY_RADIUS) return null;

    return { strength: Math.abs(this.weaponAngVel) };
  }

  applyHit(strength, sourceX, sourceY) {
    let dx = this.x - sourceX;
    let dy = this.y - sourceY - 40; // upward bias so hits pop opponents up
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;

    const power = clamp(strength, 0, 16);
    let mag = KNOCKBACK_BASE + power * KNOCKBACK_SCALE;
    let stun = HITSTUN_BASE + power * 0.03;

    if (this.brace) {
      mag *= BRACE_KNOCKBACK_MULT;
      stun = 0.08;
    }

    this.vx += dx * mag;
    this.vy += dy * mag * 0.85;
    this.hitstun = Math.max(this.hitstun, stun);
    this.grounded = false;
    this.hitFlash = 0.18;
  }
}

export { BODY_RADIUS, WEAPON_LENGTH };
