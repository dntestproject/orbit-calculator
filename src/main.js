import Lenis from "lenis";
import qrcode from "qrcode-generator";
import { mountPhones } from "./phone.js";
import { createStoryCard } from "./story.js";
import { initPixelButtons, initPixelButton } from "./pixelButton.js";
import { initTryIt } from "./tryit.js";
import { scramble } from "./scramble.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
const smoothstep = (a, b, v) => smooth((v - a) / (b - a));
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
const narrowMQ = matchMedia("(max-width: 1024px)");
const isNarrow = () => narrowMQ.matches;

const ACCENTS = ["#2e9a95", "#0a86c0", "#7352c8", "#f4782e", "#00a9cc"];
function pickAccent() {
  try {
    const saved = sessionStorage.getItem("orbit:accent");
    if (saved && ACCENTS.includes(saved)) return saved;
  } catch {}
  const pick = ACCENTS[Math.floor(Math.random() * ACCENTS.length)];
  try {
    sessionStorage.setItem("orbit:accent", pick);
  } catch {}
  return pick;
}
const accent = pickAccent();
document.documentElement.style.setProperty("--color-accent", accent);

mountPhones();
buildPrivacyMarks();
buildDownloadQr();
initPixelButtons();
initPixelButton($("[data-download]"), 404);

const story = reduced
  ? null
  : createStoryCard({ canvas: $("[data-story-canvas]"), reduced, autoStart: false });

window.__story = story;

const state = {
  lenis: null,
  booted: false,
  idleTimer: 0,
  demoPhase: "create",
  currentStatement: 0,
  shownStatements: new Set(),
  safetyShown: new Set(),
  tryIntroShown: false,
  tryHeadShown: false,
  ctaShown: false,
  progress: 0,
};

/* ------------------------------------------------------------------ */
/* loader                                                              */
/* ------------------------------------------------------------------ */

function buildLoaderTiles() {
  const host = $("#loader-tiles");
  if (!host) return [];
  const cell = window.innerWidth <= 700 ? 17 : 28;
  const cols = Math.ceil(window.innerWidth / cell) + 1;
  const rows = Math.ceil(window.innerHeight / cell) + 1;
  host.textContent = "";
  host.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  host.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
  const tiles = [];
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  const maxD = Math.hypot(cx, cy) || 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = document.createElement("i");
      const d = Math.hypot(c - cx, r - cy) / maxD;
      tiles.push({ el: i, threshold: 0.02 + 0.96 * (0.55 * d + 0.45 * Math.random()) });
      host.appendChild(i);
    }
  }
  return tiles;
}

function animateFade(el, from, to, duration, delay = 0, easing = "cubic-bezier(.4,0,.2,1)") {
  if (!el) return null;
  return el.animate([{ opacity: from }, { opacity: to }], {
    duration,
    delay,
    easing,
    fill: "forwards",
  });
}

function flyMark() {
  const loaderMark = $(".loader__mark");
  const headerMark = $(".site-header__mark");
  if (!loaderMark || !headerMark) return Promise.resolve();
  const a = loaderMark.getBoundingClientRect();
  const b = headerMark.getBoundingClientRect();
  if (!a.width || !b.width) return Promise.resolve();
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const scale = b.height / a.height;
  return new Promise((resolve) => {
    const anim = loaderMark.animate(
      [
        { transform: "translate(0px,0px) scale(1)", color: "#ffffff" },
        { transform: `translate(${dx}px,${dy}px) scale(${scale})`, color: "#ffffff" },
      ],
      { duration: 1100, easing: "cubic-bezier(.86,0,.07,1)", fill: "forwards" }
    );
    anim.onfinish = () => {
      headerMark.style.opacity = "1";
      resolve();
    };
  });
}

async function boot() {
  const loader = $("#loader");
  if (reduced) {
    if (loader) loader.style.display = "none";
    document.documentElement.classList.remove("is-loading");
    startLenis();
    state.booted = true;
    revealInitial(true);
    setupObservers();
    setupInteractions();
    startTicker();
    return;
  }
  const seen = (() => {
    try {
      return sessionStorage.getItem("orbit:seen");
    } catch {
      return null;
    }
  })();

  const tiles = buildLoaderTiles();
  const mark = $(".loader__mark");
  const count = $("#loader-count");
  const fill = $("#loader-fill");
  const fonts = Promise.all([
    document.fonts.load("400 40px PixelOperator"),
    document.fonts.load("300 70px Geist"),
    document.fonts.load("400 70px Geist"),
    document.fonts.load("500 16px Geist"),
  ]).catch(() => {});

  const started = performance.now();
  await Promise.race([fonts, new Promise((r) => setTimeout(r, 900))]);
  $(".loader")?.classList.add("is-marked");
  const minMs = seen ? 250 : 650;
  const wait = Math.max(0, minMs - (performance.now() - started));
  await new Promise((r) => setTimeout(r, wait));

  // fake progress, synced to fonts
  const p = { v: 0 };
  await new Promise((resolve) => {
    const t0 = performance.now();
    const dur = seen ? 300 : 850;
    const tick = (now) => {
      const t = clamp((now - t0) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      p.v = eased;
      if (fill) fill.style.transform = `scaleX(${eased})`;
      if (count) count.textContent = String(Math.round(eased * 100)).padStart(3, "0");
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });

  const fly = !seen && mark ? flyMark() : Promise.resolve();
  if (!seen) await fly;

  // tiles erase
  const exit = loader.animate(
    [{ backgroundColor: "rgba(18,18,18,1)" }, { backgroundColor: "rgba(18,18,18,0)" }],
    { duration: 900, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" }
  );
  const t0 = performance.now();
  const duration = 900;
  await new Promise((resolve) => {
    const tick = (now) => {
      const t = clamp((now - t0) / duration);
      for (const tile of tiles) {
        tile.el.classList.toggle("is-off", t >= tile.threshold);
      }
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
  await exit.finished.catch(() => {});
  if (loader) loader.style.display = "none";
  document.documentElement.classList.remove("is-loading");
  try {
    sessionStorage.setItem("orbit:seen", "1");
  } catch {}
  startLenis();
  state.booted = true;
  revealInitial(false);
  setupObservers();
  setupInteractions();
  startTicker();
}

function revealInitial(instant) {
  const headerReveal = $$("#site-header [data-reveal]");
  for (const el of headerReveal) {
    if (instant) {
      el.style.opacity = "1";
      el.style.transform = "none";
    } else {
      el.animate(
        [{ opacity: 0, transform: "translateY(28px)" }, { opacity: 1, transform: "none" }],
        { duration: 1000, easing: "cubic-bezier(.2,.7,.2,1)", fill: "forwards" }
      );
      el.style.opacity = "1";
    }
  }
  const lines = $$("#hero [data-reveal-line]");
  lines.forEach((el, i) => {
    if (instant) {
      el.style.transform = "none";
    } else {
      el.animate(
        [{ transform: "translateY(105%)" }, { transform: "translateY(0)" }],
        { duration: 1100, delay: 80 + i * 90, easing: "cubic-bezier(.16,1,.3,1)", fill: "forwards" }
      );
    }
  });
  $$(".rules__line").forEach((line, i) => {
    if (instant) {
      line.style.transform = "scaleY(1)";
    } else {
      line.animate([{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], {
        duration: 1500,
        delay: 300 + i * 120,
        easing: "cubic-bezier(.16,1,.3,1)",
        fill: "forwards",
      });
    }
  });
  if (!instant) $(".site-header__mark")?.animate?.( [{ opacity: 0.9 }, { opacity: 1 }], { duration: 300, fill: "forwards" });
}

function startLenis() {
  if (reduced) return;
  const lenis = new Lenis({
    lerp: 0.1,
    wheelMultiplier: 0.9,
    syncTouch: true,
    syncTouchLerp: 0.1,
    touchInertiaExponent: 1.7,
    autoRaf: true,
  });
  state.lenis = lenis;
  window.__lenis = lenis;
  console.info('%cORBIT%c make room for numbers · engine notes: /technology.html', 'font-family:PixelOperator,monospace;background:#121212;color:#fff;padding:8px 12px;letter-spacing:.18em', 'padding-left:6px;color:#8f8f8f');
}

/* ------------------------------------------------------------------ */
/* scaffold: marks, QR, phone stacks                                   */
/* ------------------------------------------------------------------ */

function buildPrivacyMarks() {
  const dots = $$(".privacy__mark");
  let seed = 9173;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (const mark of dots) {
    mark.textContent = "";
    if (mark.classList.contains("privacy__mark--qr")) {
      const n = 17;
      const cells = [];
      const inFinder = (x, y) => (x < 5 && y < 5) || (x >= n - 5 && y < 5) || (x < 5 && y >= n - 5);
      const finderOn = (x, y) => {
        let fx = x;
        let fy = y;
        if (x >= n - 5) fx = x - (n - 5);
        if (y >= n - 5) fy = y - (n - 5);
        return fx === 0 || fx === 4 || fy === 0 || fy === 4 || (fx === 2 && fy === 2);
      };
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const on = inFinder(x, y) ? finderOn(x, y) : rand() > 0.42;
          cells.push({ x, y, on, order: 0.03 + rand() * 0.94 });
        }
      }
      for (const c of cells) {
        const cell = document.createElement("i");
        if (c.on) {
          cell.className = "is-on";
          cell.dataset.order = c.order.toFixed(3);
        }
        mark.appendChild(cell);
      }
    } else {
      // a dotted wifi mark with a slash: offline, in the same dot-matrix language
      const cols = 15;
      const rows = 19;
      const cx = 7;
      const cy = 18;
      const dotsOn = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const dx = c - cx;
          const dy = r - cy;
          const d = Math.hypot(dx, dy);
          const arc = [3.4, 6.8, 10.2, 13.6].some((radius) => Math.abs(d - radius) < 0.75) && dy < 1;
          const origin = c === cx && r === cy;
          const slash = Math.abs(c - (rows - 1 - r) * 0.72) < 0.7;
          if ((arc || origin) && !slash && d < 14.5) dotsOn.push({ x: c, y: r, order: 0.04 + rand() * 0.9 });
        }
      }
      for (const d of dotsOn) {
        const cell = document.createElement("i");
        cell.className = "is-on";
        cell.style.left = `${(d.x / (cols - 1)) * 100}%`;
        cell.style.top = `${(d.y / (rows - 1)) * 100}%`;
        cell.dataset.order = d.order.toFixed(3);
        mark.appendChild(cell);
      }
    }
  }
}

function buildDownloadQr() {
  const svg = $("[data-qr-grid]");
  if (!svg) return;
  let qr;
  try {
    qr = qrcode(0, "M");
    qr.addData(`${location.origin}${location.pathname.replace(/[^/]*$/, "")}download.html`);
    qr.make();
  } catch {
    return;
  }
  const n = qr.getModuleCount();
  svg.setAttribute("viewBox", `-2 -2 ${n + 4} ${n + 4}`);
  svg.textContent = "";
  const rects = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!qr.isDark(y, x)) continue;
      const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      r.setAttribute("x", String(x));
      r.setAttribute("y", String(y));
      r.setAttribute("width", "1");
      r.setAttribute("height", "1");
      svg.appendChild(r);
      rects.push(r);
    }
  }
  const thresholds = rects.map(() => Math.random());
  svg._qr = { rects, thresholds };
}

/* ------------------------------------------------------------------ */
/* observers / reveals                                                */
/* ------------------------------------------------------------------ */

function splitLines(el) {
  if (el.dataset.linesDone) return [];
  el.dataset.linesDone = "1";
  const text = el.textContent.trim().replace(/\s+/g, " ");
  el.textContent = "";
  const words = text.split(" ");
  const spans = words.map((word, i) => {
    const s = document.createElement("span");
    s.textContent = word;
    s.style.display = "inline-block";
    el.appendChild(s);
    if (i < words.length - 1) el.appendChild(document.createTextNode(" "));
    return s;
  });
  const groups = [];
  let current = null;
  for (const span of spans) {
    const top = span.offsetTop;
    if (!current || Math.abs(current.top - top) > 2) {
      current = { top, words: [] };
      groups.push(current);
    }
    current.words.push(span.textContent);
  }
  el.textContent = "";
  const inners = [];
  for (const group of groups) {
    const line = document.createElement("span");
    line.className = "lr__line";
    line.style.display = "block";
    line.style.overflow = "hidden";
    line.style.paddingBottom = "0.12em";
    line.style.marginBottom = "-0.12em";
    const inner = document.createElement("span");
    inner.className = "lr__inner";
    inner.style.display = "block";
    inner.textContent = group.words.join(" ");
    line.appendChild(inner);
    el.appendChild(line);
    inners.push(inner);
    inner.style.transform = "translateY(112%)";
  }
  return inners;
}

function revealLines(inners, baseDelay = 0) {
  inners.forEach((inner, i) => {
    inner.animate(
      [{ transform: "translateY(112%)" }, { transform: "translateY(0)" }],
      { duration: 900, delay: baseDelay + i * 80, easing: "cubic-bezier(.2,.7,.2,1)", fill: "forwards" }
    );
  });
}

function prepareParagraphs() {
  const paragraphs = $$("#main [data-lines]");
  const map = new Map();
  paragraphs.forEach((p) => {
    const group = p.closest("[data-lines-group]") || document.body;
    if (!map.has(group)) map.set(group, []);
    map.get(group).push(p);
  });
  return map;
}

function setupObservers() {
  const groupMap = prepareParagraphs();

  const revealOnce = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        el.animate(
          [{ opacity: 0, transform: "translateY(24px)" }, { opacity: 1, transform: "none" }],
          { duration: 900, easing: "cubic-bezier(.2,.7,.2,1)", fill: "forwards" }
        );
        el.style.opacity = "1";
        revealOnce.unobserve(el);
      }
    },
    { rootMargin: "0px 0px -12% 0px" }
  );
  $$("#main [data-reveal], .cta [data-reveal]").forEach((el) => revealOnce.observe(el));

  const scrambleOnce = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        const siblings = Array.from(el.parentElement?.children || []);
        const index = Math.max(0, siblings.indexOf(el));
        scramble(el, index * 0.14, 0.85 + el.textContent.length * 0.012);
        scrambleOnce.unobserve(el);
      }
    },
    { rootMargin: "0px 0px -15% 0px" }
  );
  $$("[data-scramble]").forEach((el) => scrambleOnce.observe(el));

  const lineObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const p = entry.target;
        const group = p.closest("[data-lines-group]") || document.body;
        const list = groupMap.get(group) || [];
        let index = 0;
        for (const el of list) {
          if (el === p) break;
          index++;
        }
        const inners = splitLines(p);
        revealLines(inners, index * 120);
        lineObserver.unobserve(p);
      }
    },
    { rootMargin: "0px 0px -12% 0px" }
  );
  $$("#main [data-lines]").forEach((p) => lineObserver.observe(p));

  // CTA scramble / phone app is static; nothing else
}

/* ------------------------------------------------------------------ */
/* scroll-driven                                                       */
/* ------------------------------------------------------------------ */

const els = {};
function cacheEls() {
  applyHolds();
  Object.assign(els, {
    hero: $("#hero"),
    create: $("#create"),
    shares: $("#shares"),
    threshold: $("#threshold"),
    safetyWrap: $("#safety-wrap"),
    privacyWrap: $("#privacy-wrap"),
    tryWrap: $("#try-wrap"),
    reviewsWrap: $("#reviews-wrap"),
    cta: $("#download"),
    main: $("#main"),
    safety: $("#safety"),
    privacy: $("#privacy"),
    trySec: $("#try"),
    reviews: $("#testimonials"),
    storyPhone: $("[data-story-phone]"),
    phoneSlot: $('[data-slot="phone"]'),
    reviewsSlot: $('[data-slot="phone-reviews"]'),
    ctaSlot: $('[data-slot="cta"]'),
    trySlot: $('[data-slot="try"]'),
    heroSlot: $('[data-slot="hero"]'),
  });
  if (story) story.setAccent(accent);
}

function applyHolds() {
  $$('.pin').forEach((p) => {
    const n = isNarrow() && p.dataset.holdNarrow !== undefined ? p.dataset.holdNarrow : p.dataset.hold;
    p.style.setProperty('--hold-h', `${Number(n) || 0}svh`);
  });
}

function top(el) {
  return el ? el.getBoundingClientRect().top + window.scrollY : 0;
}
function height(el) {
  return el ? el.getBoundingClientRect().height : 0;
}

function pinProgress(wrap) {
  if (!wrap) return 0;
  const h = wrap.offsetHeight - window.innerHeight;
  if (h <= 0) return 0;
  return clamp((window.scrollY - top(wrap)) / h);
}

function updateHeaderTone() {
  const header = $("#site-header");
  if (!header) return;
  const probes = $$("[data-tone-probe]");
  for (const probe of probes) {
    const r = probe.getBoundingClientRect();
    if (r.width < 1) continue;
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    let luminance = null;
    for (const el of document.elementsFromPoint(x, y)) {
      if (el === probe || header.contains(el) || el.tagName === "CANVAS") continue;
      const bg = getComputedStyle(el).backgroundColor;
      const m = bg.match(/rgba?\(([^)]+)\)/);
      if (!m) continue;
      const parts = m[1].split(/[,/\s]+/).filter(Boolean).map(Number);
      const [rr, gg, bb, aa = 1] = parts;
      if (aa < 0.5 || Number.isNaN(rr)) continue;
      const ch = (v) => {
        const t = v / 255;
        return t <= 0.03928 ? t / 12.92 : ((t + 0.055) / 1.055) ** 2.4;
      };
      luminance = 0.2126 * ch(rr) + 0.7152 * ch(gg) + 0.0722 * ch(bb);
      break;
    }
    if (luminance !== null) probe.classList.toggle("is-inverted", luminance > 0.5);
  }
}

function updateRules() {
  const lines = $$(".rules__line");
  if (!lines.length) return;
  const mid = window.innerHeight / 2;
  const el = document.elementFromPoint(window.innerWidth * 0.3, mid);
  const bgEl = el?.closest("section, .hero, header") || el;
  const dark = bgEl ? isDark(bgEl) : true;
  const alpha = dark ? "var(--rule-alpha)" : "var(--rule-alpha-paper)";
  for (const line of lines) line.style.opacity = alpha;
}

function isDark(el) {
  let node = el;
  while (node && node !== document.documentElement) {
    const bg = getComputedStyle(node).backgroundColor;
    const m = bg.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const [r, g, b, a = 1] = m[1].split(/[,/\s]+/).filter(Boolean).map(Number);
      if (a >= 0.5) return r + g + b < 3 * 140;
    }
    node = node.parentElement;
  }
  return true;
}

function updateProgressDot() {
  const dot = $(".rules__progress");
  if (!dot) return;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const p = max > 0 ? window.scrollY / max : 0;
  dot.style.transform = `translateY(${p * (window.innerHeight - 5)}px)`;
}

function buildPixelGrid(host) {
  const width = host.offsetWidth || window.innerWidth;
  if (host._grid && host._grid.width === width) return host._grid;
  const ruleEls = $$(".rules__line").filter((l) => l.offsetWidth > 0);
  const cellSize = window.innerWidth <= 700 ? 17 : 28;
  const xs = ruleEls
    .map((l) => {
      const r = l.getBoundingClientRect();
      return r.left + r.width / 2;
    })
    .filter((x) => x > 4 && x < width - 4)
    .sort((a, b) => a - b);
  const positions = [0, ...xs, width];
  const widths = [];
  for (let i = 1; i < positions.length; i++) {
    const gap = positions[i] - positions[i - 1];
    const count = Math.max(1, Math.round(gap / cellSize));
    for (let j = 0; j < count; j++) widths.push(gap / count);
  }
  const rowHeight = widths.length ? width / widths.length : cellSize;
  host.textContent = "";
  host.style.gridTemplateColumns = widths.map((w) => `${w}px`).join(" ");
  host.style.gridAutoRows = `${rowHeight}px`;
  const tiles = [];
  const thresholds = [];
  const edge = host.dataset.pixelTransition === "bottom" ? "bottom" : "top";
  for (let row = 0; row < 3; row++) {
    const rowBias = edge === "top" ? (3 - row) / 3 : row / 3;
    for (let col = 0; col < widths.length; col++) {
      const tile = document.createElement("i");
      tile.className = "pxt__t";
      host.appendChild(tile);
      tiles.push(tile);
      const r = Math.sin(row * 997 + col * 37.1) * 43758.5453;
      const rand = r - Math.floor(r);
      thresholds.push(0.02 + (0.98 * (rowBias * 0.38 + rand * 0.72)) / 1.1);
    }
  }
  const grid = { width, tiles, thresholds, on: new Array(tiles.length).fill(false) };
  host._grid = grid;
  return grid;
}

function updatePixels() {
  const hosts = $$("[data-pixel-transition]");
  for (const host of hosts) {
    const grid = buildPixelGrid(host);
    const r = host.getBoundingClientRect();
    let p;
    if (host.dataset.pixelTransition === "bottom") {
      p = clamp((window.scrollY + window.innerHeight - r.top) / (r.height + window.innerHeight * 0.9));
      p = 1 - p;
    } else {
      const denom = window.innerHeight - r.height;
      p = denom > 0 ? clamp((window.innerHeight - r.bottom) / denom) : 0;
    }
    for (let i = 0; i < grid.tiles.length; i++) {
      const on = p >= grid.thresholds[i];
      if (on !== grid.on[i]) {
        grid.on[i] = on;
        grid.tiles[i].classList.toggle("is-on", on);
      }
    }
  }
}

function updatePhone() {
  const { safetyWrap, privacyWrap, tryWrap } = els;
  if (!safetyWrap || !els.storyPhone) return;
  const vh = window.innerHeight;
  const y = window.scrollY;
  const sTop = top(safetyWrap);
  const sEnd = sTop + safetyWrap.offsetHeight;
  const pTop = top(privacyWrap);
  const pEnd = pTop + privacyWrap.offsetHeight;
  const tTop = top(tryWrap);

  const darkW = isNarrow() ? Math.min(0.64 * window.innerWidth, 0.32 * vh) : Math.min((18.35 * window.innerWidth) / 100, 0.115 * vh * 2.9);
  const lightW = isNarrow() ? darkW * 1.25 : Math.min((26.45 * window.innerWidth) / 100, 0.21 * vh * 2.18);
  const phoneH = (w) => (w * 2000) / 985;

  let visible = false;
  let width = darkW;
  let yPos = vh;
  let lift = 0;

  if (y + vh > sTop - vh && y < pEnd) {
    visible = true;
    const enter = clamp((vh - (sTop - y)) / vh);
    const yHigh = Math.max(84, (vh - phoneH(darkW)) * 0.55);
    if (y < pTop) {
      const ps = clamp((y - sTop) / Math.max(1, safetyWrap.offsetHeight - vh));
      yPos = lerp(vh, yHigh, smooth(enter));
      yPos = lerp(yPos, vh * 0.63, smoothstep(0.3, 0.92, ps));
    } else {
      const pp = clamp((y - pTop) / Math.max(1, privacyWrap.offsetHeight - vh));
      const t = smooth(clamp(pp / 0.8));
      width = lerp(darkW, lightW, t);
      yPos = lerp(0.63 * vh, 0.48 * vh, t);
      lift = smooth(clamp((pp - 0.82) / 0.18));
      const yWhole = Math.max(0.04 * vh, vh - phoneH(lightW) - 0.08 * vh);
      yPos = lerp(yPos, yWhole, lift);
    }
    if (y > pEnd - vh * 0.16) visible = false;
  }

  const phoneLayer = els.storyPhone;
  phoneLayer.style.visibility = "visible";
  phoneLayer.style.opacity = visible ? "1" : "0";
  phoneLayer.style.setProperty("--phone-w", `${width}px`);
  phoneLayer.style.setProperty("--phone-y", `${yPos}px`);
  void tTop;
  void sEnd;
}

const poses = {
  hero: { tilt: 0, turn: 0, spin: 0, spread: 0, gone: 0, shadow: 0, play: 0 },
  create: { tilt: 0, turn: 0, spin: 0, spread: 0, gone: 0, shadow: 1, play: 0 },
  shares: { tilt: 0, turn: 0, spin: 0.12, spread: 1, gone: 0, shadow: 0.15, play: 0 },
  threshold: { tilt: 0, turn: 0, spin: 0, spread: 0, gone: 1, shadow: 0.7, play: 0 },
  safety: { tilt: 0, turn: 0, spin: Math.PI * 2, spread: 0, gone: 0, shadow: 0, play: 0 },
  privacyA: { tilt: 0, turn: 0, spin: Math.PI * 2, spread: 0, gone: 0, shadow: 0, play: 0 },
  privacyB: { tilt: -0.06, turn: 0.12, spin: Math.PI * 2, spread: 0, gone: 0, shadow: 0, play: 0 },
  privacyC: { tilt: -0.06, turn: -0.12, spin: Math.PI * 2, spread: 0, gone: 0, shadow: 0, play: 0 },
  try: { tilt: -0.7, turn: 0, spin: Math.PI * 4, spread: 0, gone: 0, shadow: 0, play: 1 },
  reviews: { tilt: -0.5, turn: -0.3, spin: Math.PI * 4, spread: 0, gone: 0, shadow: 0, play: 1 },
  cta: { tilt: -0.35, turn: 0, spin: Math.PI * 4, spread: 0, gone: 0, shadow: 1, play: 1 },
};

function updateStory() {
  if (!story) return;
  const center = window.scrollY + window.innerHeight * 0.5;
  const cTop = top(els.create);
  const shTop = top(els.shares);
  const thTop = top(els.threshold);
  const sTop = top(els.safetyWrap);
  const pTop = top(els.privacyWrap);
  const tTop = top(els.tryWrap);
  const rTop = top(els.reviewsWrap);
  const ctaTop = top(els.cta);

  let slot = els.heroSlot;
  let pose = poses.hero;

  if (center >= cTop && center < shTop) {
    slot = $('[data-slot="create"]');
    pose = poses.create;
  } else if (center >= shTop && center < thTop) {
    slot = $('[data-slot="shares"]');
    pose = poses.shares;
  } else if (center >= thTop && center < sTop) {
    slot = $('[data-slot="threshold"]');
    pose = poses.threshold;
  } else if (center >= sTop && center < pTop) {
    slot = els.phoneSlot;
    pose = poses.safety;
  } else if (center >= pTop && window.scrollY < (isNarrow() ? tTop - window.innerHeight * 0.16 : tTop)) {
    slot = els.phoneSlot;
    const pp = pinProgress(els.privacyWrap);
    pose = pp < 0.3 ? poses.privacyA : pp < 0.7 ? poses.privacyB : poses.privacyC;
  } else if (center >= pTop && center < rTop) {
    slot = els.trySlot;
    pose = poses.try;
  } else if (center >= rTop && center < ctaTop) {
    slot = els.reviewsSlot;
    pose = poses.reviews;
  } else if (center >= ctaTop) {
    slot = els.ctaSlot;
    pose = poses.cta;
  }
  story.setSlot(slot);
  story.setPose(pose);
  if (state.demoPhase === "scatter" && slot === els.trySlot) story.setScatter(true);
  else story.setScatter(false);
}

function updateSafety() {
  const wrap = els.safetyWrap;
  if (!wrap) return;
  const p = pinProgress(wrap);
  const lines = $$(".safety__lines [data-safety-line]");
  const thresholds = [0.45, 0.61];
  lines.forEach((line, i) => {
    const on = p >= thresholds[i];
    const was = state.safetyShown.has(i);
    if (on && !was) {
      state.safetyShown.add(i);
      line.style.transition = "opacity .35s ease, transform .5s cubic-bezier(.2,.7,.2,1)";
      line.style.opacity = "1";
      line.style.transform = "translateY(0)";
      line.querySelectorAll("[data-scramble-manual]").forEach((s, si) => scramble(s, si * 0.08, 0.7));
    } else if (!on && was) {
      state.safetyShown.delete(i);
      line.style.opacity = "0";
      line.style.transform = "translateY(30px)";
    }
  });
}

function animateStatementIn(el) {
  const lines = $$(".privacy__mask > span", el);
  const lede = $(".privacy__lede", el);
  el.style.visibility = "visible";
  lines.forEach((line, i) => {
    line.animate(
      [{ transform: "translateY(110%)" }, { transform: "translateY(0)" }],
      { duration: 550, delay: i * 60, easing: "cubic-bezier(.3,.7,.2,1)", fill: "forwards" }
    );
    const text = line.textContent;
    void text;
  });
  if (lede) {
    lede.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450, fill: "forwards" });
  }
}

function animateStatementOut(el) {
  const lines = $$(".privacy__mask > span", el);
  lines.forEach((line, i) => {
    line.animate(
      [{ transform: "translateY(0)" }, { transform: "translateY(-110%)" }],
      { duration: 380, delay: i * 40, easing: "cubic-bezier(.6,0,.9,.4)", fill: "forwards" }
    );
  });
  const lede = $(".privacy__lede", el);
  if (lede) lede.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "forwards" });
}

function setStatement(index, p) {
  if (index === state.currentStatement) return;
  const all = $$(".privacy__statement");
  const old = all[state.currentStatement];
  const next = all[index];
  state.currentStatement = index;
  if (old) animateStatementOut(old);
  setTimeout(() => {
    if (old) old.style.visibility = "hidden";
    animateStatementIn(next);
    next.querySelectorAll("[data-scramble-manual]").forEach((s, i) => scramble(s, i * 0.08, 0.75));
  }, reduced ? 0 : 260);
  void p;
}

function updatePrivacy() {
  const wrap = els.privacyWrap;
  if (!wrap) return;
  const p = pinProgress(wrap);
  const index = p < 0.3 ? 0 : p < 0.7 ? 1 : 2;
  if (!state.shownStatements.has(0) && window.scrollY + window.innerHeight > top(wrap) - window.innerHeight * 0.2) {
    state.shownStatements.add(0);
    const first = $('.privacy__statement[data-statement="0"]');
    animateStatementIn(first);
    first.querySelectorAll("[data-scramble-manual]").forEach((s, i) => scramble(s, 0.1 + i * 0.08, 0.8));
  }
  setStatement(index, p);

  // marks
  const qrs = $$(".privacy__mark--qr");
  const lans = $$(".privacy__mark--lan");
  const qrP = clamp((p - 0.3) / 0.1);
  const qrOff = p >= 0.62;
  for (const qr of qrs) {
    const cells = qr.querySelectorAll("i.is-on");
    cells.forEach((c) => {
      const order = Number(c.dataset.order || 0);
      c.classList.toggle("is-lit", !qrOff && qrP > order);
    });
    if (qr.dataset.qr === "0") {
      qr.style.setProperty("--rise", String(clamp(p / 0.9)));
    }
    qr.style.setProperty("--pin-h", `${window.innerHeight}px`);
  }
  const lanP = clamp((p - 0.7) / 0.1);
  const lanOff = p >= 0.94;
  for (const lan of lans) {
    lan.querySelectorAll("i.is-on").forEach((c) => {
      const order = Number(c.dataset.order || 0);
      c.classList.toggle("is-lit", !lanOff && lanP > order);
    });
  }
}

function updateTrySection() {
  const wrap = els.tryWrap;
  const sec = els.trySec;
  if (!wrap || !sec) return;
  const r = sec.getBoundingClientRect();
  const vh = window.innerHeight;
  const entry = clamp((vh - r.top) / vh);
  const inset = 26 * (1 - smooth(entry));
  sec.style.setProperty("--inset", `${inset}px`);
  const p = pinProgress(wrap);
  const ui = isNarrow() ? 1 : clamp((p - 0.05) / 0.12);
  sec.style.setProperty("--ui", String(ui));
  sec.style.setProperty("--intro", isNarrow() || p > 0.08 ? "1" : "0");
  const hello = $(".try__hello .try__mask > span");
  if (hello) {
    const hy = (1 - clamp(entry)) * 110;
    hello.style.transform = `translateY(${hy}%)`;
  }
  if (entry > 0.4 && !state.tryIntroShown) {
    state.tryIntroShown = true;
    const s = $(".try__hello [data-scramble-manual]");
    if (s) scramble(s, 0, 0.8);
  }
  if (ui > 0.3 && !state.tryHeadShown) {
    state.tryHeadShown = true;
    sec.querySelectorAll(".try__head [data-scramble]").forEach((s, i) => scramble(s, i * 0.08, 0.7));
  }
}

function updateReviews() {
  const wrap = els.reviewsWrap;
  if (!wrap) return;
  const plates = $$("[data-review]");
  const vh = window.innerHeight;
  if (isNarrow()) {
    plates.forEach((plate) => (plate.style.transform = ""));
    return;
  }
  const p = pinProgress(wrap);
  for (const plate of plates) {
    const speed = Number(plate.dataset.speed) || 1;
    const offset = lerp(vh * 0.75 * speed, -vh * 0.75 * speed, p);
    plate.style.transform = `translateY(${offset}px)`;
  }
}

function updateFooter() {
  const inner = $("#footer-inner");
  const main = els.main;
  if (!inner || !main) return;
  const mainRect = main.getBoundingClientRect();
  const footerH = inner.parentElement.offsetHeight;
  const p = clamp((window.innerHeight - mainRect.bottom) / Math.max(1, footerH));
  inner.style.transform = `translateY(${(1 - p) * 18}%)`;
}

function updateCta() {
  const sec = els.cta;
  if (!sec) return;
  const r = sec.getBoundingClientRect();
  if (r.top < window.innerHeight * 0.7 && !state.ctaShown) {
    state.ctaShown = true;
    sec.querySelectorAll("[data-scramble]").forEach((s, i) => scramble(s, i * 0.1, 0.8));
  }
}

function tick() {
  if (!state.booted) {
    requestAnimationFrame(tick);
    return;
  }
  updateHeaderTone();
  updateRules();
  updateProgressDot();
  updatePixels();
  updatePhone();
  updateSafety();
  updatePrivacy();
  updateTrySection();
  updateStory();
  updateReviews();
  updateFooter();
  updateCta();
  requestAnimationFrame(tick);
}

function startTicker() {
  story?.start();
  cacheEls();
  updatePixels();
  requestAnimationFrame(tick);
}

/* ------------------------------------------------------------------ */
/* interactions                                                        */
/* ------------------------------------------------------------------ */

function setupInteractions() {
  // try demo
  initTryIt({
    onResult(payload) {
      story?.setDisplay(payload.expression, payload.result, payload.status);
    },
    onPhase(phase) {
      state.demoPhase = phase;
      if (phase === "scatter") story?.setScatter(true);
      if (phase === "settle" || phase === "done") {
        story?.setScatter(false);
        story?.flash();
      }
      if (phase === "create") story?.setScatter(false);
    },
  });

  // download hover
  const wrapper = $("[data-dl]");
  const btn = $("[data-download]");
  if (wrapper && btn && finePointer.matches && !isNarrow()) {
    const svg = $("[data-qr-grid]");
    const qr = svg?._qr;
    const label = $(".pbtn__label", btn);
    const parent = wrapper;
    const roadmap = $(".cta__roadmap");
    const bg = $(".pbtn__tiles", btn);
    let anim = null;
    let open = false;

    const modules = () => {
      if (!qr) return;
      const t = clamp((performance.now() - animStart) / 420);
      qr.rects.forEach((r, i) => {
        const on = t >= qr.thresholds[i];
        r.classList.toggle("is-on", on);
      });
    };
    let animStart = 0;
    let moduleRaf = 0;

    const openDl = () => {
      if (open) return;
      open = true;
      const rect = parent.getBoundingClientRect();
      const side = Math.min(184, rect.width);
      btn.style.position = "absolute";
      btn.style.width = `${rect.width}px`;
      btn.style.height = `${btn.getBoundingClientRect().height}px`;
      label?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: "forwards" });
      anim?.cancel();
      anim = btn.animate(
        [
          { width: `${rect.width}px`, height: `${btn.getBoundingClientRect().height}px`, left: "0px" },
          { width: `${side}px`, height: `${side}px`, left: `${(rect.width - side) / 2}px` },
        ],
        { duration: 450, easing: "cubic-bezier(.65,0,.35,1)", fill: "forwards" }
      );
      anim.onfinish = () => {
        btn.style.width = `${side}px`;
        btn.style.height = `${side}px`;
        btn.style.left = `${(rect.width - side) / 2}px`;
      };
      const follow = Math.max(0, side - btn.getBoundingClientRect().height);
      if (roadmap) roadmap.animate([{ transform: "translateY(0)" }, { transform: `translateY(${follow}px)` }], { duration: 450, easing: "cubic-bezier(.65,0,.35,1)", fill: "forwards" });
      animStart = performance.now();
      cancelAnimationFrame(moduleRaf);
      const loop = () => {
        modules();
        if (performance.now() - animStart < 500) moduleRaf = requestAnimationFrame(loop);
      };
      moduleRaf = requestAnimationFrame(loop);
    };
    const closeDl = () => {
      if (!open) return;
      open = false;
      const rect = parent.getBoundingClientRect();
      label?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, fill: "forwards" });
      cancelAnimationFrame(moduleRaf);
      anim?.cancel();
      anim = btn.animate(
        [
          { width: `${btn.getBoundingClientRect().width}px`, height: `${btn.getBoundingClientRect().height}px`, left: `${parseFloat(btn.style.left || "0")}px` },
          { width: `${rect.width}px`, height: `${53 * (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--u")) || 1)}px`, left: "0px" },
        ],
        { duration: 380, easing: "cubic-bezier(.65,0,.35,1)", fill: "forwards" }
      );
      anim.onfinish = () => {
        btn.style.width = "";
        btn.style.height = "";
        btn.style.left = "";
      };
      if (qr) qr.rects.forEach((r) => r.classList.remove("is-on"));
      if (roadmap) roadmap.animate([{ transform: "translateY(0px)" }, { transform: "translateY(0px)" }], { duration: 1 });
      roadmap.style.transform = "";
    };
    parent.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "mouse") openDl();
    });
    parent.addEventListener("pointerleave", () => {
      if (!btn.matches(":focus-visible")) closeDl();
    });
    btn.addEventListener("focus", () => btn.matches(":focus-visible") && openDl());
    btn.addEventListener("blur", () => closeDl());
  }

  // anchor scroll for #top and internal hash links
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a) return;
    const href = a.getAttribute("href");
    if (!href) return;
    if (href.startsWith("#")) {
      const id = href.slice(1);
      if (id === "top") {
        e.preventDefault();
        if (state.lenis) state.lenis.scrollTo(0, { duration: 1.2 });
        else window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        if (state.lenis) state.lenis.scrollTo(target, { duration: 1.2 });
        else target.scrollIntoView({ behavior: "smooth" });
      }
    }
  });

  addEventListener('resize', () => {
    applyHolds();
    if (state.lenis) state.lenis.resize();
  });
  setupCursor();
  setupIdle();
  setupPageCover();
  initFooterWordmark();
}

/* ------------------------------------------------------------------ */
/* cursor                                                              */
/* ------------------------------------------------------------------ */

function setupCursor() {
  if (!finePointer.matches || window.innerWidth <= 1024) return;
  const cursor = document.createElement("div");
  cursor.className = "cursor";
  cursor.setAttribute("aria-hidden", "true");
  cursor.innerHTML = `<div class="cursor__trail"></div><i class="cursor__dot"></i><span class="cursor__label"></span>`;
  document.body.appendChild(cursor);
  const trail = $(".cursor__trail", cursor);
  const dot = $(".cursor__dot", cursor);
  const label = $(".cursor__label", cursor);
  const cells = Array.from({ length: 48 }, () => {
    const i = document.createElement("i");
    trail.appendChild(i);
    return { el: i, key: "", until: 0 };
  });
  let idx = 0;
  let visible = false;
  let last = { x: -1, y: -1 };
  let hovered = null;
  const step = 14;

  const activate = (x, y, now) => {
    const key = `${x},${y}`;
    const existing = cells.find((c) => c.key === key && c.until > now);
    if (existing) {
      existing.until = now + 260;
      return;
    }
    const cell = cells[idx];
    idx = (idx + 1) % cells.length;
    cell.key = key;
    cell.until = now + 260 * (0.6 + Math.random() * 0.8);
    cell.el.style.transform = `translate(${x * step}px, ${y * step}px)`;
    cell.el.classList.add("is-on");
  };

  const header = $("#site-header");
  const main = $("#main");
  const hideTrail = (x, y) => {
    if (!header) return false;
    const hb = header.getBoundingClientRect().bottom;
    if (y <= hb) return true;
    if (main && y < main.getBoundingClientRect().top) return true;
    return false;
  };

  addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse") return;
      if (!visible) {
        visible = true;
        cursor.classList.add("is-visible");
        dot.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
        label.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
      }
      dot.animate([{ transform: `translate(${e.clientX}px,${e.clientY}px)` }], {
        duration: 180,
        easing: "cubic-bezier(.2,.8,.2,1)",
        fill: "forwards",
      });
      label.animate([{ transform: `translate(${e.clientX}px,${e.clientY}px)` }], {
        duration: 350,
        easing: "cubic-bezier(.2,.8,.2,1)",
        fill: "forwards",
      });
      const now = performance.now();
      if (!hideTrail(e.clientX, e.clientY)) {
        const dx = last.x < 0 ? 0 : e.clientX - last.x;
        const dy = last.y < 0 ? 0 : e.clientY - last.y;
        const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / step));
        for (let i = 1; i <= Math.min(n, 12); i++) {
          const t = i / n;
          const x = (last.x < 0 ? e.clientX : last.x + dx * t) / step;
          const y = (last.y < 0 ? e.clientY : last.y + dy * t) / step;
          activate(Math.floor(x), Math.floor(y), now);
        }
      }
      last = { x: e.clientX, y: e.clientY };
    },
    { passive: true }
  );
  document.documentElement.addEventListener("pointerleave", () => cursor.classList.remove("is-visible"));
  document.documentElement.addEventListener("pointerenter", () => visible && cursor.classList.add("is-visible"));
  addEventListener("pointerdown", () => cursor.classList.add("is-down"));
  addEventListener("pointerup", () => cursor.classList.remove("is-down"));

  const q = 'a, button, [role="button"], label, input, textarea, select, [data-cursor]';
  const updateHover = (target) => {
    if (target === hovered) return;
    hovered = target;
    cursor.classList.toggle("is-hover", !!target);
    const text = target?.getAttribute?.("data-cursor") || "";
    label.textContent = text;
    cursor.classList.toggle("has-label", !!text);
  };
  addEventListener("pointerover", (e) => updateHover(e.target.closest?.(q) ?? null), { passive: true });

  const ticker = () => {
    const now = performance.now();
    for (const c of cells) {
      if (c.key && c.until <= now) {
        c.key = "";
        c.el.classList.remove("is-on");
      }
    }
    requestAnimationFrame(ticker);
  };
  requestAnimationFrame(ticker);
  addEventListener(
    "scroll",
    () => {
      const el = document.elementFromPoint(last.x, last.y);
      updateHover(el?.closest?.(q) ?? null);
    },
    { passive: true }
  );
}

/* ------------------------------------------------------------------ */
/* idle                                                                */
/* ------------------------------------------------------------------ */

function setupIdle() {
  if (isNarrow()) return;
  const reset = () => {
    if (document.documentElement.classList.contains("is-idle")) {
      document.documentElement.classList.remove("is-idle");
    }
    clearTimeout(state.idleTimer);
    state.idleTimer = setTimeout(() => {
      if (!document.hidden) document.documentElement.classList.add("is-idle");
    }, 12000);
  };
  ["pointermove", "pointerdown", "wheel", "scroll", "keydown", "touchstart"].forEach((ev) =>
    addEventListener(ev, reset, { passive: true })
  );
  reset();
}

/* ------------------------------------------------------------------ */
/* page cover                                                          */
/* ------------------------------------------------------------------ */

function setupPageCover() {
  if (reduced) return;
  const cover = document.createElement("div");
  cover.className = "page-cover";
  cover.setAttribute("aria-hidden", "true");
  document.body.appendChild(cover);
  let navigating = false;
  document.addEventListener("click", (e) => {
    if (navigating || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest?.("a[href]");
    if (!a || a.target || a.hasAttribute("download") || a.matches("[data-download]")) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.hash) return;
    if (url.pathname === location.pathname && !url.hash) return;
    e.preventDefault();
    navigating = true;
    const cell = 28;
    const cols = Math.ceil(window.innerWidth / cell);
    const rows = Math.ceil(window.innerHeight / cell);
    cover.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    cover.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    cover.textContent = "";
    const tiles = [];
    const cx = (cols - 1) / 2;
    const cy = (rows - 1) / 2;
    const maxD = Math.hypot(cx, cy) || 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const t = document.createElement("i");
        const d = Math.hypot(c - cx, r - cy) / maxD;
        tiles.push({ el: t, threshold: 0.02 + 0.96 * (d * 0.6 + Math.random() * 0.4) });
        cover.appendChild(t);
      }
    }
    cover.classList.add("is-active");
    const t0 = performance.now();
    const dur = 550;
    const step = (now) => {
      const p = clamp((now - t0) / dur);
      for (const tile of tiles) tile.el.classList.toggle("is-on", p >= tile.threshold);
      if (p < 1) requestAnimationFrame(step);
      else location.assign(url.href);
    };
    requestAnimationFrame(step);
  });
  addEventListener("pageshow", (e) => {
    if (e.persisted) {
      navigating = false;
      cover.classList.remove("is-active");
      cover.textContent = "";
    }
  });
}

/* ------------------------------------------------------------------ */
/* footer wordmark                                                     */
/* ------------------------------------------------------------------ */

function initFooterWordmark() {
  const word = $("[data-wordmark]");
  if (!word) return;
  word.addEventListener("pointerenter", () => {
    $$("span", word).forEach((s, i) => {
      s.animate([{ color: "#2a2a2a80" }, { color: "#ffffff26" }], {
        duration: 900,
        delay: i * 55,
        easing: "ease-out",
        fill: "forwards",
      });
    });
  });
  word.addEventListener("pointerleave", () => {
    $$("span", word).forEach((s) => {
      s.animate([{ color: "#ffffff26" }, { color: "#2a2a2a80" }], {
        duration: 400,
        easing: "ease-in",
        fill: "forwards",
      });
    });
  });
}

/* ------------------------------------------------------------------ */

boot();
