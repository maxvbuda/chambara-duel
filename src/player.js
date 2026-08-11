import * as THREE from 'three';
import { createCharacter } from './character.js';
import { WeaponTrail } from './effects.js';
import { ARENA } from './arena.js';
import { clamp, pointSegmentDistance3D, normalizeAngle, angleDiff } from './utils.js';

const GRAVITY = 26;
const JUMP_VEL = 9.0;
const MOVE_ACCEL = 30;
const AIR_ACCEL = 14;
const MAX_SPEED = 5.6;
const GROUND_FRICTION = 24;
const BODY_RADIUS = 0.42;
const HAND_HEIGHT = 1.0;
const WEAPON_LENGTH = 1.26; // must track character.js's blade tip offset

const WEAPON_SPRING = 34;
const BRACE_SPRING = 90;
const WEAPON_DAMPING = 5.5;
const SWING_HIT_ANGVEL = 3.0;
const HIT_RADIUS = 0.42;
const HITSTUN_BASE = 0.26;
const KNOCKBACK_BASE = 5.6;
const KNOCKBACK_SCALE = 1.05;
const BRACE_KNOCKBACK_MULT = 0.15;

const REST_DIR = new THREE.Vector3(0, -1, 0.3).normalize();
const GUARD_DIR = new THREE.Vector3(0, 0.95, 0.32).normalize();
const WORLD_UP = new THREE.Vector3(0, 1, 0);

export class Player {
  constructor({ id, name, color, spawnX, spawnZ }) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.spawnX = spawnX;
    this.spawnZ = spawnZ;

    this.position = new THREE.Vector3(spawnX, ARENA.topY, spawnZ);
    this.velocity = new THREE.Vector3();
    this.yaw = id === 0 ? Math.PI / 2 : -Math.PI / 2;
    this.grounded = false;

    this.weaponDir = REST_DIR.clone();
    this.weaponAngVel = 0;
    this.hasHitThisSwing = false;
    this.swingSpeed = 0;
    this._swingAxis = null;
    this._walkT = 0;

    this.hitstun = 0;
    this.brace = false;
    this.score = 0;
    this.alive = true;
    this.hitFlash = 0;

    const char = createCharacter(color);
    this.body = char.body;
    this.weapon = char.weapon;
    this.parts = char.parts;
    this.trail = new WeaponTrail(color);

    this.body.position.copy(this.position);
  }

  respawn() {
    this.position.set(this.spawnX, ARENA.topY, this.spawnZ);
    this.velocity.set(0, 0, 0);
    this.weaponDir.copy(REST_DIR);
    this.weaponAngVel = 0;
    this.hasHitThisSwing = false;
    this.hitstun = 0;
    this.alive = true;
    this.body.visible = true;
    this.weapon.visible = true;
  }

  get handPos() {
    return new THREE.Vector3(this.position.x, this.position.y + HAND_HEIGHT, this.position.z);
  }
  get tipPos() {
    return this.handPos.addScaledVector(this.weaponDir, WEAPON_LENGTH);
  }

  isSwingLive() {
    return this.weaponAngVel > SWING_HIT_ANGVEL && !this.hasHitThisSwing;
  }

  // cmd: { moveX, moveZ (-1..1), jumpPressed, aimVector3: THREE.Vector3|null, brace }
  update(dt, cmd, opponentPos) {
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);

    if (!this.alive) {
      this.body.visible = false;
      this.weapon.visible = false;
      this.trail.update(this.tipPos, 0);
      return;
    }
    this.body.visible = true;
    this.weapon.visible = true;

    this.brace = !!cmd.brace && this.hitstun <= 0;
    const stunned = this.hitstun > 0;
    if (stunned) this.hitstun -= dt;
    const canAct = !stunned;

    // --- Horizontal movement ---
    const mx = canAct && !this.brace ? clamp(cmd.moveX, -1, 1) : 0;
    const mz = canAct && !this.brace ? clamp(cmd.moveZ, -1, 1) : 0;
    const accel = this.grounded ? MOVE_ACCEL : AIR_ACCEL;
    if (mx !== 0 || mz !== 0) {
      this.velocity.x += mx * accel * dt;
      this.velocity.z += mz * accel * dt;
    } else if (this.grounded) {
      const speed = Math.hypot(this.velocity.x, this.velocity.z);
      const drop = GROUND_FRICTION * dt;
      if (speed <= drop) {
        this.velocity.x = 0;
        this.velocity.z = 0;
      } else {
        const f = (speed - drop) / speed;
        this.velocity.x *= f;
        this.velocity.z *= f;
      }
    }
    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (horizSpeed > MAX_SPEED) {
      const f = MAX_SPEED / horizSpeed;
      this.velocity.x *= f;
      this.velocity.z *= f;
    }

    // --- Jump ---
    if (canAct && cmd.jumpPressed && this.grounded && !this.brace) {
      this.velocity.y = JUMP_VEL;
      this.grounded = false;
    }

    // --- Gravity & integration ---
    this.velocity.y -= GRAVITY * dt;
    const prevY = this.position.y;
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    // --- Platform collision (one-way, top surface only) ---
    this.grounded = false;
    if (
      this.velocity.y <= 0 &&
      prevY >= ARENA.topY - 0.05 &&
      this.position.y <= ARENA.topY &&
      this.position.x + BODY_RADIUS * 0.4 > -ARENA.halfWidth &&
      this.position.x - BODY_RADIUS * 0.4 < ARENA.halfWidth &&
      this.position.z + BODY_RADIUS * 0.4 > -ARENA.halfDepth &&
      this.position.z - BODY_RADIUS * 0.4 < ARENA.halfDepth
    ) {
      this.position.y = ARENA.topY;
      this.velocity.y = 0;
      this.grounded = true;
    }

    if (this.grounded && horizSpeed < 0.6) {
      this.position.x = clamp(this.position.x, -ARENA.halfWidth + 0.15, ARENA.halfWidth - 0.15);
      this.position.z = clamp(this.position.z, -ARENA.halfDepth + 0.15, ARENA.halfDepth - 0.15);
    }

    // --- Facing: smoothly turn to face the opponent ---
    if (opponentPos) {
      const dx = opponentPos.x - this.position.x;
      const dz = opponentPos.z - this.position.z;
      if (Math.hypot(dx, dz) > 0.05) {
        const targetYaw = Math.atan2(dx, dz);
        const diff = angleDiff(this.yaw, targetYaw);
        this.yaw = normalizeAngle(this.yaw + diff * clamp(dt * 8, 0, 1));
      }
    }
    this.body.rotation.y = this.yaw;

    // --- Weapon spring physics (rotate weaponDir toward the target direction) ---
    this._swingAxis = null;
    if (canAct) {
      let targetDir = null;
      if (this.brace) {
        targetDir = GUARD_DIR;
      } else if (cmd.aimVector3 && cmd.aimVector3.lengthSq() > 1e-6) {
        targetDir = cmd.aimVector3.clone().normalize();
      }
      if (targetDir) {
        const diff = this.weaponDir.angleTo(targetDir);
        if (diff > 1e-4) {
          const axis = new THREE.Vector3().crossVectors(this.weaponDir, targetDir);
          if (axis.lengthSq() < 1e-8) {
            axis.copy(WORLD_UP).cross(this.weaponDir);
            if (axis.lengthSq() < 1e-8) axis.set(1, 0, 0).cross(this.weaponDir);
          }
          axis.normalize();
          const springK = this.brace ? BRACE_SPRING : WEAPON_SPRING;
          this.weaponAngVel += diff * springK * dt;
          this._swingAxis = axis;
        }
      }
    }
    this.weaponAngVel -= this.weaponAngVel * WEAPON_DAMPING * dt;
    if (this.weaponAngVel < 0) this.weaponAngVel = 0;

    if (this.weaponAngVel > 1e-5 && this._swingAxis) {
      const step = Math.min(this.weaponAngVel * dt, Math.PI);
      const q = new THREE.Quaternion().setFromAxisAngle(this._swingAxis, step);
      this.weaponDir.applyQuaternion(q).normalize();
    }

    if (this.weaponAngVel < SWING_HIT_ANGVEL * 0.5) this.hasHitThisSwing = false;
    if (this.isSwingLive()) this.swingSpeed = Math.max(this.swingSpeed, this.weaponAngVel);
    else if (!this.brace) this.swingSpeed = 0;

    // --- Ring out ---
    if (this.position.y < ARENA.koY) {
      this.alive = false;
    }

    // --- Sync visuals ---
    this.body.position.copy(this.position);

    const walkSpeedT = clamp(horizSpeed / MAX_SPEED, 0, 1);
    this._walkT += dt * (this.grounded ? 6 + horizSpeed * 3.5 : 2.5);
    const swing = Math.sin(this._walkT) * 0.55 * (this.grounded ? walkSpeedT : 0.35);
    this.parts.legL.rotation.x = swing;
    this.parts.legR.rotation.x = -swing;
    this.parts.torso.position.y = 0.85 + Math.sin(this._walkT * 2) * 0.015 * walkSpeedT;

    const flashT = clamp(this.hitFlash / 0.18, 0, 1);
    this.parts.torso.material.emissiveIntensity = 1 + flashT * 3.5;
    this.parts.ring.material.opacity = this.brace ? 0.9 : 0.28 + (this.isSwingLive() ? 0.3 : 0);

    const hand = this.handPos;
    this.weapon.position.copy(hand);
    this.weapon.quaternion.setFromUnitVectors(WORLD_UP, this.weaponDir);
    const glowT = clamp(this.weaponAngVel / 6, 0, 1);
    this.parts.bladeMat.emissiveIntensity = 0.5 + glowT * 2.5;
    this.parts.guardMat.emissiveIntensity = 0.4 + glowT * 1.5;

    const tip = this.tipPos;
    this.trail.update(tip, clamp(this.weaponAngVel / 8, 0, 1));
  }

  // Returns hit info if this player's live weapon connects with `other`, else null.
  checkHitAgainst(other) {
    if (!this.alive || !other.alive) return null;
    if (!this.isSwingLive()) return null;
    if (other.hitstun > 0.15) return null;

    const hand = this.handPos;
    const tip = this.tipPos;
    const mid = hand.clone().lerp(tip, 0.6);
    const target = other.position.clone();
    target.y += 0.85;

    const dTip = pointSegmentDistance3D(target.x, target.y, target.z, hand.x, hand.y, hand.z, tip.x, tip.y, tip.z);
    const dMid = pointSegmentDistance3D(target.x, target.y, target.z, hand.x, hand.y, hand.z, mid.x, mid.y, mid.z);
    const best = Math.min(dTip.dist, dMid.dist);
    if (best > HIT_RADIUS + BODY_RADIUS) return null;

    return { strength: this.weaponAngVel, point: tip };
  }

  applyHit(strength, sourcePos) {
    const dir = new THREE.Vector3(
      this.position.x - sourcePos.x,
      this.position.y + 0.9 - sourcePos.y,
      this.position.z - sourcePos.z
    );
    dir.y += 0.9; // upward bias so hits pop opponents up dramatically
    if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0);
    dir.normalize();

    const power = clamp(strength, 0, 16);
    let mag = KNOCKBACK_BASE + power * KNOCKBACK_SCALE;
    let stun = HITSTUN_BASE + power * 0.028;

    if (this.brace) {
      mag *= BRACE_KNOCKBACK_MULT;
      stun = 0.08;
    }

    this.velocity.x += dir.x * mag;
    this.velocity.y += Math.max(dir.y, 0.25) * mag * 0.9;
    this.velocity.z += dir.z * mag;
    this.hitstun = Math.max(this.hitstun, stun);
    this.grounded = false;
    this.hitFlash = 0.18;
  }
}

export { BODY_RADIUS, WEAPON_LENGTH, HAND_HEIGHT };
