import * as THREE from 'three';

export const ARENA = {
  halfWidth: 7.2, // X extent of the platform
  halfDepth: 3.4, // Z extent of the platform
  topY: 0,
  thickness: 1.0,
  koY: -16,
};

const skyVertexShader = `
varying vec3 vWorldPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const skyFragmentShader = `
varying vec3 vWorldPos;
uniform vec3 topColor;
uniform vec3 midColor;
uniform vec3 horizonColor;
void main() {
  float h = normalize(vWorldPos).y;
  vec3 col = h > 0.05
    ? mix(midColor, topColor, smoothstep(0.05, 0.95, h))
    : mix(horizonColor, midColor, smoothstep(-0.3, 0.05, h));
  gl_FragColor = vec4(col, 1.0);
}`;

function buildSky(scene) {
  const geo = new THREE.SphereGeometry(140, 24, 16);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color('#2f7fe0') },
      midColor: { value: new THREE.Color('#8ec4f5') },
      horizonColor: { value: new THREE.Color('#fff3d6') },
    },
    vertexShader: skyVertexShader,
    fragmentShader: skyFragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(geo, mat);
  scene.add(sky);

  // The sun — bright and radiant, a divine light over Olympus
  const sunMat = new THREE.MeshBasicMaterial({ color: '#fff6dd', fog: false });
  const sun = new THREE.Mesh(new THREE.CircleGeometry(11, 32), sunMat);
  sun.position.set(-16, 30, -95);
  sun.lookAt(0, 22, 0);
  scene.add(sun);

  // Soft halo glow around the sun
  const haloMat = new THREE.MeshBasicMaterial({
    color: '#ffe9ad',
    transparent: true,
    opacity: 0.35,
    fog: false,
    depthWrite: false,
  });
  const halo = new THREE.Mesh(new THREE.CircleGeometry(22, 32), haloMat);
  halo.position.copy(sun.position);
  halo.lookAt(0, 22, 0);
  scene.add(halo);
}

// A sea of clouds surrounds the peak, with a couple of pale, distant summits
// breaking through — you're standing above the world, at the top of Olympus.
function buildClouds(scene) {
  const cloudMat = new THREE.MeshStandardMaterial({
    color: '#f3f6fb',
    roughness: 0.9,
    metalness: 0,
  });
  const group = new THREE.Group();
  const puffCount = 22;
  for (let i = 0; i < puffCount; i++) {
    const angle = (i / puffCount) * Math.PI * 2 + Math.sin(i * 2.3) * 0.15;
    const dist = 34 + ((i * 29) % 26);
    const y = -7 + ((i * 13) % 6);
    const cluster = new THREE.Group();
    const puffs = 3 + (i % 3);
    for (let p = 0; p < puffs; p++) {
      const r = 3 + ((i * 7 + p * 11) % 5);
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), cloudMat);
      puff.position.set((p - puffs / 2) * r * 1.1, ((i + p) % 3) * 0.6, ((p * 17) % 5) - 2);
      cluster.add(puff);
    }
    cluster.position.set(Math.cos(angle) * dist, y, Math.sin(angle) * dist);
    group.add(cluster);
  }

  // A few pale, distant peaks breaking above the cloud line
  const peakMat = new THREE.MeshStandardMaterial({ color: '#cfe0f2', roughness: 1, metalness: 0 });
  const peakCount = 5;
  for (let i = 0; i < peakCount; i++) {
    const angle = (i / peakCount) * Math.PI * 2 + 0.6;
    const dist = 58 + ((i * 19) % 14);
    const h = 20 + ((i * 17) % 14);
    const r = 9 + ((i * 11) % 6);
    const peak = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), peakMat);
    peak.position.set(Math.cos(angle) * dist, h / 2 - 10, Math.sin(angle) * dist);
    group.add(peak);
  }

  scene.add(group);
}

function buildPlatform(scene) {
  const { halfWidth, halfDepth, topY, thickness } = ARENA;
  const group = new THREE.Group();

  const marbleMat = new THREE.MeshStandardMaterial({
    color: '#f4f0e6',
    roughness: 0.45,
    metalness: 0.05,
  });
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(halfWidth * 2, thickness, halfDepth * 2),
    marbleMat
  );
  slab.position.set(0, topY - thickness / 2, 0);
  slab.castShadow = true;
  slab.receiveShadow = true;
  group.add(slab);

  // Thin gilded trim tracing just the top edge, not the whole face
  const rimMat = new THREE.MeshStandardMaterial({
    color: '#e0b64a',
    roughness: 0.35,
    metalness: 0.75,
    emissive: '#d9a52c',
    emissiveIntensity: 0.35,
  });
  const trimW = 0.16;
  const trimH = 0.05;
  const trimY = topY - trimH / 2 + 0.002;
  const trimFront = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2 + trimW, trimH, trimW), rimMat);
  trimFront.position.set(0, trimY, halfDepth - trimW / 2);
  const trimBack = trimFront.clone();
  trimBack.position.z = -halfDepth + trimW / 2;
  const trimLeft = new THREE.Mesh(new THREE.BoxGeometry(trimW, trimH, halfDepth * 2 - trimW), rimMat);
  trimLeft.position.set(-halfWidth + trimW / 2, trimY, 0);
  const trimRight = trimLeft.clone();
  trimRight.position.x = halfWidth - trimW / 2;
  for (const t of [trimFront, trimBack, trimLeft, trimRight]) {
    t.receiveShadow = true;
    group.add(t);
  }

  // Marble support columns, fading down into the clouds below
  const columnMat = new THREE.MeshStandardMaterial({ color: '#e6e0d2', roughness: 0.6, metalness: 0.05 });
  const columnPositions = [
    [-halfWidth * 0.55, -halfDepth * 0.5],
    [halfWidth * 0.55, -halfDepth * 0.5],
    [-halfWidth * 0.55, halfDepth * 0.5],
    [halfWidth * 0.55, halfDepth * 0.5],
  ];
  for (const [x, z] of columnPositions) {
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 6, 10), columnMat);
    column.position.set(x, topY - thickness - 3, z);
    column.castShadow = true;
    group.add(column);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.42, 0.3, 10), rimMat);
    cap.position.set(x, topY - thickness - 0.05, z);
    group.add(cap);
  }

  // A bright cloud floor beneath the arena, instead of a void — you're
  // standing above the world, not over an abyss.
  const cloudFloorMat = new THREE.MeshBasicMaterial({ color: '#eaf3ff', transparent: true, opacity: 0.75 });
  const cloudFloor = new THREE.Mesh(new THREE.CircleGeometry(60, 24), cloudFloorMat);
  cloudFloor.rotation.x = -Math.PI / 2;
  cloudFloor.position.y = ARENA.koY + 4;
  group.add(cloudFloor);

  scene.add(group);
  return { rimMat };
}

function buildLights(scene) {
  const hemi = new THREE.HemisphereLight('#bcdcff', '#eaf3ff', 0.65);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight('#fff3d6', 1.9);
  sun.position.set(-14, 22, -8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 4;
  sun.shadow.camera.far = 60;
  sun.shadow.camera.left = -16;
  sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -12;
  sun.shadow.bias = -0.0025;
  scene.add(sun);
  scene.add(sun.target);

  const fillLight = new THREE.DirectionalLight('#cfe4ff', 0.25);
  fillLight.position.set(10, 6, 12);
  scene.add(fillLight);

  const rim = new THREE.PointLight('#ffe9b0', 0.8, 30, 2);
  rim.position.set(0, 3, -6);
  scene.add(rim);

  return { sun, hemi };
}

export function buildArenaScene(scene) {
  scene.fog = new THREE.FogExp2('#bcdcff', 0.008);
  buildSky(scene);
  buildClouds(scene);
  const { rimMat } = buildPlatform(scene);
  const { sun } = buildLights(scene);
  return { rimMat, sun };
}
