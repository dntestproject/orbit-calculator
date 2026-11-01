import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

const CARD_W = 1.51;
const CARD_H = 1.0;
const CARD_D = 0.036;
const GAP = 0.007;
const COLS = [
  { w: 0.345, kind: "label" },
  { w: 0.407, kind: "rib" },
  { w: 0.255, kind: "tiles" },
];
const ROWS = [0.5, 0.5];

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOutQuint = (t) => 1 - (1 - t) ** 5;
const smooth = (t) => t * t * (3 - 2 * t);

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function makeLabelTexture(accent) {
  const w = 560;
  const h = 1024;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#1b1b1b");
  g.addColorStop(0.55, "#151515");
  g.addColorStop(1, "#101010");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const rnd = mulberry(117);
  for (let i = 0; i < 9000; i++) {
    const v = rnd();
    ctx.fillStyle = `rgba(255,255,255,${v * 0.022})`;
    ctx.fillRect(rnd() * w, rnd() * h, 1.4, 1.4);
  }

  ctx.fillStyle = "rgba(255,255,255,0.006)";
  for (let i = 0; i < 26; i++) {
    ctx.fillRect(0, i * 40, w, 1);
  }

  const drawTracked = (text, x, y, size, color, tracking = 3) => {
    ctx.fillStyle = color;
    ctx.font = `${size}px PixelOperator, monospace`;
    ctx.textBaseline = "top";
    let cx = x;
    for (const ch of text) {
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + tracking;
    }
  };

  drawTracked("ORBIT", 56, 230, 58, "rgba(255,255,255,0.5)", 6);
  drawTracked("CALCULATOR", 56, 318, 36, "rgba(255,255,255,0.34)", 4);
  drawTracked("1.0", 56, 378, 30, "rgba(255,255,255,0.24)", 3);
  drawTracked("06", 56, 852, 96, "rgba(255,255,255,0.5)", 8);

  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.7;
  ctx.fillRect(56, 480, 14, 3);
  ctx.globalAlpha = 1;

  ctx.strokeStyle = "rgba(255,255,255,0.045)";
  ctx.lineWidth = 2;
  roundRectPath(ctx, 20, 20, w - 40, h - 40, 26);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeShadowTexture() {
  const w = 512;
  const h = 512;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.filter = "blur(40px)";
  ctx.fillStyle = "#fff";
  roundRectPath(ctx, 96, 146, 320, 220, 26);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

function makeRidgeGeometry(w, h) {
  return new RoundedBoxGeometry(w, h, 0.014, 2, 0.004);
}

export function createStoryCard({ canvas, reduced = false, autoStart = true }) {
  if (!canvas || reduced) return null;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch (err) {
    console.warn("StoryCard: WebGL unavailable", err);
    return null;
  }

  const accent = getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim() || "#2e9a95";
  const scene = new THREE.Scene();
  let vw = window.innerWidth;
  let vh = window.innerHeight;
  const camera = new THREE.PerspectiveCamera(28, vw / vh, 0.1, 60);
  camera.position.set(0, 0.5, 6);
  camera.lookAt(0, 0.02, 0);

  let glInfo = "";
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    glInfo = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || "");
  } catch {}
  const software = /swiftshader|llvmpipe|software|basic render/i.test(glInfo);
  const mobileGL = matchMedia('(pointer: coarse)').matches || window.innerWidth <= 1024;
  const maxDpr = software ? 0.75 : mobileGL ? 1.25 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.setSize(vw, vh);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const key = new THREE.DirectionalLight(0xffffff, 1.35);
  key.position.set(-3, 5, 5);
  scene.add(key);
  const rimLight = new THREE.DirectionalLight(0xbfe9ff, 0.8);
  rimLight.position.set(4, 1, -4);
  scene.add(rimLight);
  scene.add(new THREE.AmbientLight(0xffffff, 0.08));

  const stage = new THREE.Group();
  const poseGroup = new THREE.Group();
  stage.add(poseGroup);
  scene.add(stage);

  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x040404,
    roughness: 0.82,
    metalness: 0.04,
    envMapIntensity: 0.05,
  });
  const ribMat = new THREE.MeshStandardMaterial({
    color: 0x080808,
    roughness: 0.5,
    metalness: 0.3,
    envMapIntensity: 0.1,
  });
  const labelTex = makeLabelTexture(accent);
  const tileDarkMat = new THREE.MeshStandardMaterial({
    color: 0x050505,
    roughness: 0.6,
    metalness: 0.15,
    envMapIntensity: 0.06,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0x050505,
    emissive: new THREE.Color(accent),
    emissiveIntensity: 0.02,
    roughness: 0.4,
    metalness: 0.3,
  });

  const pieces = [];
  const tiles = [];
  const rnd = mulberry(9137);

  const colX = [];
  {
    let x = -CARD_W / 2;
    for (const col of COLS) {
      colX.push({ start: x, width: (col.w * CARD_W) / 1 });
      x += col.w * CARD_W;
    }
  }

  function buildPiece(index, colIdx, rowIdx) {
    const col = COLS[colIdx];
    const x0 = colX[colIdx].start;
    const w = colX[colIdx].width - GAP;
    const h = CARD_H * ROWS[rowIdx] - GAP;
    const cx = x0 + colX[colIdx].width / 2;
    const cy = rowIdx === 0 ? CARD_H / 4 : -CARD_H / 4;

    const group = new THREE.Group();
    group.position.set(cx, cy, 0);

    const panelGeo = new RoundedBoxGeometry(w, h, CARD_D, 3, 0.008);
    let mat = baseMat;
    if (col.kind === "label") {
      mat = baseMat.clone();
      const slice = labelTex.clone();
      slice.wrapS = slice.wrapT = THREE.ClampToEdgeWrapping;
      slice.repeat.set(1, 0.5);
      slice.offset.set(0, rowIdx === 0 ? 0.5 : 0);
      slice.needsUpdate = true;
      mat.map = slice;
      mat.emissiveMap = slice;
      mat.emissive = new THREE.Color(0xffffff);
      mat.emissiveIntensity = 0.1;
    }
    const panel = new THREE.Mesh(panelGeo, mat);
    group.add(panel);

    // accent backing plate, visible at the seams/edges
    const backingGeo = new RoundedBoxGeometry(w * 1.003, h * 1.003, CARD_D * 0.55, 2, 0.005);
    const backing = new THREE.Mesh(backingGeo, rimMat);
    backing.position.z = -CARD_D * 0.42;
    group.add(backing);

    if (col.kind === "rib") {
      const n = 15;
      const ridgeW = (w * 0.94) / n;
      const ridgeGeo = makeRidgeGeometry(ridgeW * 0.7, h * 0.94);
      for (let i = 0; i < n; i++) {
        const ridge = new THREE.Mesh(ridgeGeo, ribMat);
        ridge.position.set(-w * 0.47 + ridgeW * (i + 0.5), 0, CARD_D / 2 + 0.004);
        group.add(ridge);
      }
    }

    if (col.kind === "tiles") {
      const cols = 5;
      const rows = 6;
      const cellW = (w * 0.78) / cols;
      const cellH = (h * 0.82) / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const on = rnd() > 0.5;
          const size = cellW * (0.58 + rnd() * 0.34);
          const depth = 0.01 + rnd() * 0.016;
          const geo = new RoundedBoxGeometry(size, size * (0.9 + rnd() * 0.2), depth, 1, Math.min(0.004, depth * 0.3));
          let material;
          let tile;
          if (on) {
            material = new THREE.MeshStandardMaterial({
              color: 0x050505,
              emissive: new THREE.Color(accent),
              emissiveIntensity: 0.8 + rnd() * 1.2,
              roughness: 0.4,
              metalness: 0.25,
            });
            tile = new THREE.Mesh(geo, material);
            tile.position.set(
              -w * 0.39 + (c + 0.5) * cellW,
              -h * 0.41 + (r + 0.5) * cellH,
              CARD_D / 2 + depth / 2 - 0.002
            );
            tiles.push({ mesh: tile, mat: material, phase: rnd() * Math.PI * 2, base: material.emissiveIntensity });
          } else {
            tile = new THREE.Mesh(geo, tileDarkMat);
            tile.position.set(
              -w * 0.39 + (c + 0.5) * cellW,
              -h * 0.41 + (r + 0.5) * cellH,
              CARD_D / 2 + depth / 2 - 0.004
            );
          }
          group.add(tile);
        }
      }
    }

    group.userData = {
      index,
      colIdx,
      rowIdx,
      seat: new THREE.Vector3(cx, cy, 0),
      seatRot: new THREE.Euler(0, 0, 0),
      heading: new THREE.Vector3(cx >= 0 ? 1 : -1, 0, (rowIdx ? 1 : -1) * 0.4).normalize(),
    };
    poseGroup.add(group);
    pieces.push(group);
    return group;
  }

  let idx = 0;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) buildPiece(idx++, col, row);
  }

  // shadow
  const shadowMat = new THREE.MeshBasicMaterial({
    alphaMap: makeShadowTexture(),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    color: 0x000000,
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.3), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, -0.62, 0.06);
  shadow.renderOrder = -1;
  stage.add(shadow);

  // per-piece motion state
  const motion = pieces.map((p, i) => {
    const r = mulberry(4200 + i * 31);
    const heading = p.userData.heading;
    return {
      group: p,
      offset: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      spin: new THREE.Vector3(),
      spinVel: new THREE.Vector3(),
      heading,
      lost: i % 2 === 0,
      entry: new THREE.Vector3(
        heading.x * CARD_W * (1.7 + r() * 0.9),
        (r() - 0.5) * CARD_W * 1.1,
        heading.z * CARD_D * 6 + (r() - 0.5) * 0.6
      ),
      entrySpin: new THREE.Vector3((r() - 0.5) * 2.4, (r() - 0.5) * 2.4, (r() - 0.5) * 2.4),
      spreadVec: new THREE.Vector3(
        heading.x * CARD_W * (0.5 + r() * 0.42),
        (r() - 0.5) * CARD_H * 0.5,
        heading.z * CARD_D * 8 + (r() - 0.5) * 0.2
      ),
      spreadRot: new THREE.Vector3((r() - 0.5) * 1.1, (r() - 0.5) * 1.1, (r() - 0.5) * 0.9),
      exitVec: new THREE.Vector3(
        heading.x * CARD_W * (4.2 + r() * 1.5),
        (r() - 0.2) * CARD_W * 1.2,
        heading.z * CARD_D * 12 + (r() - 0.5) * 0.8
      ),
      exitSpin: new THREE.Vector3((r() - 0.5) * 4, (r() - 0.5) * 4, (r() - 0.5) * 4),
      keptVec: new THREE.Vector3((r() - 0.5) * CARD_W * 0.16, (r() - 0.35) * CARD_H * 0.2, (r() - 0.5) * 0.1),
      keptRot: new THREE.Vector3((r() - 0.5) * 0.9, (r() - 0.5) * 0.5, (r() - 0.5) * 0.9),
      landed: false,
      row: p.userData.rowIdx,
    };
  });

  // fly in / land timing
  let revealedAt = null;
  let clock = 0;
  const entryDuration = 1.5;

  const pose = { tilt: 0, turn: 0, spin: 0, spread: 0, gone: 0, shadow: 0, play: 0 };
  const targetPose = { ...pose };
  let demoScatter = 0;
  let demoScatterTarget = 0;
  let currentSlot = null;
  let lastRect = null;
  let flash = 0;
  let pointer = { x: 0, y: 0, ex: 0, ey: 0 };
  let running = false;
  let ready = false;
  let last = performance.now();

  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse") return;
      pointer.x = (e.clientX / vw) * 2 - 1;
      pointer.y = (e.clientY / vh) * 2 - 1;
    },
    { passive: true }
  );
  document.documentElement.addEventListener("mouseleave", () => {
    pointer.x = 0;
    pointer.y = 0;
  });

  function resetStage() {
    stage.position.set(0, 0, 0);
    stage.scale.setScalar(1);
  }

  function solve(rect) {
    if (!rect || !Number.isFinite(rect.width) || rect.width < 2) return;
    if (![stage.position.x, stage.position.y, stage.position.z, stage.scale.x].every(Number.isFinite)) resetStage();
    lastRect = rect;
    const target = rect;
    for (let i = 0; i < 3; i++) {
      camera.updateMatrixWorld();
      stage.updateMatrixWorld(true);
      const b = projectedBounds();
      if (!Number.isFinite(b.width) || b.width < 1) { resetStage(); return; }
      const factor = target.width / b.width;
      if (!Number.isFinite(factor) || factor <= 0) { resetStage(); return; }
      stage.scale.multiplyScalar(factor);
      if (!Number.isFinite(stage.scale.x) || stage.scale.x < 0.001 || stage.scale.x > 100) { resetStage(); return; }
      const b2 = projectedBounds();
      if (!Number.isFinite(b2.x) || !Number.isFinite(b2.y)) { resetStage(); return; }
      const dist = camera.position.distanceTo(stage.position);
      const perPx = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist) / vh;
      const dx = (target.x - b2.x) * perPx;
      const dy = (target.y - b2.y) * perPx;
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) { resetStage(); return; }
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      stage.position.addScaledVector(right, dx).addScaledVector(up, -dy);
    }
    if (![stage.position.x, stage.position.y, stage.position.z].every(Number.isFinite)) resetStage();
  }

  function projectedBounds() {
    camera.updateMatrixWorld();
    stage.updateMatrixWorld(true);
    if (![stage.position.x, stage.position.y, stage.position.z, stage.scale.x, camera.position.z].every(Number.isFinite)) return { width: 0, height: 0, x: 0, y: 0 };
    const corners = [
      [-CARD_W / 2, CARD_H / 2, 0],
      [CARD_W / 2, CARD_H / 2, 0],
      [-CARD_W / 2, -CARD_H / 2, 0],
      [CARD_W / 2, -CARD_H / 2, 0],
    ];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const v = new THREE.Vector3();
    for (const c of corners) {
      v.set(...c).applyMatrix4(stage.matrixWorld).project(camera);
      const x = (v.x * 0.5 + 0.5) * vw;
      const y = (1 - (v.y * 0.5 + 0.5)) * vh;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    return { width: maxX - minX, height: maxY - minY, x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  }

  function update(dt) {
    clock += dt;
    const idle = document.documentElement.classList.contains("is-idle");

    // ease pose toward target
    const pk = 1 - Math.exp(-7 * dt);
    for (const k of Object.keys(pose)) {
      pose[k] += (targetPose[k] - pose[k]) * pk;
    }
    demoScatter += (demoScatterTarget - demoScatter) * (1 - Math.exp(-5 * dt));

    pointer.ex += (pointer.x - pointer.ex) * (1 - Math.exp(-3.5 * dt));
    pointer.ey += (pointer.y - pointer.ey) * (1 - Math.exp(-3.5 * dt));

    const idleMix = idle ? 1 : 0;
    const sway = Math.sin(clock * 0.22) * 0.06;

    poseGroup.rotation.set(
      pose.tilt + sway * 0.3 + pointer.ey * 0.08 + (idle ? Math.sin(clock * 0.4) * 0.04 : 0),
      pose.turn + pointer.ex * 0.12 + (idle ? Math.cos(clock * 0.31) * 0.05 : 0),
      pose.spin + sway + (idle ? Math.sin(clock * 0.27) * 0.02 : 0)
    );

    const spread = clamp(pose.spread + demoScatter * 0.85);
    const gone = clamp(pose.gone);
    const step = dt;
    const k = 30;
    const damp = 2 * Math.sqrt(k);

    for (const m of motion) {
      const g = m.group;
      const isLost = m.lost;
      let tx = m.spreadVec.x * spread;
      let ty = m.spreadVec.y * spread;
      let tz = m.spreadVec.z * spread;
      let rx = m.spreadRot.x * spread;
      let ry = m.spreadRot.y * spread;
      let rz = m.spreadRot.z * spread;

      if (gone > 0.001) {
        if (isLost) {
          tx += m.exitVec.x * gone;
          ty += m.exitVec.y * gone;
          tz += m.exitVec.z * gone;
          rx += m.exitSpin.x * gone;
          ry += m.exitSpin.y * gone;
          rz += m.exitSpin.z * gone;
        } else {
          tx += m.keptVec.x * gone;
          ty += m.keptVec.y * gone;
          tz += m.keptVec.z * gone;
          rx += m.keptRot.x * gone;
          ry += m.keptRot.y * gone;
          rz += m.keptRot.z * gone;
        }
      }

      // entry fly-in
      if (!m.landed) {
        if (revealedAt === null) revealedAt = clock;
        const t = clamp((clock - revealedAt - m.row * 0.08) / entryDuration);
        const e = 1 - easeOutQuint(t);
        tx += m.entry.x * e;
        ty += m.entry.y * e;
        tz += m.entry.z * e;
        rx += m.entrySpin.x * e;
        ry += m.entrySpin.y * e;
        rz += m.entrySpin.z * e;
        if (t >= 1) m.landed = true;
      }

      // spring offsets
      const ox = (k * (tx - m.offset.x) - damp * m.velocity.x) * step;
      const oy = (k * (ty - m.offset.y) - damp * m.velocity.y) * step;
      const oz = (k * (tz - m.offset.z) - damp * m.velocity.z) * step;
      m.velocity.x += ox;
      m.velocity.y += oy;
      m.velocity.z += oz;
      m.offset.addScaledVector(m.velocity, step);

      m.spinVel.x += (k * (rx - m.spin.x) - damp * m.spinVel.x) * step;
      m.spinVel.y += (k * (ry - m.spin.y) - damp * m.spinVel.y) * step;
      m.spinVel.z += (k * (rz - m.spin.z) - damp * m.spinVel.z) * step;
      m.spin.addScaledVector(m.spinVel, step);

      const wob = spread * 0.02;
      g.position.set(
        m.group.userData.seat.x + m.offset.x + Math.sin(clock * 0.6 + m.row) * wob,
        m.group.userData.seat.y + m.offset.y,
        m.group.userData.seat.z + m.offset.z + Math.cos(clock * 0.5 + m.row) * wob
      );
      g.rotation.set(m.spin.x, m.spin.y, m.spin.z);
      g.visible = !(isLost && gone > 0.985);

      const split = clamp(g.position.distanceTo(m.group.userData.seat) / (CARD_W * 0.6));
      if (isLost) g.scale.setScalar(1 - gone * 0.04);
      void split;
    }

    // tile glow
    const playing = pose.play > 0.5;
    const sparkle = targetPose.play > 0.5;
    for (const t of tiles) {
      let intensity = t.base;
      if (playing) intensity *= 0.82 + 0.22 * Math.sin(clock * 5 + t.phase);
      if (sparkle) intensity *= 0.9 + 0.5 * Math.pow(Math.max(0, Math.sin(clock * 6 + t.phase * 3)), 6);
      if (idleMix) intensity *= 1 + 0.9 * Math.pow(Math.max(0, Math.sin(clock * 9 + t.phase)), 8);
      if (flash > 0) intensity += flash * 2.2;
      t.mat.emissiveIntensity = intensity;
    }
    flash = Math.max(0, flash - dt * 1.6);
    rimMat.emissiveIntensity = 0.5 + pose.play * 0.35 + flash * 1.4;

    shadowMat.opacity = clamp(pose.shadow * (1 - Math.max(spread * 2, gone * 0.45)) * 0.42);
    shadow.visible = shadowMat.opacity > 0.002;
    shadow.rotation.z = -pose.spin * 0.5;
    shadow.position.x = Math.sin(clock * 0.2) * 0.02 * (1 + pose.shadow);
    shadow.position.z = 0.06 + Math.cos(clock * 0.17) * 0.02;

    // solve to slot
    if (currentSlot) {
      const r = currentSlot.getBoundingClientRect();
      if (r.width > 2) {
        solve({
          x: r.left + r.width / 2,
          y: r.top + r.height / 2 - window.scrollY * 0,
          width: r.width,
        });
      }
    }
  }

  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const sceneRT = new THREE.WebGLRenderTarget(vw * dpr, vh * dpr, {
    type: THREE.HalfFloatType,
    samples: software ? 0 : 4,
    depthBuffer: true,
  });
  sceneRT.texture.colorSpace = THREE.NoColorSpace;

  const bloomInputRT = new THREE.WebGLRenderTarget(vw * dpr, vh * dpr, {
    type: THREE.HalfFloatType,
    samples: software ? 0 : 4,
    depthBuffer: true,
  });
  bloomInputRT.texture.colorSpace = THREE.NoColorSpace;

  const bloom = new UnrealBloomPass(new THREE.Vector2(vw * dpr, vh * dpr), 0.55, 0.2, 0.85);
  bloom.threshold = 1.15;
  bloom.strength = 0.3;
  bloom.radius = 0.2;
  bloom.clearColor = new THREE.Color(0x000000);
  bloom.setSize(vw * dpr, vh * dpr);

  const finalScene = new THREE.Scene();
  const finalCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const finalMat = new THREE.ShaderMaterial({
    depthWrite: false,
    depthTest: false,
    transparent: true,
    uniforms: {
      tDiffuse: { value: sceneRT.texture },
      tBloom: { value: bloom.renderTargetsHorizontal[0].texture },
      strength: { value: 0.9 },
      resolution: { value: new THREE.Vector2(vw * dpr, vh * dpr) },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D tDiffuse;
      uniform sampler2D tBloom;
      uniform float strength;
      uniform vec2 resolution;
      vec3 aces(vec3 x){
        const float a = 2.51; const float b = 0.03; const float c = 2.43;
        const float d = 0.59; const float e = 0.14;
        return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
      }
      vec3 lin2srgb(vec3 c){
        return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
      }
      void main(){
        vec4 c = texture2D(tDiffuse, vUv);
        vec3 b = texture2D(tBloom, vUv).rgb;
        float bl = max(b.r, max(b.g, b.b));
        vec3 col = lin2srgb(clamp(c.rgb + b * strength, 0.0, 1.0));
        gl_FragColor = vec4(col, clamp(max(c.a, bl * 1.4), 0.0, 1.0));
      }`,
  });
  const finalQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), finalMat);
  finalQuad.frustumCulled = false;
  finalScene.add(finalQuad);

  function tick(now) {
    if (!running) return;
    const raw = Math.min(0.25, (now - last) / 1000);
    last = now;
    let remaining = raw;
    let guard = 0;
    while (remaining > 0.0001 && guard++ < 16) {
      const step = Math.min(1 / 60, remaining);
      update(step);
      remaining -= step;
    }

    // bloom works on a copy so the base buffer keeps its alpha
    renderer.setRenderTarget(bloomInputRT);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);
    bloom.render(renderer, null, bloomInputRT, 1 / 60, false);

    renderer.setRenderTarget(sceneRT);
    renderer.clear();
    renderer.render(scene, camera);

    finalMat.uniforms.tBloom.value = bloom.renderTargetsHorizontal[0].texture;
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(finalScene, finalCamera);
    requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    running = true;
    ready = true;
    last = performance.now();
    requestAnimationFrame(tick);
  }

  function onResize() {
    vw = window.innerWidth;
    vh = window.innerHeight;
    camera.aspect = vw / vh;
    camera.updateProjectionMatrix();
    renderer.setSize(vw, vh);
    sceneRT.setSize(vw * dpr, vh * dpr);
    bloomInputRT.setSize(vw * dpr, vh * dpr);
    bloom.setSize(vw * dpr, vh * dpr);
    finalMat.uniforms.resolution.value.set(vw * dpr, vh * dpr);
  }
  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      running = false;
    } else if (!running) {
      running = true;
      last = performance.now();
      requestAnimationFrame(tick);
    }
  });

  if (autoStart) start();

  return {
    get ready() {
      return ready;
    },
    start,
    setSlot(el) {
      currentSlot = el;
    },
    setPose(p) {
      Object.assign(targetPose, p);
    },
    setSparkle(v) {
      targetPose.play = v ? 1 : 0;
    },
    setScatter(v) {
      demoScatterTarget = v ? 1 : 0;
    },
    flash() {
      flash = 1;
    },
    setAccent(color) {
      rimMat.emissive.set(color);
      for (const t of tiles) t.mat.emissive.set(color);
    },
    refreshRect() {
      if (lastRect && currentSlot) {
        const r = currentSlot.getBoundingClientRect();
        if (r.width > 2) lastRect = { x: r.left + r.width / 2, y: r.top + r.height / 2, width: r.width };
      }
    },
    debug: { pose, targetPose, stage },
  };
}
