const POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&$@*+=/\\<>[]{}()!|:;'\",.-_^~?";

const buckets = new Map();
let measureCtx = null;

function measure(el, text) {
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  const cs = getComputedStyle(el);
  measureCtx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  return Math.round(measureCtx.measureText(text).width * 50) / 50;
}

function poolFor(el, ch) {
  const key = `${el.dataset.scrambleKey || (el.dataset.scrambleKey = String(Math.random()))}:${ch}`;
  if (buckets.has(key)) return buckets.get(key);
  const w = measure(el, ch);
  let pool = "";
  for (const c of POOL) if (measure(el, c) === w) pool += c;
  const result = pool || ch;
  buckets.set(key, result);
  return result;
}

const anims = new WeakMap();

export function scramble(el, delay = 0, duration) {
  if (!el) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const prev = anims.get(el);
  if (prev) {
    prev.kill();
    if (prev.chars.every((c) => c.span.parentNode === el)) el.textContent = prev.text;
  }
  const text = el.textContent ?? "";
  if (!text.trim() || reduced) {
    el.style.opacity = "1";
    return;
  }
  const cs = getComputedStyle(el);
  const chars = [...text].map((ch) => {
    const span = document.createElement("span");
    span.className = "scramble__c";
    span.textContent = ch;
    return { ch, span, pool: poolFor(el, ch), blank: ch.trim() === "" };
  });
  el.textContent = "";
  for (const c of chars) el.appendChild(c.span);
  const size = parseFloat(cs.fontSize) || 1;
  const widths = chars.map((c) => c.span.getBoundingClientRect().width);
  chars.forEach((c, i) => {
    c.span.style.width = `${widths[i] / size}em`;
  });
  for (const c of chars) if (!c.blank) c.span.textContent = c.pool[Math.floor(Math.random() * c.pool.length)];
  el.style.opacity = "1";

  const total = duration ?? 0.85 + chars.length * 0.012;
  let raf;
  let start = null;
  let frame = 0;
  const state = {
    chars,
    text,
    kill() {
      cancelAnimationFrame(raf);
    },
  };
  function step(now) {
    if (start === null) start = now + delay * 1000;
    const t = Math.min(1, Math.max(0, (now - start) / (total * 1000)));
    frame++;
    const revealFront = 0.25 + t * 0.75;
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      if (c.blank) continue;
      const threshold = (i / chars.length) * 0.75 + 0.25;
      if (t >= threshold) {
        if (c.span.textContent !== c.ch) c.span.textContent = c.ch;
      } else if (frame % 3 === 0) {
        c.span.textContent = c.pool[Math.floor(Math.random() * c.pool.length)];
      }
      void revealFront;
    }
    if (t < 1) raf = requestAnimationFrame(step);
    else {
      for (const c of chars) {
        c.span.textContent = c.ch;
        c.span.style.width = "";
      }
      anims.delete(el);
    }
  }
  anims.set(el, state);
  raf = requestAnimationFrame(step);
}

export function scrambleNoise(text = "", el) {
  const n = Math.max(8, text.length || 14);
  let out = "";
  for (let i = 0; i < n; i++) out += POOL[Math.floor(Math.random() * POOL.length)];
  if (el) el.textContent = out;
  return out;
}
