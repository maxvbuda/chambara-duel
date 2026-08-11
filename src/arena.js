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
      topColor: { value: new THREE.Color('#1a0f3d') },
      midColor: { value: new THREE.Color('#5a2568') },
      horizonColor: { value: new THREE.Color('#c9602f') },
    },
    vertexShader: skyVertexShader,
    fragmentShader: skyFragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(geo, mat);
  scene.add(sky);

  // Sun disc
  const sunMat = new THREE.MeshBasicMaterial({ color: '#ffdca0', fog: false });
  const sun = new THREE.Mesh(new THREE.CircleGeometry(9, 32), sunMat);
  sun.position.set(-18, 22, -95);
  sun.lookAt(0, 22, 0);
  scene.add(sun);

  // Starfield in the upper sky
  const starCount = 400;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * 0.55; // keep to upper hemisphere-ish
    const r = 130;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = 20 + r * Math.cos(phi) * 0.6;
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: '#ffffff',
    size: 0.6,
    transparent: true,
    opacity: 0.75,
    sizeAttenuation: true,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);
}

function buildMountains(scene) {
  const mat = new THREE.MeshStandardMaterial({
    color: '#241335',
    roughness: 1,
    metalness: 0,
  });
  const group = new THREE.Group();
  const count = 14;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.sin(i * 3.1) * 0.1;
    const dist = 46 + ((i * 37) % 22);
    const h = 12 + ((i * 53) % 20);
    const r = 8 + ((i * 29) % 10);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), mat);
    cone.position.set(Math.cos(angle) * dist, h / 2 - 6, Math.sin(angle) * dist);
    cone.rotation.y = angle;
    group.add(cone);
  }
  scene.add(group);
}

function buildPlatform(scene) {
  const { halfWidth, halfDepth, topY, thickness } = ARENA;
  const group = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({
    color: '#6b5644',
    roughness: 0.92,
    metalness: 0.05,
  });
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(halfWidth * 2, thickness, halfDepth * 2),
    stoneMat
  );
  slab.position.set(0, topY - thickness / 2, 0);
  slab.castShadow = true;
  slab.receiveShadow = true;
  group.add(slab);

  // Thin glowing moss trim tracing just the top edge, not the whole face
  const rimMat = new THREE.MeshStandardMaterial({
    color: '#63d16f',
    roughness: 0.6,
    metalness: 0,
    emissive: '#3ff05a',
    emissiveIntensity: 0.4,
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

  // Tapered support pylons fading into the void below
  const pylonMat = new THREE.MeshStandardMaterial({ color: '#3a2c22', roughness: 1 });
  const pylonPositions = [
    [-halfWidth * 0.55, -halfDepth * 0.5],
    [halfWidth * 0.55, -halfDepth * 0.5],
    [-halfWidth * 0.55, halfDepth * 0.5],
    [halfWidth * 0.55, halfDepth * 0.5],
  ];
  for (const [x, z] of pylonPositions) {
    const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.15, 6, 6), pylonMat);
    pylon.position.set(x, topY - thickness - 3, z);
    pylon.castShadow = true;
    group.add(pylon);
  }

  // Soft void haze beneath the arena
  const voidMat = new THREE.MeshBasicMaterial({ color: '#120818', transparent: true, opacity: 0.55 });
  const voidPlane = new THREE.Mesh(new THREE.CircleGeometry(60, 24), voidMat);
  voidPlane.rotation.x = -Math.PI / 2;
  voidPlane.position.y = ARENA.koY + 4;
  group.add(voidPlane);

  scene.add(group);
  return { rimMat };
}

function buildLights(scene) {
  const hemi = new THREE.HemisphereLight('#9a8ce0', '#2a1a3b', 0.9);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight('#ffd9a0', 2.6);
  sun.position.set(-14, 18, -8);
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

  const fillLight = new THREE.DirectionalLight('#7ea8ff', 0.35);
  fillLight.position.set(10, 6, 12);
  scene.add(fillLight);

  const rim = new THREE.PointLight('#ff6fa0', 1.1, 30, 2);
  rim.position.set(0, 3, -6);
  scene.add(rim);

  return { sun, hemi };
}

export function buildArenaScene(scene) {
  scene.fog = new THREE.FogExp2('#3a1d4a', 0.014);
  buildSky(scene);
  buildMountains(scene);
  const { rimMat } = buildPlatform(scene);
  const { sun } = buildLights(scene);
  return { rimMat, sun };
}
