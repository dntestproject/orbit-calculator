import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export const CARD_W = 1.51;
export const CARD_H = 1.0;
export const CARD_D = 0.04;

const GAP = 0.004;
const DISPLAY_H = 0.28;
const DISPLAY_W = CARD_W * 0.64;
const BRAND_W = CARD_W - DISPLAY_W;
const NUM_W = CARD_W * 0.58;
const SCI_W = CARD_W - NUM_W;
const KEY_H = CARD_H - DISPLAY_H;
const KEY_TOP_H = KEY_H * 0.4;
const KEY_BOT_H = KEY_H - KEY_TOP_H;

const NUM_KEYS = [
  { t: "AC", k: "ac" }, { t: "±", k: "" }, { t: "%", k: "" }, { t: "÷", k: "op" },
  { t: "7", k: "" }, { t: "8", k: "" }, { t: "9", k: "" }, { t: "×", k: "op" },
  { t: "4", k: "" }, { t: "5", k: "" }, { t: "6", k: "" }, { t: "−", k: "op" },
  { t: "1", k: "" }, { t: "2", k: "" }, { t: "3", k: "" }, { t: "+", k: "op" },
  { t: "( )", k: "" }, { t: "0", k: "" }, { t: ".", k: "" }, { t: "=", k: "eq" },
];

const SCI_KEYS = [
  { t: "sin", k: "sci" }, { t: "cos", k: "sci" }, { t: "tan", k: "sci" }, { t: "^", k: "sci" },
  { t: "ln", k: "sci" }, { t: "log", k: "sci" }, { t: "√", k: "sci" }, { t: "x²", k: "sci" },
  { t: "π", k: "sci" }, { t: "e", k: "sci" }, { t: "!", k: "sci" }, { t: "Ans", k: "sci" },
  { t: "2nd", k: "dim" }, { t: "DEG", k: "hot" }, { t: "MC", k: "mem" }, { t: "MR", k: "mem" },
  { t: "M+", k: "mem" }, { t: "M−", k: "mem" }, { t: "MS", k: "mem" }, { t: "HIST", k: "dim" },
];

const PIECES = [
  { id: "display", kind: "display", x: DISPLAY_W / 2, y: DISPLAY_H / 2, w: DISPLAY_W, h: DISPLAY_H, rowIdx: 0 },
  { id: "brand", kind: "brand", x: DISPLAY_W + BRAND_W / 2, y: DISPLAY_H / 2, w: BRAND_W, h: DISPLAY_H, rowIdx: 0 },
  { id: "numTop", kind: "keys", x: NUM_W / 2, y: DISPLAY_H + KEY_TOP_H / 2, w: NUM_W, h: KEY_TOP_H, rowIdx: 0, keys: "num", startRow: 0, rows: 2 },
  { id: "numBottom", kind: "keys", x: NUM_W / 2, y: DISPLAY_H + KEY_TOP_H + KEY_BOT_H / 2, w: NUM_W, h: KEY_BOT_H, rowIdx: 1, keys: "num", startRow: 2, rows: 3 },
  { id: "sciTop", kind: "keys", x: NUM_W + SCI_W / 2, y: DISPLAY_H + KEY_TOP_H / 2, w: SCI_W, h: KEY_TOP_H, rowIdx: 0, keys: "sci", startRow: 0, rows: 2 },
  { id: "sciBottom", kind: "keys", x: NUM_W + SCI_W / 2, y: DISPLAY_H + KEY_TOP_H + KEY_BOT_H / 2, w: SCI_W, h: KEY_BOT_H, rowIdx: 1, keys: "sci", startRow: 2, rows: 3 },
];

function hexRgb(hex) {
  const h = hex.replace("#", "");
  const s = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
  };
}
function rgba(hex, a) {
  const c = hexRgb(hex);
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
}
function mix(hexA, hexB, t) {
  const a = hexRgb(hexA);
  const b = hexRgb(hexB);
  const c = (x, y) => Math.round(x + (y - x) * t);
  return `rgb(${c(a.r, b.r)}, ${c(a.g, b.g)}, ${c(a.b, b.b)})`;
}
function tracked(ctx, text, x, y, size, color, tracking = 0) {
  ctx.fillStyle = color;
  ctx.font = `${size}px PixelOperator, monospace`;
  ctx.textBaseline = "top";
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + tracking;
  }
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function orbitMark(ctx, x, y, rx, ry, accent) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.42);
  ctx.strokeStyle = "#8fe3db";
  ctx.lineWidth = Math.max(1.5, rx * 0.075);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#d9f2a3";
  ctx.beginPath();
  ctx.arc(rx * 0.63, -ry * 0.52, Math.max(1.5, rx * 0.12), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  void accent;
}
function canvasTexture(c) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(2, Math.round(w));
  c.height = Math.max(2, Math.round(h));
  return c;
}

function fitText(ctx, text, x, y, maxWidth, startSize, weight, color) {
  let size = startSize;
  do {
    ctx.font = `${weight} ${size}px Geist, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth || size <= 18) break;
    size -= 3;
  } while (true);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawDisplayCanvas(c, accent, expression, result, status = "DEG · Saved to history") {
  const W = c.width;
  const H = c.height;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#081615");
  g.addColorStop(0.55, "#0b211f");
  g.addColorStop(1, mix("#0b211f", accent, 0.22));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.82, H * 0.3, 10, W * 0.82, H * 0.3, W * 0.55);
  glow.addColorStop(0, rgba(accent, 0.22));
  glow.addColorStop(1, rgba(accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const rnd = Math.random;
  for (let i = 0; i < 5000; i++) {
    ctx.fillStyle = `rgba(255,255,255,${rnd() * 0.018})`;
    ctx.fillRect(rnd() * W, rnd() * H, 1.2, 1.2);
  }
  ctx.fillStyle = "rgba(255,255,255,0.018)";
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);

  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  ctx.lineWidth = 2;
  roundRect(ctx, 18, 18, W - 36, H - 36, 26);
  ctx.stroke();

  orbitMark(ctx, 78, 78, 34, 16, accent);
  ctx.fillStyle = "#e8f7f4";
  ctx.font = "500 42px Geist, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("orbit", 126, 80);
  ctx.fillStyle = "#6f918c";
  ctx.font = "400 17px Geist, sans-serif";
  ctx.fillText("SCIENTIFIC CALCULATOR", 128, 112);

  ctx.textAlign = "right";
  ctx.fillStyle = rgba("#ffffff", 0.46);
  ctx.font = "400 21px Geist, sans-serif";
  ctx.fillText("DEG", W - 134, 76);
  ctx.strokeStyle = rgba(accent, 0.85);
  ctx.lineWidth = 2.2;
  roundRect(ctx, W - 106, 60, 44, 26, 7);
  ctx.stroke();
  ctx.fillStyle = "#8fe3db";
  ctx.fillRect(W - 100, 65, 28, 16);
  ctx.fillStyle = "#8fe3db";
  ctx.fillRect(W - 58, 68, 4, 10);

  ctx.textAlign = "right";
  fitText(ctx, expression, W - 64, H * 0.4, W * 0.62, 48, "400", "rgba(214,244,238,0.62)");
  fitText(ctx, result, W - 60, H * 0.72, W * 0.66, 168, "500", "#f5fffd");

  ctx.textAlign = "left";
  fitText(ctx, status, 64, H - 72, W * 0.62, 25, "400", "#7ba39d");

  ctx.strokeStyle = "rgba(200,245,238,0.5)";
  ctx.lineWidth = 2.4;
  roundRect(ctx, W - 132, H - 88, 22, 26, 4);
  ctx.stroke();
  roundRect(ctx, W - 124, H - 96, 22, 26, 4);
  ctx.stroke();
}

function makeDisplayTexture(accent, ratio, expression = "1250+375", result = "1,625", status = "DEG · Saved to history") {
  const W = 1440;
  const H = Math.round(W / ratio);
  const c = makeCanvas(W, H);
  drawDisplayCanvas(c, accent, expression, result, status);
  return { texture: canvasTexture(c), canvas: c };
}

function makeBrandTexture(accent, ratio) {
  const W = 760;
  const H = Math.round(W / ratio);
  const c = makeCanvas(W, H);
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#0c0e0e");
  g.addColorStop(1, mix("#0c0e0e", accent, 0.12));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < 2400; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.02})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 1.2, 1.2);
  }
  ctx.strokeStyle = "rgba(255,255,255,0.055)";
  ctx.lineWidth = 2;
  roundRect(ctx, 14, 14, W - 28, H - 28, 18);
  ctx.stroke();

  tracked(ctx, "ORBIT", 48, 40, 28, "rgba(255,255,255,0.46)", 4);
  ctx.fillStyle = "#627e7a";
  ctx.font = "400 15px Geist, sans-serif";
  ctx.fillText("SCIENTIFIC / 1.0", 48, 86);

  orbitMark(ctx, W * 0.62, H * 0.42, 105, 48, accent);

  ctx.fillStyle = "#75928d";
  ctx.font = "400 17px Geist, sans-serif";
  ctx.fillText("MEMORY", 48, H - 94);
  const mem = ["MC", "MR", "M+", "M−", "MS"];
  mem.forEach((m, i) => {
    ctx.fillStyle = i < 2 ? "#455b57" : "#86c9be";
    ctx.fillText(m, 138 + i * 58, H - 94);
  });

  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.font = "400 112px PixelOperator, monospace";
  ctx.textAlign = "right";
  ctx.fillText("06", W - 44, H - 116);
  ctx.textAlign = "left";

  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.7;
  ctx.fillRect(48, H - 52, 40, 3);
  ctx.globalAlpha = 1;

  return canvasTexture(c);
}

function keyLabelColor(kind, accent) {
  switch (kind) {
    case "eq": return "#0c201e";
    case "ac": return "#e9edc9";
    case "op": return mix(accent, "#ffffff", 0.6);
    case "sci": return "#9fe9dd";
    case "mem": return "#6e8783";
    case "dim": return "#718b87";
    case "hot": return mix(accent, "#ffffff", 0.55);
    default: return "#f4f7f6";
  }
}

function makeKeyLabels(spec, w, h, pitchW, pitchH, padX, padY, accent) {
  const W = 1024;
  const H = Math.round(W * (h / w));
  const c = makeCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, W, H);
  const scale = W / w;
  const keys = spec.keys === "num" ? NUM_KEYS : SCI_KEYS;
  const keyWpx = pitchW * scale;
  const keyHpx = pitchH * scale;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let r = 0; r < spec.rows; r++) {
    for (let col = 0; col < 4; col++) {
      const key = keys[(spec.startRow + r) * 4 + col];
      if (!key) continue;
      const localX = -w / 2 + padX + pitchW * (col + 0.5);
      const localY = h / 2 - padY - pitchH * (r + 0.5);
      const x = (localX + w / 2) * scale;
      const y = (h / 2 - localY) * scale;
      let size = keyHpx * 0.44;
      if (key.t.length > 2) size = Math.min(size, keyWpx * 0.3);
      if (key.t.length === 2) size = Math.min(size, keyWpx * 0.4);
      ctx.fillStyle = keyLabelColor(key.k, accent);
      const weight = key.k === "eq" || key.k === "op" ? "500" : "400";
      ctx.font = `${weight} ${size}px Geist, sans-serif`;
      ctx.fillText(key.t, x, y + size * 0.06);
    }
  }
  return canvasTexture(c);
}

export function createCardModel({ accent = "#2e9a95" } = {}) {
  const group = new THREE.Group();
  const pieces = [];
  const glowKeys = [];

  const slabMat = new THREE.MeshStandardMaterial({
    color: 0x060707,
    roughness: 0.82,
    metalness: 0.04,
    envMapIntensity: 0.02,
  });
  const wellMat = new THREE.MeshStandardMaterial({
    color: 0x050606,
    roughness: 0.85,
    metalness: 0.04,
    envMapIntensity: 0.02,
  });
  const keyDarkMat = new THREE.MeshStandardMaterial({
    color: 0x141616,
    roughness: 0.64,
    metalness: 0.06,
    envMapIntensity: 0.02,
  });
  const keySciMat = new THREE.MeshStandardMaterial({
    color: 0x0e1010,
    roughness: 0.66,
    metalness: 0.05,
    envMapIntensity: 0.015,
  });
  const keyMemMat = new THREE.MeshStandardMaterial({
    color: 0x0b0d0d,
    roughness: 0.68,
    metalness: 0.04,
    envMapIntensity: 0.01,
  });
  const keyDimMat = new THREE.MeshStandardMaterial({
    color: 0x0d0f0f,
    roughness: 0.68,
    metalness: 0.04,
    envMapIntensity: 0.01,
  });
  const keyAcMat = new THREE.MeshStandardMaterial({
    color: 0x2c3026,
    roughness: 0.62,
    metalness: 0.05,
    envMapIntensity: 0.02,
  });

  const rimMat = new THREE.MeshStandardMaterial({
    color: 0x040404,
    emissive: new THREE.Color(accent),
    emissiveIntensity: 0.018,
    roughness: 0.4,
    metalness: 0.25,
  });

  const glowKey = (kind, base) => {
    const mat = new THREE.MeshStandardMaterial({
      color: kind === "eq" ? new THREE.Color(accent) : 0x0e2422,
      roughness: 0.5,
      metalness: 0.1,
      emissive: new THREE.Color(accent),
      emissiveIntensity: base,
      envMapIntensity: 0.08,
    });
    return mat;
  };

  const rnd = Math.random;
  let displayState = null;

  function addKeyMesh(group, spec, w, h, col, row, padX, padY, pitchW, pitchH, keys) {
    const key = keys[(spec.startRow + row) * 4 + col];
    if (!key) return;
    const keyW = pitchW * 0.84;
    const keyH = pitchH * 0.72;
    const radius = Math.min(0.006, keyH * 0.18, keyW * 0.18);
    const geo = new RoundedBoxGeometry(keyW, keyH, 0.014, 2, radius);
    let mat = keyDarkMat;
    let base = 0;
    if (key.k === "ac") mat = keyAcMat;
    else if (key.k === "sci") mat = keySciMat;
    else if (key.k === "mem") mat = keyMemMat;
    else if (key.k === "dim") mat = keyDimMat;
    else if (key.k === "op") { mat = glowKey("op", 0.42); base = 0.42; }
    else if (key.k === "eq") { mat = glowKey("eq", 1.4); base = 1.4; }
    else if (key.k === "hot") { mat = glowKey("hot", 0.32); base = 0.32; }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      -w / 2 + padX + pitchW * (col + 0.5),
      h / 2 - padY - pitchH * (row + 0.5),
      CARD_D / 2 + 0.012
    );
    group.add(mesh);
    if (base > 0) {
      glowKeys.push({ mesh, mat, phase: rnd() * Math.PI * 2, base });
    }
  }

  function buildPiece(index, spec) {
    const w = spec.w - GAP;
    const h = spec.h - GAP;
    const cx = spec.x - CARD_W / 2;
    const cy = CARD_H / 2 - spec.y;
    const g = new THREE.Group();
    g.position.set(cx, cy, 0);

    const panel = new THREE.Mesh(new RoundedBoxGeometry(w, h, CARD_D, 3, 0.016), slabMat);
    g.add(panel);

    const backing = new THREE.Mesh(
      new RoundedBoxGeometry(w * 1.003, h * 1.003, CARD_D * 0.55, 2, 0.005),
      rimMat
    );
    backing.position.z = -CARD_D * 0.42;
    g.add(backing);

    if (spec.kind === "display") {
      const dw = w * 0.94;
      const dh = h * 0.8;
      const frame = new THREE.Mesh(
        new RoundedBoxGeometry(dw, dh, 0.014, 3, 0.014),
        new THREE.MeshStandardMaterial({
          color: 0x050707,
          emissive: new THREE.Color(accent),
          emissiveIntensity: 0.1,
          roughness: 0.35,
          metalness: 0.3,
          envMapIntensity: 0.08,
        })
      );
      frame.position.z = CARD_D / 2 + 0.003;
      g.add(frame);

      const faceW = dw * 0.965;
      const faceH = dh * 0.93;
      displayState = makeDisplayTexture(accent, faceW / faceH);
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(faceW, faceH),
        new THREE.MeshBasicMaterial({ map: displayState.texture })
      );
      face.position.z = CARD_D / 2 + 0.011;
      g.add(face);
    }

    if (spec.kind === "brand") {
      const bw = w * 0.9;
      const bh = h * 0.86;
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(bw, bh),
        new THREE.MeshBasicMaterial({ map: makeBrandTexture(accent, bw / bh) })
      );
      face.position.z = CARD_D / 2 + 0.007;
      g.add(face);
    }

    if (spec.kind === "keys") {
      const well = new THREE.Mesh(
        new RoundedBoxGeometry(w * 0.95, h * 0.9, 0.006, 2, 0.01),
        wellMat
      );
      well.position.z = CARD_D / 2 + 0.001;
      g.add(well);

      const padX = w * 0.035;
      const padY = h * 0.06;
      const pitchW = (w - padX * 2) / 4;
      const pitchH = (h - padY * 2) / spec.rows;
      const keys = spec.keys === "num" ? NUM_KEYS : SCI_KEYS;
      for (let r = 0; r < spec.rows; r++) {
        for (let col = 0; col < 4; col++) {
          addKeyMesh(g, spec, w, h, col, r, padX, padY, pitchW, pitchH, keys);
        }
      }

      const labels = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({
          map: makeKeyLabels(spec, w, h, pitchW, pitchH, padX, padY, accent),
          transparent: true,
          depthWrite: false,
        })
      );
      labels.position.z = CARD_D / 2 + 0.026;
      labels.renderOrder = 2;
      g.add(labels);
    }

    g.userData = {
      index,
      rowIdx: spec.rowIdx,
      seat: new THREE.Vector3(cx, cy, 0),
      seatRot: new THREE.Euler(0, 0, 0),
      heading: new THREE.Vector3(cx >= 0 ? 1 : -1, 0, (spec.rowIdx ? 1 : -1) * 0.4).normalize(),
    };
    group.add(g);
    pieces.push(g);
  }

  PIECES.forEach((spec, i) => buildPiece(i, spec));

  return {
    group,
    pieces,
    glowKeys,
    rimMat,
    setDisplay(expression, result, status) {
      if (!displayState) return;
      drawDisplayCanvas(displayState.canvas, accent, String(expression), String(result), status ? String(status) : "DEG · Saved to history");
      displayState.texture.needsUpdate = true;
    },
  };
}
