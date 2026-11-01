import { scramble } from "./scramble.js";

function hashCells(seed, count = 48) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const cells = [];
  for (let i = 0; i < count; i++) {
    h ^= h << 13; h >>>= 0;
    h ^= h >>> 17;
    h ^= h << 5; h >>>= 0;
    const v = h & 255;
    cells.push(v < 118 ? 0 : v < 236 ? 1 : 2);
  }
  return cells;
}

const NAMES = ["Nadia", "Marcus", "Priya", "Elif", "Jonas", "Amara"];
const CURRENCIES = {
  USD: { locale: "en-US", decimals: 2 },
  EUR: { locale: "de-DE", decimals: 2 },
  GBP: { locale: "en-GB", decimals: 2 },
  IDR: { locale: "id-ID", decimals: 0 },
};
const STEPS = {
  create: { count: "1/2", name: ["Split the bill"] },
  recover: { count: "2/2", name: ["Take your shares"] },
  done: { count: "2/2", name: ["Take your shares"] },
};

function parseMinor(value, currency) {
  let s = String(value).trim().replace(/[^\d.,-]/g, "");
  if (!s || s.includes("-")) return null;
  if (s.includes(",") && !s.includes(".") && /,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  s = s.replace(/,/g, "");
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  const d = CURRENCIES[currency].decimals;
  const minor = Math.round(n * (d ? 100 : 1));
  if (!Number.isFinite(minor) || minor <= 0 || minor > 1e13) return null;
  return minor;
}

function formatMinor(minor, currency) {
  const c = CURRENCIES[currency];
  try {
    return new Intl.NumberFormat(c.locale, {
      style: "currency",
      currency,
      minimumFractionDigits: c.decimals,
      maximumFractionDigits: c.decimals,
    }).format(minor / (c.decimals ? 100 : 1));
  } catch {
    return `${currency} ${(minor / (c.decimals ? 100 : 1)).toFixed(c.decimals)}`;
  }
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {}
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {}
  ta.remove();
  return ok;
}

function makeMosaic(seed) {
  const cells = hashCells(seed, 48);
  const frag = document.createDocumentFragment();
  for (const v of cells) {
    const cell = document.createElement("i");
    if (v === 1 || v === 2) cell.className = "is-on";
    if (v === 2) cell.classList.add("is-hi");
    frag.appendChild(cell);
  }
  return frag;
}

export function initTryIt({ onPhase, onResult } = {}) {
  const root = document.querySelector("[data-try]");
  if (!root) return;
  const input = root.querySelector("[data-try-input]");
  const out = root.querySelector("[data-try-out]");
  const countLabel = root.querySelector("[data-try-count-label]");
  const nameEl = root.querySelector("[data-try-name]");
  const kOut = root.querySelector("[data-try-k]");
  const steps = Array.from(root.querySelectorAll("[data-try-step]"));
  const go = root.querySelector("[data-try-share-all]");
  const sharesWrap = root.querySelector("[data-try-shares]");
  const live = root.querySelector("[data-try-live]");
  const ok = root.querySelector("[data-try-ok]");
  const resetBtn = root.querySelector("[data-try-reset]");
  const currencySelect = root.querySelector("[data-try-currency]");
  const fieldLabel = root.querySelector("[data-try-field-label]");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let step = "create";
  let K = 3;
  let currency = "USD";
  let totalMinor = 0;
  let perMinor = 0;
  let cards = [];
  const copied = new Set();
  let timers = [];
  let previewed = false;
  let previewTimer = 0;
  let flashTimer = 0;

  const clearTimers = () => {
    timers.forEach(clearTimeout);
    timers = [];
    clearTimeout(previewTimer);
    clearTimeout(flashTimer);
  };
  const later = (ms, fn) => timers.push(setTimeout(fn, reduced ? 0 : ms));

  const currentMinor = () => parseMinor(input.value, currency);

  const validate = () => {
    const minor = currentMinor();
    go.disabled = minor === null;
    return minor;
  };

  const setK = (v) => {
    K = Math.max(3, Math.min(6, v));
    kOut.textContent = String(K).padStart(2, "0");
    for (const b of steps) b.disabled = Number(b.dataset.tryStep) < 0 ? K <= 3 : K >= 6;
  };

  const setStep = (next) => {
    step = next;
    root.dataset.step = next;
    const { count, name } = STEPS[next];
    countLabel.textContent = count;
    nameEl.textContent = "";
    const span = document.createElement("span");
    span.textContent = name[0];
    span.dataset.scramble = "";
    nameEl.appendChild(span);
    scramble(span, 0.05, 0.7);
    const create = next === "create";
    input.tabIndex = create ? 0 : -1;
    input.readOnly = !create;
    for (const card of cards) card.btn.tabIndex = next === "recover" ? 0 : -1;
    fieldLabel.textContent = create ? "Your bill" : "Each person pays";
    if (next === "done") later(0, () => resetBtn?.focus({ preventScroll: true }));
    onPhase?.(next);
  };

  const schedulePreview = () => {
    clearTimeout(previewTimer);
    if (step !== "create") return;
    previewTimer = setTimeout(() => {
      if (step !== "create") return;
      const minor = currentMinor();
      if (minor === null) return;
      onResult?.({
        expression: "Your bill",
        result: formatMinor(minor, currency),
        status: "SPLIT · EXACT TO THE CENT",
      });
    }, 140);
  };

  const layoutShares = () => {
    if (!sharesWrap) return;
    if (reduced || window.innerWidth <= 1024) {
      sharesWrap.style.width = "";
      sharesWrap.style.left = "";
      sharesWrap.style.right = "";
      sharesWrap.style.transform = "";
      sharesWrap.style.gridTemplateColumns = "";
      return;
    }
    const lines = document.querySelectorAll(".rules__line");
    const r1 = lines[0]?.getBoundingClientRect().left ?? 0;
    const r4 = lines[3]?.getBoundingClientRect().left ?? window.innerWidth;
    const fullW = Math.max(0, r4 - r1);
    const width = fullW * (K / 6);
    sharesWrap.style.width = `${width}px`;
    sharesWrap.style.left = "50%";
    sharesWrap.style.right = "auto";
    sharesWrap.style.transform = "translateX(-50%)";
    sharesWrap.style.gridTemplateColumns = `repeat(${K}, minmax(0, 1fr))`;
  };

  const buildCards = () => {
    sharesWrap.textContent = "";
    cards = [];
    copied.clear();
    for (let i = 0; i < K; i++) {
      const name = NAMES[i % NAMES.length];
      const amount = formatMinor(perMinor, currency);
      const btn = document.createElement("button");
      btn.className = "try__share";
      btn.type = "button";
      btn.dataset.tryShare = String(i);
      btn.dataset.cursor = "Copy share";
      btn.setAttribute("aria-pressed", "false");
      btn.setAttribute("aria-label", `Copy ${name}'s share, ${amount}`);
      btn.style.setProperty("--delay", `${0.45 + i * 0.05}s`);

      const mosaic = document.createElement("span");
      mosaic.className = "try__mosaic";
      mosaic.appendChild(makeMosaic(`${name}:${totalMinor}:${K}`));

      const meta = document.createElement("span");
      meta.className = "try__meta";
      meta.setAttribute("aria-hidden", "true");
      const n = document.createElement("b");
      n.textContent = name;
      const code = document.createElement("code");
      code.textContent = amount;
      meta.append(n, code);

      btn.append(mosaic, meta);
      btn.addEventListener("click", () => copyShare(i));
      sharesWrap.appendChild(btn);
      cards.push({ btn, name, amount });
    }
    layoutShares();
  };

  const restoreOut = () => {
    if (step !== "recover") return;
    out.classList.add("is-sum");
    out.textContent = formatMinor(perMinor, currency);
  };

  const copyShare = async (index) => {
    if (step !== "recover") return;
    const card = cards[index];
    if (!card) return;
    const text = `${card.name}'s share: ${card.amount} (${K}-way split of ${formatMinor(totalMinor, currency)})`;
    const copiedOk = await copyText(text);
    copied.add(index);
    card.btn.setAttribute("aria-pressed", "true");
    card.btn.setAttribute("aria-label", `Copied ${card.name}'s share, ${card.amount}`);
    live.textContent = copiedOk
      ? `${card.name}'s share copied: ${card.amount}`
      : `Share ready: ${card.amount}. Clipboard is blocked; select the amount manually.`;
    out.textContent = copiedOk ? `Copied · ${card.amount}` : `Share · ${card.amount}`;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(restoreOut, 1500);
    onResult?.({
      expression: `${card.name}'s share`,
      result: card.amount,
      status: "COPIED TO CLIPBOARD",
    });
    if (copied.size >= K) later(450, complete);
  };

  const complete = () => {
    if (step !== "recover") return;
    clearTimeout(flashTimer);
    setStep("done");
    out.textContent = formatMinor(perMinor, currency);
    ok.textContent = "All shares copied";
    scramble(ok, 0, 0.6);
    live.textContent = `All ${K} shares copied. ${formatMinor(perMinor, currency)} each.`;
    onResult?.({
      expression: `${K} shares copied`,
      result: formatMinor(perMinor, currency),
      status: "ALL SHARES COPIED",
    });
  };

  const split = () => {
    if (step !== "create") return;
    const minor = validate();
    if (minor === null) {
      input.style.borderBottomColor = "var(--noise)";
      live.textContent = "Enter a bill amount greater than zero.";
      input.focus();
      return;
    }
    input.style.borderBottomColor = "";
    clearTimers();
    totalMinor = minor;
    perMinor = Math.ceil(totalMinor / K);
    buildCards();
    setStep("recover");
    out.classList.add("is-sum");
    out.textContent = formatMinor(perMinor, currency);
    live.textContent = `Split ${K} ways. ${formatMinor(perMinor, currency)} each. Tap a share to copy it.`;
    onResult?.({
      expression: `${formatMinor(totalMinor, currency)} ÷ ${K}`,
      result: formatMinor(perMinor, currency),
      status: "SPLIT · EXACT TO THE CENT",
    });
    onPhase?.("scatter");
    later(900, () => {
      if (step === "recover" || step === "done") onPhase?.("settle");
    });
    later(450, () => cards[0]?.btn.focus({ preventScroll: true }));
  };

  const reset = () => {
    clearTimers();
    sharesWrap.textContent = "";
    sharesWrap.style.width = "";
    sharesWrap.style.left = "";
    sharesWrap.style.right = "";
    sharesWrap.style.transform = "";
    sharesWrap.style.gridTemplateColumns = "";
    cards = [];
    copied.clear();
    setStep("create");
    out.classList.remove("is-sum");
    out.textContent = "";
    input.style.borderBottomColor = "";
    ok.textContent = "All shares copied";
    setK(K);
    validate();
    schedulePreview();
    live.textContent = "";
    input.focus({ preventScroll: true });
    const minor = currentMinor();
    if (minor !== null) {
      onResult?.({
        expression: "Your bill",
        result: formatMinor(minor, currency),
        status: "SPLIT · EXACT TO THE CENT",
      });
    }
  };

  input.addEventListener("input", () => {
    input.style.borderBottomColor = "";
    validate();
    schedulePreview();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") split();
  });
  steps.forEach((b) =>
    b.addEventListener("click", () => {
      setK(K + Number(b.dataset.tryStep));
      schedulePreview();
    })
  );
  go?.addEventListener("click", split);
  resetBtn?.addEventListener("click", reset);
  currencySelect?.addEventListener("change", () => {
    currency = currencySelect.value;
    validate();
    schedulePreview();
  });
  window.addEventListener("resize", layoutShares);

  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting) || previewed) return;
      previewed = true;
      const minor = currentMinor();
      if (minor !== null) {
        onResult?.({
          expression: "Your bill",
          result: formatMinor(minor, currency),
          status: "SPLIT · EXACT TO THE CENT",
        });
      }
    },
    { threshold: 0.12 }
  );
  io.observe(root);

  setK(3);
  setStep("create");
  validate();
}
