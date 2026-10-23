/* RipZone v0.11.0 compliance layer (retail posture modelled on Rips by Triumph). DRAFT: rules pending attorney review.
   Pre-purchase: permanent self-exclusion -> geo (IP mock + declared state) -> 18+ ID check (Footprint, mocked in test mode)
   -> odds + card value range preview for the selected pack/mode -> odds LOCKED at checkout -> receipt with locked odds + serial.
   Server enforces the same gates (ripzone-server/supabase/functions/_shared/compliance.mjs). */
(() => {
'use strict';
const I = window.__rzi, { BAND_HEX, BAND_LABEL, Funds, Gate, KYC, QA, RG, RISK, bandsFor, closeSheet, dist, fmtUSD, fmtUSDs, oddsFor, packFloor, poolFor, renderPackInfo, renderRG, sheet, tmTag, toast, xe, $ } = I;
const C = () => window.RZ_COMPLIANCE, XK = 'rz.selfex.v1', GK = 'rz.geo.mock';
const help = () => `<div class="rz-help">Need support? Call <a href="tel:18004264237"><b>1-800-GAMBLER</b></a> · <a href="https://www.ncpgambling.org/help-treatment/" target="_blank" rel="noopener">ncpgambling.org</a></div>`;
const RZC = window.RZC = {
  help,
  /* ---- permanent self-exclusion (stored outside app state: "Reset demo data" does not clear it; server keeps it forever) ---- */
  excluded() { try { return JSON.parse(localStorage.getItem(XK)) || null; } catch { return null; } },
  excludedSheet() { $('#sheet').classList.add('top'); sheet(`<div class="rz-c"><div class="rz-ico">🔒</div><h2>Account locked</h2><p class="muted">You permanently self-excluded on ${new Date(this.excluded().at).toLocaleDateString()}. Buying packs and adding funds are disabled for good. You can still ship your cards or withdraw your sell-back balance.</p>${help()}<button class="cta ghost" id="rzOk">OK</button></div>`); $('#rzOk').onclick = closeSheet; },
  selfExclude() { // double confirm: (1) explain + confirm, (2) type LOCK
    $('#sheet').classList.add('top');
    sheet(`<div class="rz-c"><div class="rz-ico">⛔</div><h2>Permanently lock my account?</h2><p class="muted">This is <b>irreversible</b>. You will never be able to buy packs or add funds on RipZone again, and support cannot undo it. Cards in your Vault can still be shipped or sold back, and your sell-back balance can still be withdrawn.</p>${help()}<div class="row2"><button class="cta ghost" id="xNo">Cancel</button><button class="cta danger" id="xYes">Continue</button></div></div>`);
    $('#xNo').onclick = closeSheet;
    $('#xYes').onclick = () => { sheet(`<div class="rz-c"><h2>Final confirmation</h2><p class="muted">Type <b>LOCK</b> to permanently self-exclude.</p><input id="xTxt" class="gate-in" autocomplete="off" placeholder="LOCK"><div class="row2"><button class="cta ghost" id="xNo2">Cancel</button><button class="cta danger" id="xGo" disabled>Lock permanently</button></div></div>`);
      $('#xTxt').oninput = e => $('#xGo').disabled = e.target.value.trim().toUpperCase() !== 'LOCK'; $('#xNo2').onclick = closeSheet;
      $('#xGo').onclick = () => { localStorage.setItem(XK, JSON.stringify({ at: Date.now(), user: I.S.user?.phone || null })); closeSheet(); renderRG(); renderPackInfo?.(); toast('Account permanently locked'); }; };
  },
  /* ---- geo: PROD = IP/GPS geolocation vendor; TEST = mock IP lookup (rz.geo.mock override) + the state declared at signup ---- */
  geo() { const ip = localStorage.getItem(GK) || '', st = (ip || Gate.state() || '').toUpperCase(); return { state: st, source: ip ? 'ip-mock' : 'declared' }; },
  blocked(st) { return (C().BLOCKED_STATES || ['NV']).includes((st || '').toUpperCase()); },
  geoSheet(st) { $('#sheet').classList.add('top'); sheet(`<div class="rz-c"><div class="rz-ico">📍</div><h2>Not available in ${xe(st)}</h2><p class="muted">Buying packs and adding funds aren't offered in your current location. You can still view your Vault, ship cards and withdraw your sell-back balance.</p><button class="cta ghost" id="rzOk">OK</button></div>`); $('#rzOk').onclick = closeSheet; },
  canDeposit() { if (this.excluded()) { this.excludedSheet(); return false; } const g = this.geo(); if (this.blocked(g.state)) { this.geoSheet(g.state); return false; } return true; },
  /* ---- pre-purchase chain ---- */
  async prePurchase(p, price, again) { // v0.11.1: Sell & Rip Again skips the odds preview (odds stay on the picker Odds button + receipt)
    if (this.excluded()) { this.excludedSheet(); return false; }
    const g = this.geo(); if (this.blocked(g.state)) { this.geoSheet(g.state); return false; }
    if (!KYC.ok()) { const ok = await new Promise(res => KYC.need('to confirm you are 18+ before your first purchase', () => res(true))); if (!ok) return false; }
    if (again || (QA && window.__ripzone?.skipPreview)) return true;
    return this.preview(p, price);
  },
  ranges(p, mode) { const o = oddsFor(p, mode), P = poolFor(p, mode); return bandsFor(mode).filter(b => o[b] > 0).map(b => ({ band: b, p: o[b], min: P[b].min, max: P[b].max, n: P[b].cs.length })); },
  pc: x => x >= 0.1 ? (x * 100).toFixed(1) + '%' : x >= 0.001 ? (x * 100).toFixed(2) + '%' : '<0.1%',
  table(rows) { return `<table class="rz-odds"><thead><tr><th>Band</th><th>Chance</th><th>Card value range</th></tr></thead><tbody>${rows.map(r => `<tr><td><i style="background:${BAND_HEX[r.band]}"></i>${BAND_LABEL[r.band]}</td><td>${this.pc(r.p)}</td><td>${fmtUSDs(r.min)}${r.max > r.min ? ' – ' + fmtUSDs(r.max) : ''}</td></tr>`).join('')}</tbody></table>`; },
  preview(p, price) { return new Promise(res => {
    const D = dist(p, I.S.risk), rows = this.ranges(p, I.S.risk); this.shown = { rows, at: Date.now() };
    $('#sheet').classList.add('top');
    sheet(`<div class="rz-c rz-pv"><h2>${xe(p.name)} pack</h2><p class="muted small">${fmtUSD(p.price)} · ${RISK[I.S.risk].label} · 1 physical card from serialized inventory</p>
      ${this.table(rows)}
      <div class="rz-kv"><div><span>Card value range</span><b>${fmtUSDs(packFloor(p, I.S.risk) || Math.min(...rows.map(r => r.min)))} – ${fmtUSDs(D.max)}</b></div><div><span>Average card value</span><b>${fmtUSDs(D.ev)} (${Math.round(D.ev / p.price * 100)}%)</b></div></div>
      <p class="fine">Card values are current market prices and may be higher or lower than the pack price. These odds are locked when you tap Buy and shown on your receipt. Sell back is optional; shipping is always available.</p>
      <button class="cta cash" id="pvBuy">Buy pack · ${price ? fmtUSD(price) : 'free'}</button><button class="cta ghost" id="pvNo">Cancel</button></div>`);
    $('#pvBuy').onclick = () => { closeSheet(); res(true); }; $('#pvNo').onclick = () => { closeSheet(); res(false); };
  }); },
  /* ---- receipt: locked odds + serial ---- */
  receipt(purchaseId) {
    const a = (RZBackend.audit?.() || []).find(x => x.id === purchaseId) || (RZBackend.audit?.() || [])[0]; if (!a) return toast('No receipt yet');
    const c = I.BY_ID[a.cardId] || {}, s = a.snapshot || {}, rows = s.ranges || Object.entries(s.bands || {}).map(([band, p]) => ({ band, p, min: 0, max: 0 }));
    $('#sheet').classList.add('top', 'fx');
    sheet(`<div class="rz-c rz-rc"><div class="fs-h"><h2>Purchase receipt</h2>${tmTag()}<button class="fs-x" aria-label="Close">✕</button></div>
      <div class="cf-sum rc"><div><span>Receipt</span><b class="mono">${xe(a.id.slice(-12).toUpperCase())}</b></div><div><span>Date</span><b>${new Date(a.t).toLocaleString()}</b></div><div><span>Pack</span><b>${fmtUSD(a.price)} · ${xe(RISK[a.mode]?.label || a.mode)}</b></div>
      <div><span>Your card</span><b>${xe(c.name || a.cardId)}</b></div><div><span>Serial number</span><b class="mono">${xe(a.serial)}</b></div><div><span>Market value at pull</span><b>${fmtUSD(c.value || 0)}</b></div></div>
      <h3 class="rz-h3">Odds locked at checkout</h3>${this.table(rows)}
      <div class="rz-kv"><div><span>Average card value</span><b>${fmtUSDs(s.ev || 0)}</b></div><div><span>Floor · top value</span><b>${fmtUSDs(s.floor || 0)} · ${fmtUSDs(s.max || 0)}</b></div><div><span>Draw seed</span><b class="mono">${xe(String(a.seed || '').slice(0, 16))}</b></div></div>
      <p class="fine">The card was assigned at purchase from the locked odds; animations don't change it. Sell-back price is locked at pull (100% of market value) and is optional. Ship anytime ($14.99 insured).</p></div>`);
    $('.fs-x').onclick = closeSheet;
  },
  lastId: null,
};
/* ---- hooks into existing app objects ---- */
const _allow = RG.allow.bind(RG), _dep = RG.allowDeposit.bind(RG);
RG.allow = price => RZC.excluded() ? (RZC.excludedSheet(), false) : _allow(price);
RG.allowDeposit = a => RZC.canDeposit() && _dep(a);
const _open = Funds.open.bind(Funds); Funds.open = o => RZC.canDeposit() && _open(o);
// signup: mock IP lookup checked alongside the declared state
const _s3 = Gate.step3.bind(Gate);
Gate.step3 = function () { const g = RZC.geo(), ip = localStorage.getItem(GK); if (ip && RZC.blocked(ip)) { this.frame(`<h2>Not available in ${xe(ip)}</h2><p class="muted">Your network location (${xe(ip)}) is in a state where RipZone isn't offered.</p>`); return; } _s3(); };
})();
