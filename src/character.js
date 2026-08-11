import * as THREE from 'three';

// Builds a stylized low-poly duelist: a body (for the scene graph, follows
// position + facing) and a weapon (kept as a separate top-level object so it
// can be oriented purely from the swing physics, independent of the body's
// facing — this is what gives the swings their arcade "whip" feel).
export function createCharacter(color) {
  const accent = new THREE.Color(color);
  const skin = new THREE.Color('#f2c9a0');

  const body = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: accent.clone().multiplyScalar(0.55),
    roughness: 0.45,
    metalness: 0.15,
    emissive: accent.clone().multiplyScalar(0.12),
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: accent,
    roughness: 0.3,
    metalness: 0.4,
    emissive: accent.clone().multiplyScalar(0.35),
    emissiveIntensity: 1,
  });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.6, metalness: 0.05 });

  // Legs
  const legGeo = new THREE.CapsuleGeometry(0.09, 0.42, 3, 6);
  const legL = new THREE.Mesh(legGeo, bodyMat);
  legL.position.set(-0.15, 0.33, 0);
  legL.castShadow = true;
  const legR = new THREE.Mesh(legGeo, bodyMat);
  legR.position.set(0.15, 0.33, 0);
  legR.castShadow = true;
  body.add(legL, legR);

  // Torso
  const torsoGeo = new THREE.CapsuleGeometry(0.32, 0.5, 4, 10);
  const torso = new THREE.Mesh(torsoGeo, bodyMat);
  torso.position.set(0, 0.85, 0);
  torso.castShadow = true;
  torso.receiveShadow = true;
  body.add(torso);

  // Belt / trim accent
  const beltGeo = new THREE.TorusGeometry(0.33, 0.045, 8, 16);
  const belt = new THREE.Mesh(beltGeo, trimMat);
  belt.position.set(0, 0.62, 0);
  belt.rotation.x = Math.PI / 2;
  body.add(belt);

  // Shoulder pads
  const shoulderGeo = new THREE.SphereGeometry(0.16, 12, 10);
  const shoulderL = new THREE.Mesh(shoulderGeo, trimMat);
  shoulderL.position.set(-0.36, 1.08, 0);
  shoulderL.castShadow = true;
  const shoulderR = new THREE.Mesh(shoulderGeo, trimMat);
  shoulderR.position.set(0.36, 1.08, 0);
  shoulderR.castShadow = true;
  body.add(shoulderL, shoulderR);

  // Head
  const headGeo = new THREE.SphereGeometry(0.22, 20, 16);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.set(0, 1.48, 0);
  head.castShadow = true;
  body.add(head);

  // Visor / mask accent
  const visorGeo = new THREE.TorusGeometry(0.16, 0.03, 8, 16, Math.PI);
  const visor = new THREE.Mesh(visorGeo, trimMat);
  visor.position.set(0, 1.5, 0.16);
  visor.rotation.set(Math.PI / 2, 0, Math.PI);
  body.add(visor);

  // Off-hand shield/buckler on the non-weapon arm, purely decorative
  const buckler = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.04, 16),
    trimMat
  );
  buckler.rotation.z = Math.PI / 2;
  buckler.position.set(-0.42, 0.85, 0.08);
  buckler.castShadow = true;
  body.add(buckler);

  // Ground contact glow ring (pulses with brace state)
  const ringMat = new THREE.MeshBasicMaterial({
    color: accent,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.46, 24), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  body.add(ring);

  const { weapon, parts: weaponParts, bladeLen } = createWeapon(color);

  return {
    body,
    weapon,
    parts: { legL, legR, torso, head, ring, ...weaponParts },
    bladeLen,
    color: accent,
  };
}

// Weapon built at the origin, authored pointing along +Y so it can be
// oriented with a single setFromUnitVectors(UP, weaponDir) each frame.
// Used both as the real world-space weapon and as a camera-anchored
// first-person view-model (see main.js).
export function createWeapon(color) {
  const accent = new THREE.Color(color);
  const weapon = new THREE.Group();
  const bladeLen = 1.1;
  const bladeMat = new THREE.MeshStandardMaterial({
    color: '#e9edf5',
    roughness: 0.2,
    metalness: 0.85,
    emissive: accent,
    emissiveIntensity: 0.6,
  });
  const blade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.05, bladeLen, 6),
    bladeMat
  );
  blade.position.y = 0.16 + bladeLen / 2;
  blade.castShadow = true;
  weapon.add(blade);

  const guardMat = new THREE.MeshStandardMaterial({
    color: accent,
    roughness: 0.3,
    metalness: 0.7,
    emissive: accent,
    emissiveIntensity: 0.5,
  });
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.05), guardMat);
  guard.position.y = 0.15;
  weapon.add(guard);

  const hilt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.22, 8),
    new THREE.MeshStandardMaterial({ color: '#2a2018', roughness: 0.8 })
  );
  hilt.position.y = 0.03;
  weapon.add(hilt);

  const tipGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 10, 10),
    new THREE.MeshBasicMaterial({ color: accent })
  );
  tipGlow.position.y = 0.16 + bladeLen;
  weapon.add(tipGlow);

  return { weapon, parts: { blade, bladeMat, guardMat, tipGlow }, bladeLen };
}
