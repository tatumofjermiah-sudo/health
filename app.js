/* ═══════════════════════════════════════════════════════════════
   A New Society Health Guide — Three.js Scene + UI Interactions
   ═══════════════════════════════════════════════════════════════ */

/* ── Constants ──────────────────────────────────────────────────── */
const MIN_NODE_SCALE   = 0.01;  // prevent scale collapsing to 0
const MIN_SCROLL_HEIGHT = 1;    // floor for division; avoids ÷0 on short pages

/* ──────────────────────────────────────────────────────────────
   THREE.JS SCENE SETUP
   ────────────────────────────────────────────────────────────── */
const canvas = document.querySelector('#bg');

// Gracefully skip 3D scene if Three.js failed to load (e.g. no network)
if (typeof THREE === 'undefined') {
  console.warn('Three.js not loaded — 3D background disabled.');
  canvas.style.display = 'none';
  // Still run the UI interactions below
} else {

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x030d1a, 1);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 22);

/* ── Lighting ─────────────────────────────────────────────────── */
const ambientLight = new THREE.AmbientLight(0xffffff, 0.08);
scene.add(ambientLight);

const greenLight = new THREE.PointLight(0x00e87a, 1.8, 35);
greenLight.position.set(5, 5, 8);
scene.add(greenLight);

const goldLight = new THREE.PointLight(0xf5a623, 1.2, 28);
goldLight.position.set(-8, -3, 4);
scene.add(goldLight);

/* ──────────────────────────────────────────────────────────────
   PARTICLE FIELD  (background cellular "haze")
   ────────────────────────────────────────────────────────────── */
const PARTICLE_COUNT = 2800;
const pGeo = new THREE.BufferGeometry();
const pPos    = new Float32Array(PARTICLE_COUNT * 3);
const pColors = new Float32Array(PARTICLE_COUNT * 3);

for (let i = 0; i < PARTICLE_COUNT; i++) {
  pPos[i * 3]     = (Math.random() - 0.5) * 70;
  pPos[i * 3 + 1] = (Math.random() - 0.5) * 70;
  pPos[i * 3 + 2] = (Math.random() - 0.5) * 70;

  // ~70 % green particles, ~30 % gold
  if (Math.random() < 0.72) {
    pColors[i * 3]     = 0.0;
    pColors[i * 3 + 1] = 0.45 + Math.random() * 0.55;
    pColors[i * 3 + 2] = 0.28 + Math.random() * 0.25;
  } else {
    pColors[i * 3]     = 0.85 + Math.random() * 0.15;
    pColors[i * 3 + 1] = 0.55 + Math.random() * 0.25;
    pColors[i * 3 + 2] = 0.05;
  }
}

pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color',    new THREE.BufferAttribute(pColors, 3));

const pMat = new THREE.PointsMaterial({
  size: 0.09,
  vertexColors: true,
  transparent: true,
  opacity: 0.52,
  sizeAttenuation: true,
});
const particles = new THREE.Points(pGeo, pMat);
scene.add(particles);

/* ──────────────────────────────────────────────────────────────
   LYMPHATIC NETWORK  (nodes + connecting lines)
   ────────────────────────────────────────────────────────────── */
const NODE_COUNT = 55;
const nodeVecs = [];

for (let i = 0; i < NODE_COUNT; i++) {
  nodeVecs.push(new THREE.Vector3(
    (Math.random() - 0.5) * 34,
    (Math.random() - 0.5) * 34,
    (Math.random() - 0.5) * 34,
  ));
}

// Each node connects to its 3 nearest neighbours (no duplicate edges)
const lineArr = [];
nodeVecs.forEach((pos, i) => {
  const nearest = nodeVecs
    .map((p, j) => ({ j, d: pos.distanceTo(p) }))
    .filter(x => x.j !== i)
    .sort((a, b) => a.d - b.d)
    .slice(0, 3);

  nearest.forEach(({ j }) => {
    if (j > i) {
      lineArr.push(pos.x, pos.y, pos.z,
                   nodeVecs[j].x, nodeVecs[j].y, nodeVecs[j].z);
    }
  });
});

const lineGeo = new THREE.BufferGeometry();
lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lineArr), 3));
const lineMat = new THREE.LineBasicMaterial({
  color: 0x00e87a,
  transparent: true,
  opacity: 0.11,
});
const networkLines = new THREE.LineSegments(lineGeo, lineMat);
scene.add(networkLines);

// Small spheres at each node
const nodeMeshData = nodeVecs.map((pos) => {
  const isGold = Math.random() > 0.62;
  const size   = Math.random() * 0.18 + 0.04;
  const geo    = new THREE.SphereGeometry(size, 7, 7);
  const mat    = new THREE.MeshBasicMaterial({
    color:       isGold ? 0xf5a623 : 0x00e87a,
    transparent: true,
    opacity:     Math.random() * 0.38 + 0.18,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos);
  scene.add(mesh);
  return { mesh, phase: Math.random() * Math.PI * 2, baseY: pos.y };
});

/* ──────────────────────────────────────────────────────────────
   ORGAN ORBS  (large glowing spheres representing body centres)
   ────────────────────────────────────────────────────────────── */
const ORB_SPECS = [
  { pos: [ 7,  3, -6],  color: 0x00e87a, r: 0.65 },
  { pos: [-9, -2, -9],  color: 0xf5a623, r: 0.50 },
  { pos: [ 2, -7,  4],  color: 0x00e87a, r: 0.55 },
  { pos: [-4,  7, -3],  color: 0x7c3aed, r: 0.40 },
  { pos: [ 3,  8, -7],  color: 0xf5a623, r: 0.35 },
];

const orbData = ORB_SPECS.map(({ pos, color, r }) => {
  // Core sphere
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(r, 16, 16),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.60 }),
  );
  mesh.position.set(...pos);
  scene.add(mesh);

  // Rotating halo ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(r * 1.9, 0.025, 8, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18 }),
  );
  ring.position.set(...pos);
  ring.rotation.set(
    Math.random() * Math.PI,
    Math.random() * Math.PI,
    0,
  );
  scene.add(ring);

  return { mesh, ring, phase: Math.random() * Math.PI * 2 };
});

/* ──────────────────────────────────────────────────────────────
   STATE
   ────────────────────────────────────────────────────────────── */
const clock   = new THREE.Clock();
let mouseX    = 0;
let mouseY    = 0;
let scrollPct = 0;   // 0 → 1 across full page
const totalH  = () => Math.max(document.documentElement.scrollHeight - window.innerHeight, MIN_SCROLL_HEIGHT);

/* ──────────────────────────────────────────────────────────────
   EVENT LISTENERS  (3D-specific)
   ────────────────────────────────────────────────────────────── */
window.addEventListener('mousemove', e => {
  mouseX = (e.clientX / window.innerWidth  - 0.5) * 2;
  mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
});

window.addEventListener('scroll', () => {
  scrollPct = window.scrollY / totalH();
}, { passive: true });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ──────────────────────────────────────────────────────────────
   ANIMATION LOOP
   ────────────────────────────────────────────────────────────── */
function animate() {
  requestAnimationFrame(animate);

  const t = clock.getElapsedTime();

  /* Particle field — slow global rotation */
  particles.rotation.x =  t * 0.0045;
  particles.rotation.y =  t * 0.0030 + scrollPct * Math.PI * 0.40;

  /* Network — gentle breathing rotation */
  networkLines.rotation.x = Math.sin(t * 0.07) * 0.08;
  networkLines.rotation.y = t * 0.008 + scrollPct * Math.PI * 0.25;

  /* Node spheres — float and pulse */
  nodeMeshData.forEach(({ mesh, phase, baseY }) => {
    mesh.position.y = baseY + Math.sin(t * 0.28 + phase) * 0.30;
    mesh.material.opacity = 0.14 + Math.abs(Math.sin(t * 0.45 + phase)) * 0.32;
    const s = 1 + Math.sin(t * 0.65 + phase) * 0.11;
    mesh.scale.setScalar(Math.max(MIN_NODE_SCALE, s));
  });

  /* Organ orbs — pulse scale + rotate halo */
  orbData.forEach(({ mesh, ring, phase }) => {
    const pulse = 1 + Math.sin(t * 0.75 + phase) * 0.12;
    mesh.scale.setScalar(pulse);
    mesh.material.opacity = 0.38 + Math.abs(Math.sin(t * 0.55 + phase)) * 0.32;
    ring.rotation.x += 0.0028;
    ring.rotation.y += 0.0018;
    ring.material.opacity = 0.08 + Math.abs(Math.sin(t * 0.4 + phase)) * 0.12;
  });

  /* Moving lights */
  greenLight.position.x = Math.sin(t * 0.28) *  9;
  greenLight.position.y = Math.cos(t * 0.20) *  6;
  goldLight.position.x  = Math.cos(t * 0.22) * -11;
  goldLight.position.y  = Math.sin(t * 0.32) *   7;

  /* Camera: mouse parallax + scroll depth */
  camera.position.x += (mouseX * 2.5 - camera.position.x) * 0.035;
  camera.position.y += (-mouseY * 1.8 - camera.position.y) * 0.035;
  camera.position.z  = 22 - scrollPct * 9;
  camera.lookAt(scene.position);

  renderer.render(scene, camera);
}

animate();

} // end if (typeof THREE !== 'undefined')

/* ──────────────────────────────────────────────────────────────
   NAVBAR SCROLL STYLE  (works with or without Three.js)
   ────────────────────────────────────────────────────────────── */
window.addEventListener('scroll', () => {
  document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

/* ──────────────────────────────────────────────────────────────
   SCROLL REVEAL  (Intersection Observer)
   ────────────────────────────────────────────────────────────── */
const revealObserver = new IntersectionObserver(
  entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
  { threshold: 0.10 },
);
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

/* ──────────────────────────────────────────────────────────────
   3D CARD TILT EFFECT  (CSS perspective on mouse move)
   ────────────────────────────────────────────────────────────── */
document.querySelectorAll('.card-3d').forEach(card => {
  card.addEventListener('mousemove', e => {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left)  / r.width  - 0.5;
    const y = (e.clientY - r.top)   / r.height - 0.5;
    card.style.transform =
      `perspective(640px) rotateX(${-y * 9}deg) rotateY(${x * 9}deg) translateZ(10px)`;
  });

  card.addEventListener('mouseleave', () => {
    card.style.transform =
      'perspective(640px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
  });
});

/* ──────────────────────────────────────────────────────────────
   MOBILE NAV TOGGLE
   ────────────────────────────────────────────────────────────── */
const navToggle = document.getElementById('navToggle');
const navLinks  = document.getElementById('navLinks');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    const open = navLinks.classList.toggle('mobile-open');
    navToggle.setAttribute('aria-expanded', open);
    navToggle.textContent = open ? '✕' : '☰';
  });

  // Close nav when a link is tapped on mobile
  navLinks.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      navLinks.classList.remove('mobile-open');
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.textContent = '☰';
    });
  });
}
