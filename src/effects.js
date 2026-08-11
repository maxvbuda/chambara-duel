import * as THREE from 'three';
import { ARENA } from './arena.js';
import { clamp } from './utils.js';

const TRAIL_POINTS = 16;

// A glowing ribbon that traces a weapon's recent tip positions. Intensity is
// driven by swing speed so it lights up during a real swing and fades at rest.
export class WeaponTrail {
  constructor(color) {
    this.positions = new Float32Array(TRAIL_POINTS * 3);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.line = new THREE.Line(this.geometry, this.material);
    this.line.frustumCulled = false;
    this._initialized = false;
  }

  update(tipPos, intensity) {
    if (!this._initialized) {
      for (let i = 0; i < TRAIL_POINTS; i++) {
        this.positions[i * 3] = tipPos.x;
        this.positions[i * 3 + 1] = tipPos.y;
        this.positions[i * 3 + 2] = tipPos.z;
      }
      this._initialized = true;
    } else {
      // Shift everything back one slot, insert the newest point at the front.
      this.positions.copyWithin(3, 0, (TRAIL_POINTS - 1) * 3);
      this.positions[0] = tipPos.x;
      this.positions[1] = tipPos.y;
      this.positions[2] = tipPos.z;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.material.opacity = clamp(intensity, 0, 1) * 0.85;
  }
}

// A short-lived burst of glowing shards flying outward from an impact point.
class SparkBurst {
  constructor(scene, position, color, count = 22) {
    this.scene = scene;
    this.life = 0.55;
    this.age = 0;
    this.velocities = [];
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const c1 = new THREE.Color(color);
    const c2 = new THREE.Color('#ffffff');
    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;
      const dir = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 1.2 - 0.1,
        Math.random() * 2 - 1
      ).normalize();
      const speed = 2.5 + Math.random() * 4;
      this.velocities.push(dir.multiplyScalar(speed));
      const mixed = c1.clone().lerp(c2, Math.random() * 0.6);
      colors[i * 3] = mixed.r;
      colors[i * 3 + 1] = mixed.g;
      colors[i * 3 + 2] = mixed.b;
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.material = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    scene.add(this.points);
  }

  update(dt) {
    this.age += dt;
    const pos = this.geometry.attributes.position.array;
    for (let i = 0; i < this.velocities.length; i++) {
      const v = this.velocities[i];
      v.y -= 9 * dt;
      pos[i * 3] += v.x * dt;
      pos[i * 3 + 1] += v.y * dt;
      pos[i * 3 + 2] += v.z * dt;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.material.opacity = clamp(1 - this.age / this.life, 0, 1);
    if (this.age >= this.life) {
      this.scene.remove(this.points);
      this.geometry.dispose();
      this.material.dispose();
      return false;
    }
    return true;
  }
}

// Slow-drifting ambient dust motes across the arena, purely atmospheric.
export class DustField {
  constructor(scene, count = 90) {
    const positions = new Float32Array(count * 3);
    this.velocities = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() * 2 - 1) * ARENA.halfWidth * 1.8;
      positions[i * 3 + 1] = Math.random() * 6 - 1;
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * ARENA.halfDepth * 3;
      this.velocities.push(0.15 + Math.random() * 0.25);
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.material = new THREE.PointsMaterial({
      color: '#ffe9c2',
      size: 0.05,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    scene.add(this.points);
  }

  update(dt) {
    const pos = this.geometry.attributes.position.array;
    const n = this.velocities.length;
    for (let i = 0; i < n; i++) {
      pos[i * 3 + 1] += this.velocities[i] * dt;
      if (pos[i * 3 + 1] > 6) pos[i * 3 + 1] = -1;
    }
    this.geometry.attributes.position.needsUpdate = true;
  }
}

export class EffectsManager {
  constructor(scene) {
    this.scene = scene;
    this.bursts = [];
    this.dust = new DustField(scene);
  }

  spawnHit(position, color) {
    this.bursts.push(new SparkBurst(this.scene, position, color));
  }

  update(dt) {
    this.dust.update(dt);
    this.bursts = this.bursts.filter((b) => b.update(dt));
  }
}
