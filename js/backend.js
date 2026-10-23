/* RipZone backend client (v0.10.0).
   One interface, two implementations:
     - 'local'  : in-app LOCAL BACKEND (this file). Same API and rules as /workspace/ripzone-server, state in localStorage, so the
                  APK is fully testable offline. TEST MODE: no real money, KYC and payments are sandbox mocks.
     - 'remote' : the real server (Supabase Edge Functions). Set RZ_CONFIG.BACKEND = 'remote' and RZ_CONFIG.SERVER_URL.
   Rules enforced here (and server-side in prod): serial-level inventory (available/reserved/vaulted/shipped/sold_back),
   reservation at purchase, refusal if the odds can't be honoured, wallet buckets (deposit = never withdrawable, credit = promo
   store credit, cash = sell-back proceeds = withdrawable), KYC gate before ship / withdraw, withdraw rules, odds-snapshot audit. */
(() => {
'use strict';
const CFG = window.RZ_CONFIG = Object.assign({
  BACKEND: 'local',                 // 'local' | 'remote'
  SERVER_URL: '',                   // e.g. https://<project>.supabase.co/functions/v1/api
  SUPABASE_ANON_KEY: '',
  TEST_MODE: true,                  // shows the TEST MODE ribbon; sandbox KYC + payments
  KYC: { provider: 'footprint', playbookKey: '', sandbox: true },
  PAY: { provider: 'coinflow', merchantId: '', env: 'sandbox' },
  WITHDRAW: { MIN: 6, INSTANT_FEE: 1, DAILY_CAP: 500 },
  CARD_FEE_PCT: 0, // Coinflow card fee absorbed by RipZone (set >0 to pass a fee through; shown in checkout)
}, window.RZ_CONFIG || {});
const K = 'rz.backend.v1', r2 = x => Math.round(x * 100) / 100, now = () => Date.now();
const uid = p => p + '_' + now().toString(36) + Math.random().toString(36).slice(2, 7);
let DB;
function load() { try { DB = JSON.parse(localStorage.getItem(K)); } catch { DB = null; } DB = DB || { units: {}, audit: [], ledger: [], kyc: { status: 'none' }, withdrawals: [], payments: [], methods: [], seeded: false }; }
function save() { localStorage.setItem(K, JSON.stringify(DB)); }
load();
const Local = {
  mode: 'local',
  /* ---- inventory ---- */
  seed(cards) { // idempotent: one unit per serial from data/cards.json; existing statuses kept
    for (const c of cards) for (const s of c.serials || []) if (!DB.units[s]) DB.units[s] = { card: c.id, st: 'available' };
    DB.seeded = true; save();
  },
  available(cardId) { let n = 0; for (const s in DB.units) { const u = DB.units[s]; if (u.card === cardId && u.st === 'available') n++; } return n; },
  availMap() { const m = {}; for (const s in DB.units) { const u = DB.units[s]; if (u.st === 'available') m[u.card] = (m[u.card] || 0) + 1; } return m; },
  /* purchase: the caller passes the odds it showed (snapshot) and the drawn card; we reserve a physical serial or refuse */
  purchase({ packId, mode, price, cardId, seed, u, snapshot, user }) {
    const s = Object.keys(DB.units).find(k => DB.units[k].card === cardId && DB.units[k].st === 'available');
    if (!s) return { ok: false, error: 'unhonorable', msg: 'That card just sold out. Odds are being refreshed; you were not charged.' };
    DB.units[s] = { ...DB.units[s], st: 'reserved', at: now() };
    const id = uid('pur'); DB.audit.unshift({ id, t: now(), packId, mode, price, cardId, serial: s, seed, u, snapshot, user: user || null }); if (DB.audit.length > 2000) DB.audit.length = 2000;
    DB.units[s].st = 'vaulted'; DB.units[s].owner = user || 'me'; DB.units[s].purchase = id; save();
    return { ok: true, purchaseId: id, serial: s };
  },
  sellBack(serial) { const u = DB.units[serial]; if (!u || u.st !== 'vaulted') return { ok: false }; u.st = 'available'; u.soldBack = (u.soldBack || 0) + 1; delete u.owner; save(); return { ok: true }; }, // physical card returns to the pool (status history: sold_back -> available)
  ship(serials, addr) { if (DB.kyc.status !== 'verified') return { ok: false, error: 'kyc_required' }; for (const s of serials) if (DB.units[s]) DB.units[s].st = 'shipped'; const id = uid('shp'); save(); return { ok: true, shipmentId: id }; },
  /* ---- KYC (Footprint sandbox mock) ---- */
  kyc() { return DB.kyc; },
  kycComplete(data) { DB.kyc = { status: 'verified', fpId: uid('fp_test'), name: data.name, dob: data.dob, at: now(), sandbox: true }; save(); return DB.kyc; },
  kycReset() { DB.kyc = { status: 'none' }; save(); },
  /* ---- payments (Coinflow sandbox mock) ---- */
  methods() { return DB.methods; },
  addMethod(m) { m.id = uid('pm'); DB.methods = [m, ...DB.methods.filter(x => !(x.brand === m.brand && x.last4 === m.last4))].slice(0, 4); save(); return m; },
  checkout({ amount, method }) { // returns a Coinflow-like payment result
    if (!(amount >= 5)) return { ok: false, msg: 'Minimum is $5.00' };
    const fee = r2(amount * CFG.CARD_FEE_PCT), p = { id: uid('cf_test_pay'), t: now(), amount: r2(amount), fee, total: r2(amount + fee), method: method.label, status: 'settled', sandbox: true };
    DB.payments.unshift(p); save(); return { ok: true, payment: p };
  },
  withdraw({ amount, speed, cash, todayTotal }) {
    const W = CFG.WITHDRAW;
    if (DB.kyc.status !== 'verified') return { ok: false, error: 'kyc_required', msg: 'Verify your identity first' };
    if (amount < W.MIN) return { ok: false, msg: `Minimum withdrawal is $${W.MIN.toFixed(2)}` };
    if (amount > cash + 1e-9) return { ok: false, msg: 'Only sell-back cash can be withdrawn' };
    if (todayTotal + amount > W.DAILY_CAP + 1e-9) return { ok: false, msg: `Daily limit is $${W.DAILY_CAP} (left today: $${r2(W.DAILY_CAP - todayTotal).toFixed(2)})` };
    const fee = speed === 'instant' ? W.INSTANT_FEE : 0, w = { id: uid('cf_test_wd'), t: now(), amount: r2(amount), fee, net: r2(amount - fee), speed, status: speed === 'instant' ? 'paid' : 'processing', eta: speed === 'instant' ? 'within minutes' : '1–3 business days', sandbox: true };
    DB.withdrawals.unshift(w); save(); return { ok: true, withdrawal: w };
  },
  withdrawals() { return DB.withdrawals; },
  // v0.11.1 profile stats mirror. Production: PUT /v1/me/stats (docs/profile-stats-api.md)
  saveStats(st) { DB.stats = { ...st, updatedAt: now() }; save(); return { ok: true }; },
  getStats() { return DB.stats || null; },
  audit() { return DB.audit; },
  resetAll() { localStorage.removeItem(K); load(); },
};
/* Remote: same method names, async, against ripzone-server (see /workspace/ripzone-server/README.md). Not used until configured. */
const call = (path, body) => fetch(CFG.SERVER_URL + path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', apikey: CFG.SUPABASE_ANON_KEY, authorization: 'Bearer ' + (localStorage.getItem('rz.jwt') || CFG.SUPABASE_ANON_KEY) }, body: body ? JSON.stringify(body) : undefined }).then(r => r.json());
const Remote = { mode: 'remote', availMap: () => call('/inventory/available'), purchase: b => call('/purchase', b), sellBack: s => call('/sellback', { serial: s }), ship: (s, a) => call('/ship', { serials: s, address: a }),
  kyc: () => call('/kyc/status'), kycComplete: d => call('/kyc/complete', d), checkout: b => call('/payments/checkout', b), withdraw: b => call('/withdraw', b), withdrawals: () => call('/withdrawals'), methods: () => call('/payments/methods') };
window.RZBackend = CFG.BACKEND === 'remote' && CFG.SERVER_URL ? Remote : Local;
})();
