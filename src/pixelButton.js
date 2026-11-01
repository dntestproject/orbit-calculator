const hash = (n) => {
  const t = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return t - Math.floor(t);
};

export function initPixelButton(btn, index = 0) {
  if (!btn || btn.dataset.pixelReady) return null;
  btn.dataset.pixelReady = "1";
  const tiles = document.createElement("span");
  tiles.className = "pbtn__tiles";
  tiles.setAttribute("aria-hidden", "true");
  btn.prepend(tiles);
  btn.classList.add("is-pixel");

  let cells = [];
  let thresholds = [];
  let state = { p: 0 };

  const apply = () => {
    for (let i = 0; i < cells.length; i++) {
      const on = state.p >= thresholds[i];
      if (cells[i].classList.contains("is-on") !== on) cells[i].classList.toggle("is-on", on);
    }
  };

  const build = () => {
    const { width, height } = btn.getBoundingClientRect();
    if (!width || !height) return;
    const rows = 4;
    const cols = Math.max(1, Math.round(width / (height / rows)));
    tiles.textContent = "";
    tiles.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    tiles.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    cells = [];
    thresholds = [];
    for (let i = 0; i < cols * rows; i++) {
      const cell = document.createElement("i");
      tiles.appendChild(cell);
      cells.push(cell);
      thresholds.push(0.02 + 0.96 * hash(index * 7919 + i));
    }
    apply();
  };

  let raf = null;
  let from = 0;
  let to = 0;
  let started = 0;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tween = (v) => {
    if (reduced) {
      state.p = v;
      apply();
      return;
    }
    cancelAnimationFrame(raf);
    from = state.p;
    to = v;
    started = performance.now();
    const dur = Math.max(60, 380 * Math.abs(to - from));
    const tick = (now) => {
      const t = Math.min(1, (now - started) / dur);
      state.p = from + (to - from) * t;
      apply();
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };

  build();
  const ro = new ResizeObserver(build);
  ro.observe(btn);

  btn.addEventListener("pointerenter", (e) => {
    if (e.pointerType === "mouse") tween(1);
  });
  btn.addEventListener("pointerleave", () => {
    if (!btn.matches(":focus-visible")) tween(0);
  });
  btn.addEventListener("focus", () => {
    if (btn.matches(":focus-visible")) tween(1);
  });
  btn.addEventListener("blur", () => tween(0));

  return { build, state, apply };
}

export function initPixelButtons(root = document) {
  root.querySelectorAll(".pbtn:not([data-download])").forEach((btn, i) => initPixelButton(btn, i + 1));
}
