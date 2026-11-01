const logo = `
<svg class="app__mark" viewBox="0 0 64 44" aria-hidden="true">
  <ellipse cx="32" cy="22" rx="27" ry="14" transform="rotate(-24 32 22)" fill="none" stroke="#8fe3db" stroke-width="3.4"/>
  <circle cx="47" cy="10.5" r="6.4" fill="#d9f2a3"/>
</svg>`;

const iconHistory = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.6 9.2A8 8 0 1 1 4 13"/><path d="M4.4 4.4v4.9h4.9"/><path d="M12 8v4.6l3 1.8"/></svg>`;
const iconGear = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.1"/><path d="M12 3.2v2.1M12 18.7v2.1M3.2 12h2.1M18.7 12h2.1M5.8 5.8l1.5 1.5M16.7 16.7l1.5 1.5M18.2 5.8l-1.5 1.5M7.3 16.7l-1.5 1.5"/></svg>`;
const iconCalc = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3.5" width="16" height="17" rx="3"/><path d="M8 8.5h8M8 12.5h3M14 12.5h2M8 16.5h3M14 16.5h2"/></svg>`;
const iconConvert = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h13M13.5 4.5 17 8l-3.5 3.5M20 16H7M10.5 12.5 7 16l3.5 3.5"/></svg>`;
const iconSplit = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h9l3 3v14H6z"/><path d="M9.5 10h6M9.5 13.5h6M9.5 17h3.5"/></svg>`;

const KEYS = [
  ["AC", "ac"], ["±", ""], ["%", ""], ["÷", "op"],
  ["7", ""], ["8", ""], ["9", ""], ["×", "op"],
  ["4", ""], ["5", ""], ["6", ""], ["−", "op"],
  ["1", ""], ["2", ""], ["3", ""], ["+", "op"],
  ["( )", ""], ["0", ""], [".", ""], ["=", "eq"],
];

function deviceSvg(id) {
  return `
<svg class="phone-device" viewBox="0 0 985 2000" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="rim-${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#6e6c6a"/><stop offset=".02" stop-color="#3b3937"/>
      <stop offset=".5" stop-color="#2b2a29"/><stop offset=".98" stop-color="#3b3937"/>
      <stop offset="1" stop-color="#6e6c6a"/>
    </linearGradient>
    <linearGradient id="button-${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#7d7b79"/><stop offset="1" stop-color="#4a4846"/>
    </linearGradient>
    <linearGradient id="control-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#212121"/><stop offset="1" stop-color="#2a2a2a"/>
    </linearGradient>
    <linearGradient id="edge-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".34"/>
      <stop offset=".5" stop-color="#fff" stop-opacity=".08"/>
      <stop offset="1" stop-color="#fff" stop-opacity=".22"/>
    </linearGradient>
  </defs>
  <g fill="url(#button-${id})">
    <rect x="0" y="386" width="14" height="76" rx="4"/>
    <rect x="0" y="532" width="14" height="147" rx="4"/>
    <rect x="0" y="724" width="14" height="147" rx="4"/>
    <rect x="971" y="635" width="14" height="238" rx="4"/>
  </g>
  <rect x="7" y="0" width="971" height="2000" rx="165" fill="url(#rim-${id})"/>
  <rect x="9.5" y="2.5" width="966" height="1995" rx="162.5" fill="none" stroke="#7a7876" stroke-opacity=".55" stroke-width="2"/>
  <rect x="16" y="9" width="953" height="1982" rx="156" fill="none" stroke="#000" stroke-opacity=".6" stroke-width="3"/>
  <rect x="21" y="14" width="943" height="1972" rx="151" fill="#020202"/>
  <rect x="52" y="43" width="884" height="1916" rx="121" fill="#0b0c0c"/>
</svg>`;
}

function appHtml() {
  return `
<div class="app">
  <div class="app__status">
    <span>9:41</span>
    <span class="app__status-icons"><i></i><i></i><i></i><i></i></span>
  </div>
  <div class="app__brand">
    <div class="app__logo">${logo}<span class="app__word"><b>orbit</b><em>MAKE ROOM FOR NUMBERS</em></span></div>
    <div class="app__actions">
      <span class="app__icon">${iconHistory}</span>
      <span class="app__icon">${iconGear}</span>
    </div>
  </div>
  <div class="app__sub"><span>YOUR EVERYDAY, ELEVATED</span><span class="app__deg">DEG</span><span class="app__fx">fx</span></div>
  <div class="app__history">
    <div class="app__hist-head"><span>HISTORY</span><span>LAST 100</span></div>
    <div class="app__hist-row"><span>1250+375</span><b>1,625</b></div>
    <div class="app__hist-row"><span>sin(30)+√144</span><b>12.5</b></div>
    <div class="app__hist-row"><span>2^10/4</span><b>256</b></div>
    <div class="app__hist-row"><span>(12.5+7.5)*3</span><b>60</b></div>
    <div class="app__hist-row"><span>7!−1000</span><b>4,040</b></div>
  </div>
  <div class="app__tabs">
    <span class="app__tab active">${iconCalc}Calculate</span>
    <span class="app__tab">${iconConvert}Convert</span>
    <span class="app__tab">${iconSplit}Split</span>
  </div>
  <div class="app__home"></div>
</div>`;
}

let uid = 0;

export function mountPhones(root = document) {
  root.querySelectorAll("[data-phone-mount]").forEach((mount) => {
    const phone = mount.closest(".phone");
    const id = `p${uid++}`;
    mount.innerHTML = deviceSvg(id) + appHtml();
    if (phone && !phone.querySelector(".phone__stack")) {
      const s1 = document.createElement("div");
      s1.className = "phone__stack";
      const s2 = document.createElement("div");
      s2.className = "phone__stack";
      phone.insertBefore(s2, mount);
      phone.insertBefore(s1, mount);
      const accent = getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim();
      s1.style.setProperty("--stack-accent", accent);
      s2.style.setProperty("--stack-accent", accent);
    }
  });
}
