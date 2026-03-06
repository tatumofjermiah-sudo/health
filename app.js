/* ═══════════════════════════════════════════════════════════════
   A New Society Health Guide — Three.js Scene + UI Interactions
   ═══════════════════════════════════════════════════════════════ */

/* ── Constants ──────────────────────────────────────────────────── */
const MIN_NODE_SCALE          = 0.01;  // prevent scale collapsing to 0
const MIN_SCROLL_HEIGHT        = 1;     // floor for division; avoids ÷0 on short pages
const EDGE_STRIDE              = 6;     // floats per edge in lineArr (x1,y1,z1,x2,y2,z2)
const MOUSE_PARALLAX_X         = 2.0;  // camera parallax range on X axis
const MOUSE_PARALLAX_Y         = 1.4;  // camera parallax range on Y axis
const CAMERA_LERP_FACTOR       = 0.025; // camera position smoothing (higher = snappier)
const RING_LAG_FACTOR          = 0.10;  // cursor ring lerp speed (0 = frozen, 1 = instant)
const COUNTER_ANIMATION_STEPS  = 55;    // number of increments for the hero stat counters

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
const PARTICLE_COUNT = 1200;
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
const NODE_COUNT = 40;
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

/* Build edge list so signal pulses can travel along them */
const edges = [];
for (let i = 0; i + EDGE_STRIDE - 1 < lineArr.length; i += EDGE_STRIDE) {
  edges.push({
    start: new THREE.Vector3(lineArr[i],   lineArr[i+1], lineArr[i+2]),
    end:   new THREE.Vector3(lineArr[i+3], lineArr[i+4], lineArr[i+5]),
  });
}

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
   SIGNAL PULSES  (dots that travel along lymph network edges)
   ────────────────────────────────────────────────────────────── */
const PULSE_COUNT = 6;
const pulseData   = Array.from({ length: PULSE_COUNT }, () => {
  const isGold = Math.random() > 0.65;
  const mesh   = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 5, 5),
    new THREE.MeshBasicMaterial({
      color:       isGold ? 0xf5a623 : 0x00e87a,
      transparent: true,
      opacity:     0,
    }),
  );
  scene.add(mesh);
  return {
    mesh,
    edgeIdx: Math.floor(Math.random() * Math.max(edges.length, 1)),
    t:       Math.random(),
    speed:   0.18 + Math.random() * 0.38,
  };
});

/* ──────────────────────────────────────────────────────────────
   SHOOTING STARS  (fast streak lines that reset position)
   ────────────────────────────────────────────────────────────── */
const STAR_COUNT = 4;
const starData   = Array.from({ length: STAR_COUNT }, () => {
  const geo  = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0,0,0, 2.2,0,0]), 3));
  const mat  = new THREE.LineBasicMaterial({
    color:       Math.random() > 0.5 ? 0x00e87a : 0xf5a623,
    transparent: true,
    opacity:     0,
  });
  const line = new THREE.Line(geo, mat);
  const rawSpd = new THREE.Vector3(
    (Math.random() - 0.5) * 1.4,
    (Math.random() - 0.5) * 1.4,
    (Math.random() - 0.5) * 0.5,
  ).normalize().multiplyScalar(0.55 + Math.random() * 0.75);
  line.position.set(
    (Math.random() - 0.5) * 65,
    (Math.random() - 0.5) * 65,
    (Math.random() - 0.5) * 35,
  );
  line.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), rawSpd.clone().normalize());
  scene.add(line);
  return { line, spd: rawSpd, life: Math.random() * 4, maxLife: 3 + Math.random() * 2.5 };
});

/* ──────────────────────────────────────────────────────────────
   STATE
   ────────────────────────────────────────────────────────────── */
const clock   = new THREE.Clock();
let prevT     = 0;
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

  const t  = clock.getElapsedTime();
  const dt = Math.min(t - prevT, 0.05); // cap delta to avoid tab-blur jump
  prevT = t;

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

  /* Signal pulses — travel along lymph edges */
  if (edges.length > 0) {
    pulseData.forEach(p => {
      p.t += p.speed * dt;
      if (p.t > 1) {
        p.t = 0;
        p.edgeIdx = Math.floor(Math.random() * edges.length);
      }
      const edge = edges[p.edgeIdx];
      p.mesh.position.lerpVectors(edge.start, edge.end, p.t);
      p.mesh.material.opacity = Math.sin(p.t * Math.PI) * 0.92;
    });
  }

  /* Shooting stars */
  starData.forEach(star => {
    star.life += dt;
    const prog = star.life / star.maxLife;
    if (prog < 0.25) {
      star.line.material.opacity = (prog / 0.25) * 0.78;
    } else if (prog < 0.72) {
      star.line.material.opacity = 0.78;
    } else {
      star.line.material.opacity = ((1 - prog) / 0.28) * 0.78;
    }
    star.line.position.addScaledVector(star.spd, dt * 14);
    if (star.life >= star.maxLife) {
      star.line.position.set(
        (Math.random() - 0.5) * 65,
        (Math.random() - 0.5) * 65,
        (Math.random() - 0.5) * 35,
      );
      star.spd = new THREE.Vector3(
        (Math.random() - 0.5) * 1.4,
        (Math.random() - 0.5) * 1.4,
        (Math.random() - 0.5) * 0.5,
      ).normalize().multiplyScalar(0.55 + Math.random() * 0.75);
      star.line.quaternion.setFromUnitVectors(
        new THREE.Vector3(1, 0, 0),
        star.spd.clone().normalize(),
      );
      star.life    = 0;
      star.maxLife = 3 + Math.random() * 2.5;
    }
  });

  /* Moving lights */
  greenLight.position.x = Math.sin(t * 0.28) *  9;
  greenLight.position.y = Math.cos(t * 0.20) *  6;
  goldLight.position.x  = Math.cos(t * 0.22) * -11;
  goldLight.position.y  = Math.sin(t * 0.32) *   7;

  /* Camera: mouse parallax + scroll depth */
  camera.position.x += (mouseX * MOUSE_PARALLAX_X  - camera.position.x) * CAMERA_LERP_FACTOR;
  camera.position.y += (-mouseY * MOUSE_PARALLAX_Y - camera.position.y) * CAMERA_LERP_FACTOR;
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
    const r     = card.getBoundingClientRect();
    const normX = (e.clientX - r.left) / r.width;  // 0 → 1 left-to-right
    const normY = (e.clientY - r.top)  / r.height; // 0 → 1 top-to-bottom
    card.style.setProperty('--shine-x', `${normX * 100}%`);
    card.style.setProperty('--shine-y', `${normY * 100}%`);
    card.style.transform =
      `perspective(640px) rotateX(${-(normY - 0.5) * 12}deg) rotateY(${(normX - 0.5) * 12}deg) translateZ(10px)`;
  });

  card.addEventListener('mouseleave', () => {
    card.style.removeProperty('--shine-x');
    card.style.removeProperty('--shine-y');
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

/* ──────────────────────────────────────────────────────────────
   CUSTOM CURSOR DOT  (neon glow that follows the pointer)
   ────────────────────────────────────────────────────────────── */
const cursorDot = document.getElementById('cursor-dot');
if (cursorDot) {
  window.addEventListener('mousemove', e => {
    cursorDot.style.left = e.clientX + 'px';
    cursorDot.style.top  = e.clientY + 'px';
  });

  document.querySelectorAll('a, button, .card-3d').forEach(el => {
    el.addEventListener('mouseenter', () => cursorDot.classList.add('expanded'));
    el.addEventListener('mouseleave', () => cursorDot.classList.remove('expanded'));
  });
}

/* ──────────────────────────────────────────────────────────────
   CURSOR RING  (lagging ring element behind the dot)
   ────────────────────────────────────────────────────────────── */
const cursorRingEl = document.getElementById('cursor-ring-el');
if (cursorRingEl) {
  let ringX = 0, ringY = 0;
  let dotX  = 0, dotY  = 0;

  window.addEventListener('mousemove', e => { dotX = e.clientX; dotY = e.clientY; });

  document.querySelectorAll('a, button, .card-3d, .disease-card, .step').forEach(el => {
    el.addEventListener('mouseenter', () => cursorRingEl.classList.add('hover'));
    el.addEventListener('mouseleave', () => cursorRingEl.classList.remove('hover'));
  });

  (function animRing() {
    ringX += (dotX - ringX) * RING_LAG_FACTOR;
    ringY += (dotY - ringY) * RING_LAG_FACTOR;
    cursorRingEl.style.left = ringX + 'px';
    cursorRingEl.style.top  = ringY + 'px';
    requestAnimationFrame(animRing);
  })();
}

/* ──────────────────────────────────────────────────────────────
   MAGNETIC CTA BUTTON
   ────────────────────────────────────────────────────────────── */
const ctaBtn = document.querySelector('.cta-btn');
if (ctaBtn) {
  ctaBtn.addEventListener('mousemove', e => {
    const r  = ctaBtn.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width  / 2)) * 0.35;
    const dy = (e.clientY - (r.top  + r.height / 2)) * 0.35;
    ctaBtn.style.transform = `translateY(-4px) scale(1.04) translate(${dx}px, ${dy}px)`;
  });
  ctaBtn.addEventListener('mouseleave', () => {
    ctaBtn.style.transform = '';
  });
}

/* ──────────────────────────────────────────────────────────────
   GLITCH TEXT  (fires on highlight hover; works with gradient text)
   ────────────────────────────────────────────────────────────── */
document.querySelectorAll('.section-title .highlight').forEach(el => {
  el.addEventListener('mouseenter', () => {
    el.classList.add('glitch');
    setTimeout(() => el.classList.remove('glitch'), 580);
  });
});

/* ──────────────────────────────────────────────────────────────
   ANIMATED COUNTERS  (fires once when stats strip scrolls into view)
   ────────────────────────────────────────────────────────────── */
function animateCounter(el, target, suffix) {
  let current = 0;
  const step  = target / COUNTER_ANIMATION_STEPS;
  const id    = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = Math.round(current) + suffix;
    if (current >= target) clearInterval(id);
  }, 22);
}

const statsObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.querySelectorAll('[data-count]').forEach(counter => {
      animateCounter(counter, parseFloat(counter.dataset.count), counter.dataset.suffix || '');
    });
    statsObs.unobserve(e.target);
  });
}, { threshold: 0.5 });
document.querySelectorAll('.stats-strip').forEach(el => statsObs.observe(el));

/* ──────────────────────────────────────────────────────────────
   FLOATING HERO PARTICLES  (generated via JS, styled by CSS)
   ────────────────────────────────────────────────────────────── */
(function spawnHeroParticles() {
  const hero = document.getElementById('hero');
  if (!hero) return;
  const wrap = document.createElement('div');
  wrap.className = 'hero-particles';
  wrap.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 22; i++) {
    const p = document.createElement('div');
    p.className = 'hero-particle';
    p.style.cssText = [
      `left:${Math.random() * 100}%`,
      `bottom:${Math.random() * 25}%`,
      `--dur:${4 + Math.random() * 5}s`,
      `--delay:${Math.random() * 7}s`,
      `width:${1.5 + Math.random() * 2.5}px`,
      `height:${1.5 + Math.random() * 2.5}px`,
      `background:${Math.random() > 0.45 ? 'var(--green)' : 'var(--gold)'}`,
    ].join(';');
    wrap.appendChild(p);
  }
  hero.appendChild(wrap);
})();

/* ──────────────────────────────────────────────────────────────
   KNOWLEDGE WEB  (interactive 2D canvas spider-web navigator)
   Click any node to smooth-scroll to that section.
   ────────────────────────────────────────────────────────────── */
(function initWebNav() {
  const wc = document.getElementById('web-canvas');
  if (!wc) return;
  const ctx = wc.getContext('2d');

  // Node definitions: angle in turns (0 = right, 0.25 = down), dist = fraction of radius
  const NODES = [
    { id: 'center',   label: ['Your', 'Body'],          target: null,        angle: 0,      dist: 0 },
    { id: 'truth',    label: ['Core', 'Teaching'],      target: '#truth',    angle: -0.25,  dist: 1 },
    { id: 'yahki',    label: ['Yahki', 'Awakened'],     target: '#yahki',    angle: -0.07,  dist: 1 },
    { id: 'electric', label: ['Dr. Sebi'],              target: '#electric', angle:  0.12,  dist: 1 },
    { id: 'acid',     label: ['Acid &', 'Alkaline'],    target: '#acid',     angle:  0.30,  dist: 1 },
    { id: 'foods',    label: ['Electric', 'Foods'],     target: '#foods',    angle:  0.46,  dist: 1 },
    { id: 'lymph',    label: ['Lymphatic', 'System'],   target: '#lymph',    angle: -0.43,  dist: 1 },
    { id: 'healing',  label: ['Healing', 'Path'],       target: '#healing',  angle: -0.60,  dist: 1 },
  ];

  // Color per node
  const NODE_COLORS = {
    center: '#00e87a', truth: '#00e87a', yahki: '#f5a623',
    electric: '#f5a623', acid: '#7c3aed', foods: '#00e87a',
    lymph: '#7c3aed', healing: '#00e87a',
  };

  // Edge pairs [fromIdx, toIdx]
  const EDGES = [
    [0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7],   // hub spokes
    [1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,1],   // outer ring
    [1,4],[2,5],[3,6],                            // cross-web diagonals
  ];

  let W, H, CX, CY, RAD;
  let hoverIdx = -1;
  let animT = 0;

  function resize() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);  // reset any previous scaling
    W = wc.parentElement.offsetWidth;
    H = Math.min(Math.round(W * 0.52), 500);
    wc.width  = W * window.devicePixelRatio;
    wc.height = H * window.devicePixelRatio;
    wc.style.width  = W + 'px';
    wc.style.height = H + 'px';
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    CX  = W * 0.5;
    CY  = H * 0.5;
    RAD = Math.min(W, H) * 0.38;
    NODES.forEach(n => {
      const a = n.angle * Math.PI * 2;
      n.px = CX + Math.cos(a) * RAD * n.dist;
      n.py = CY + Math.sin(a) * RAD * n.dist;
    });
  }

  function nodeR(i) { return i === 0 ? 26 : 17; }

  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return `${r},${g},${b}`;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Edges
    EDGES.forEach(([ai, bi]) => {
      const a = NODES[ai], b = NODES[bi];
      const isLit = hoverIdx === ai || hoverIdx === bi;
      ctx.beginPath();
      ctx.moveTo(a.px, a.py);
      ctx.lineTo(b.px, b.py);
      ctx.strokeStyle = isLit
        ? `rgba(0,232,122,0.55)`
        : `rgba(0,232,122,0.12)`;
      ctx.lineWidth = isLit ? 1.5 : 0.7;
      ctx.stroke();
    });

    // Nodes
    NODES.forEach((n, i) => {
      const r      = nodeR(i);
      const isHov  = hoverIdx === i;
      const color  = NODE_COLORS[n.id];
      const rgb    = hexToRgb(color);
      const pulse  = 1 + Math.sin(animT * 1.6 + i * 0.85) * (i === 0 ? 0.10 : 0.06);
      const dr     = r * pulse;

      // Glow halo
      const grd = ctx.createRadialGradient(n.px, n.py, 0, n.px, n.py, dr * 2.4);
      grd.addColorStop(0, `rgba(${rgb},${isHov ? 0.30 : 0.14})`);
      grd.addColorStop(1, `rgba(${rgb},0)`);
      ctx.beginPath();
      ctx.arc(n.px, n.py, dr * 2.4, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      // Circle fill
      ctx.beginPath();
      ctx.arc(n.px, n.py, dr, 0, Math.PI * 2);
      ctx.fillStyle = isHov ? `rgba(${rgb},0.32)` : `rgba(${rgb},0.10)`;
      ctx.fill();

      // Circle border
      ctx.beginPath();
      ctx.arc(n.px, n.py, dr, 0, Math.PI * 2);
      ctx.strokeStyle = isHov ? color : `rgba(${rgb},0.65)`;
      ctx.lineWidth   = isHov ? 2.2 : 1.4;
      ctx.stroke();

      // Label
      ctx.fillStyle    = isHov ? '#ffffff' : color;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      const fontSize   = i === 0 ? 11 : 9;
      ctx.font         = `600 ${fontSize}px 'Space Grotesk', sans-serif`;
      if (n.label.length === 1) {
        ctx.fillText(n.label[0], n.px, n.py);
      } else {
        ctx.fillText(n.label[0], n.px, n.py - 5.5);
        ctx.fillText(n.label[1], n.px, n.py + 5.5);
      }

      // "tap to visit" hint on hover
      if (isHov && i > 0) {
        ctx.fillStyle    = `rgba(0,232,122,0.70)`;
        ctx.font         = `500 9px Inter, sans-serif`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('→ tap to visit', n.px, n.py + dr + 5);
      }
    });
  }

  let rafId;
  function loop(ts) {
    animT = ts / 1000;
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function hitTest(mx, my) {
    for (let i = 0; i < NODES.length; i++) {
      const n  = NODES[i];
      const r  = nodeR(i) * 1.5;
      const dx = mx - n.px, dy = my - n.py;
      if (dx * dx + dy * dy <= r * r) return i;
    }
    return -1;
  }

  function navigateTo(idx) {
    if (idx < 0) return;
    const t = NODES[idx].target;
    if (t) {
      const el = document.querySelector(t);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  wc.addEventListener('mousemove', e => {
    const rect = wc.getBoundingClientRect();
    hoverIdx = hitTest(e.clientX - rect.left, e.clientY - rect.top);
    wc.style.cursor = hoverIdx > 0 ? 'pointer' : 'default';
  });
  wc.addEventListener('mouseleave', () => { hoverIdx = -1; });
  wc.addEventListener('click', e => {
    const rect = wc.getBoundingClientRect();
    navigateTo(hitTest(e.clientX - rect.left, e.clientY - rect.top));
  });
  wc.addEventListener('touchend', e => {
    const touch = e.changedTouches[0];
    const rect  = wc.getBoundingClientRect();
    const idx   = hitTest(touch.clientX - rect.left, touch.clientY - rect.top);
    if (idx >= 0) {
      navigateTo(idx);
      e.preventDefault();  // only block scroll when a node was actually hit
    }
  }, { passive: false });

  let resizeTimer;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(rafId);        // stop current frame immediately
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      rafId = requestAnimationFrame(loop);
    }, 120);
  });

  resize();
  rafId = requestAnimationFrame(loop);
})();

/* ──────────────────────────────────────────────────────────────
   DISEASE CARD EXPAND / COLLAPSE
   Click a disease-card to reveal a brief explanation paragraph.
   ────────────────────────────────────────────────────────────── */
document.querySelectorAll('.disease-card').forEach(card => {
  const detail = card.querySelector('.disease-detail');
  if (!detail) return;

  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-expanded', 'false');

  function toggleCard() {
    const open = card.classList.toggle('open');
    card.setAttribute('aria-expanded', String(open));
  }

  card.addEventListener('click', toggleCard);
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCard(); }
  });
});
