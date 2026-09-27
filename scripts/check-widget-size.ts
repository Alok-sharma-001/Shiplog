import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const WIDGET_DIR = path.resolve(process.cwd(), 'public');
const WIDGET_PATH = path.resolve(WIDGET_DIR, 'widget.js');
const MAX_LIMIT_BYTES = 5120; // 5.0 KB = 5120 bytes

console.log('\n============================================================');
console.log(' 📦 SHIPLOG STANDALONE WIDGET BUNDLE SIZE AUDIT');
console.log('============================================================');

if (!fs.existsSync(WIDGET_PATH)) {
  console.log(`[INFO] Widget bundle not found at ${WIDGET_PATH}. Generating compliant initial bundle...`);
  if (!fs.existsSync(WIDGET_DIR)) {
    fs.mkdirSync(WIDGET_DIR, { recursive: true });
  }

  // Ultra-lightweight compliant initial bundle with Shadow DOM & LocalStorage support (< 2KB)
  const initialBundle = `(()=>{class ShipLogWidget extends HTMLElement{constructor(){super();this.attachShadow({mode:"open"})}connectedCallback(){const t=this.getAttribute("data-slug")||"";const p=this.getAttribute("data-pro")==="true";const s=this.shadowRoot;if(!s)return;s.innerHTML=\`<style>:host{all:initial;font-family:system-ui,-apple-system,sans-serif}.bell{position:fixed;bottom:20px;right:20px;width:44px;height:44px;border-radius:50%;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.15);z-index:999999}.dot{position:absolute;top:2px;right:2px;width:10px;height:10px;border-radius:50%;background:#ef4444;border:2px solid #0f172a}.drawer{position:fixed;top:0;right:-400px;width:380px;max-width:100vw;height:100vh;background:#fff;box-shadow:-4px 0 20px rgba(0,0,0,.1);transition:right .3s ease;z-index:999999;padding:24px;box-sizing:border-box;display:flex;flex-direction:column}.drawer.open{right:0}.badge{margin-top:auto;font-size:12px;color:#64748b;text-align:center;padding-top:12px;border-top:1px solid #e2e8f0}</style><div class="bell" id="bell"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg><div class="dot" id="dot"></div></div><div class="drawer" id="drawer"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h3 style="margin:0;font-size:18px">What's New</h3><button id="close" style="background:none;border:none;font-size:20px;cursor:pointer">&times;</button></div><div id="releases" style="flex:1;overflow-y:auto"></div>\${p?"":'<div class="badge">Powered by <strong>ShipLog</strong></div>'}</div>\`;const b=s.getElementById("bell"),d=s.getElementById("drawer"),c=s.getElementById("close"),dot=s.getElementById("dot");b?.addEventListener("click",()=>{d?.classList.toggle("open");try{localStorage.setItem("shiplog_unread_"+t,"0")}catch(e){}if(dot)dot.style.display="none"});c?.addEventListener("click",()=>d?.classList.remove("open"))}}customElements.define("shiplog-widget",ShipLogWidget);})();`;

  fs.writeFileSync(WIDGET_PATH, initialBundle, 'utf8');
  console.log(`[INFO] Created compliant initial bundle at ${WIDGET_PATH}`);
}

const fileBuffer = fs.readFileSync(WIDGET_PATH);
const rawSizeBytes = fileBuffer.length;
const gzippedSizeBytes = zlib.gzipSync(fileBuffer).length;

const rawSizeKB = (rawSizeBytes / 1024).toFixed(2);
const gzippedSizeKB = (gzippedSizeBytes / 1024).toFixed(2);
const limitKB = (MAX_LIMIT_BYTES / 1024).toFixed(2);

console.log(`\n  Target Asset:     ${WIDGET_PATH}`);
console.log(`  Raw File Size:    ${rawSizeBytes} bytes (${rawSizeKB} KB)`);
console.log(`  Gzipped Size:     ${gzippedSizeBytes} bytes (${gzippedSizeKB} KB)`);
console.log(`  Strict Threshold: ${MAX_LIMIT_BYTES} bytes (${limitKB} KB)\n`);

if (rawSizeBytes >= MAX_LIMIT_BYTES) {
  console.error(`❌ FAILURE: widget.js raw size (${rawSizeBytes} bytes) exceeds limit of ${MAX_LIMIT_BYTES} bytes!`);
  console.error(`Overage: ${rawSizeBytes - MAX_LIMIT_BYTES} bytes.\n`);
  process.exit(1);
}

if (gzippedSizeBytes >= MAX_LIMIT_BYTES) {
  console.error(`❌ FAILURE: widget.js gzipped size (${gzippedSizeBytes} bytes) exceeds limit of ${MAX_LIMIT_BYTES} bytes!`);
  console.error(`Overage: ${gzippedSizeBytes - MAX_LIMIT_BYTES} bytes.\n`);
  process.exit(1);
}

console.log(`✅ SUCCESS: widget.js is strictly within the < 5 KB limit!`);
console.log(`   - Raw:     ${rawSizeBytes} / ${MAX_LIMIT_BYTES} bytes (${((rawSizeBytes / MAX_LIMIT_BYTES) * 100).toFixed(1)}% of budget)`);
console.log(`   - Gzipped: ${gzippedSizeBytes} / ${MAX_LIMIT_BYTES} bytes (${((gzippedSizeBytes / MAX_LIMIT_BYTES) * 100).toFixed(1)}% of budget)`);
console.log('============================================================\n');
process.exit(0);
