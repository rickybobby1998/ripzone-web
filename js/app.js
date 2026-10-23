/* RipZone — real-cash pack opener (v0.9 "cash mode" pitch build). Pack prices, balances and card values are US dollars.
   Pulls are meant to come from an operator's real card inventory. DEMO BUILD: no payment is taken, nothing is withdrawn or shipped. */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const TIERS = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const TIER_LABEL = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };
const TIER_HEX = { common: '#b8c0d8', uncommon: '#39ff9f', rare: '#3fa9ff', epic: '#c04bff', legendary: '#ffcc33' };

/* ================= CONFIG (one place) ================= */
const CONFIG = {
  TEST_INVENTORY: false,    // v0.10.0: serialized LAUNCH inventory (data/cards.json serials + js/backend.js); Collectr test cards removed     // v0.9.22 TEST build: v0.9.19 cards = fillers, @aokiscardhouse Collectr cards pooled only where they fit the pack's range (TEST INVENTORY label)
  RTP: 0.88,                // house return: expected MARKET value of a pack's cards = RTP x pack price, for the Normal/High/Max value spreads (operator margin 12%); 50/50 uses FIFTY below
  BUYBACK: 1.00,            // instant buyback: cash paid = BUYBACK x the card's current USD market value
  // 50/50 risk option ("house-safe" default): a coin flip between a WIN pack worth ~WIN_X x price and a LOSS pack worth
  // v0.9.13: GOLD = real card 1.8-2.2x price, SILVER = card 0.05-0.11x; P(gold) ~42.7% solved per pack so RTP = 90%.
  // The guaranteed floor does NOT apply to 50/50 packs (a 10% loss pack is below the Premium/Legendary floors); the UI says so.
  FIFTY: { GOLD_X: 2.0, GOLD_RANGE: [1.8, 2.2], SILVER_X: 0.08, SILVER_RANGE: [0.05, 0.11], P_GOLD: 0.427, RTP: 0.90, get WIN_X() { return this.GOLD_X; }, get LOSS_X() { return this.SILVER_X; }, get P_WIN() { return this.P_GOLD; } }, // v0.9.1 Rips-style: GOLD ~1.8x or SILVER ~0.2x; P(gold) solved per pack so RTP = 90% exactly
  SHIP_FEE: 14.99,          // flat insured shipping per ship request (TEST MODE: not charged)
  DEMO_START_USD: 0,      // pitch-demo starting balance. Production: start at $0, funded only by real deposits.
  DEPOSITS: [10, 25, 50, 100, 250],
  // 12 packs per category (same prices in every category). Brand art by price: Starter $1-$10, Rare $25-$100, Premium $250-$1,000, Legendary $2,500-$5,000.
  PACK_PRICES: [1, 2.5, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  LAUNCH_PRICES: [1, 2.5, 5, 10, 25, 50, 100], // v0.10.0 launch tiers; higher packs are hidden (coming soon)
  FREE_PACK_PRICE: { starter: 5, rare: 25, premium: 250 }, // which pack a free "Starter/Rare/Premium pack" reward opens
  FLOORS: { premium: 0.35, legendary: 0.40 }, // single-card floor by art tier (share of price): the card is worth >= FLOOR x price (Normal/High/Max; not 50/50)
  // Every pack pulls exactly ONE card. Colour bands by card value as a multiple of the pack price: Grey <0.25x, Green 0.25-0.75x,
  // Blue 0.75-1.25x, Purple 1.25-2x, Red 2-3x, Gold >=3x.
  BANDS: [0, 0.25, 0.75, 1.25, 2, 3],
  MAX_CARD_USD: 25000, // cards priced above this are flagged as single-sale outliers and excluded from packs (kept in data)
  MIN_CARD_X: 0.15, // Max-mode loss floor (at least 15%)
  // v0.9.8 competitor-matched Normal/High/Max caps by pack price: hard floor (x price) and max pull (x price); $25k outlier exclusion still applies
  PACK_MIN_X: { 1: .30, 2.5: .30, 5: .30, 10: .30, 25: .30, 50: .30, 100: .30, 250: .30, 500: .30, 1000: .30, 2500: .34, 5000: .30 },
  PACK_MAX_X: { 1: 20, 2.5: 20, 5: 20, 10: 20, 25: 20, 50: 20, 100: 20, 250: 20, 500: 20, 1000: 20, 2500: 40, 5000: 3 }, // v0.9.13: $2,500 may hold cards above MAX_CARD_USD (OUTLIER_OK_PRICES), up to 40x
  OUTLIER_OK_PRICES: [2500], // v0.9.13: the $25k single-sale exclusion is relaxed for these pack prices only
  // v0.9.13 Rips-by-Triumph-style tier tables: [chance, lo x price, hi x price]; lo 'F' = the pack floor, hi 'M' = the max pull. One shared tilt inside the tiers lands EV on RTP exactly.
  TIERS_NORMAL: [[.30, 'F', .4], [.20, .4, .8], [.25, 1.0, 1.1], [.15, 1.1, 1.3], [.07, 1.3, 1.7], [.03, 1.8, 'M']], // ~50% at or above price
  TIERS_NORMAL_40: [[.30, 'F', .4], [.30, .4, .8], [.15, 1.0, 1.1], [.15, 1.1, 1.3], [.07, 1.3, 1.7], [.03, 1.8, 'M']], // $1 and $2,500: ~40%
  NORMAL_40_PRICES: [1, 2500],
  TIERS_HIGH: [[.55, 'F', .5], [.25, .5, .95], [.10, 1.0, 1.6], [.06, 1.6, 3.0], [.04, 3.0, 'M']], // ~20% at or above price, more grails + more low pulls
 // v0.9.2: Normal/High/Max never pull a card worth under 15% of the pack price (Grey band = 15-25%)
  MIN_HITS: 3, // a pack is only offered if at least this many distinct real cards are worth >= its price (otherwise: 'needs inventory')
  MAX: { P_GOLD: 0.10, LOSS_X: 0.42, GOLD_X: 5.0 }, // v0.9.2: Gold pool averages GOLD_X x price; grail chance q solved per pack so EV = RTP (loss cards now >= 15% floor) // Max mode: 10% Gold-band card, 90% loss card (target 10% of price, raised to the floor where one applies); EV stays RTP
  HOME_V2: true,
  HOME_GLOW: false,         // v0.9.15: soft tier-colour radial glow behind the centred pack on $100+ packs (off by default; Ricky dislikes shine)          // v0.9.15 mockup: cleaner carousel home (slim info + Odds sheet). false or ?home=old = the old home (kept intact)
  AUTH_PROVIDER: 'auto',    // 'auto' = Firebase when configured (firebase-config.js), otherwise mock · or force 'mock' | 'firebase-web' | 'firebase-native'
  OFFER_HOURS: 48,          // welcome deal countdown
  OFFER: { min: 25, packs: { rare: 1 } }, // first deposit of $25+ gets a free $25 Rare pack
  FOUNDING_MEMBERS: true,   // early sign-ups get a permanent Founding Member badge (no monetary value attached)
};
const r2 = x => Math.round(x * 100) / 100;
const BBP = () => Math.round(CONFIG.BUYBACK * 100) + '%';
// Referrals and rewards are modest USD credit or free packs.
const REF = { newUser: { packs: { starter: 1 } }, perFriend: { usd: 5, afterPacks: 3 },
  milestones: [{ n: 3, usd: 0, packs: { rare: 1 } }, { n: 10, usd: 0, packs: { rare: 2 } }, { n: 25, usd: 25, packs: { premium: 1 } }] };
// Daily login streak (resets if a calendar day is missed): small USD credit, free Starter pack on day 7.
const STREAK = [{ usd: .10 }, { usd: .10 }, { usd: .25 }, { usd: .25 }, { usd: .50 }, { usd: .50 }, { usd: 1, pack: 'starter' }];
// Fictional test numbers (reserved 555-01xx range). Register the same list in Firebase > Authentication > Phone numbers for testing,
// so sign-in behaves identically in the mock and with real Firebase (Firebase sends no SMS for these and does not bill them).
const TEST_PHONES = { '+16505550101': '123401', '+16505550102': '123402', '+16505550103': '123403', '+16505550104': '123404', '+16505550105': '123405',
  '+16505550106': '123406', '+16505550107': '123407', '+16505550108': '123408', '+16505550109': '123409', '+16505550110': '123410' };
const BASE_PACKS = [ // brand art tiers (see CONFIG.PACK_PRICES for the price -> tier mapping)
  { id: 'starter', name: 'Starter' }, { id: 'rare', name: 'Rare' }, { id: 'premium', name: 'Premium' }, { id: 'legendary', name: 'Legendary' },
];
/* v0.9.16 Pokémon tier names (UI labels; the art's printed price is too small to read) */
const PKM_TIER = { 1: 'Ember', 2.5: 'Starter', 5: 'Beginner', 10: 'Signature', 25: 'Bronze', 50: 'Titanium', 100: 'Gold', 250: 'Onyx', 500: 'Obsidian', 1000: 'Inferno', 2500: 'Celestial', 5000: 'Grail' };
const artTier = price => price <= 10 ? 'starter' : price <= 100 ? 'rare' : price <= 1000 ? 'premium' : 'legendary';
const fmtPrice = v => '$' + (v % 1 ? v.toFixed(2) : v.toLocaleString('en-US'));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function rnd() { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; }
/* ---------- state ---------- */
const KEY = 'ripzone.cash.v1'; // new key: v0.8 coin saves (GC/SC) are not carried over
let S;
function refCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c = ''; for (let i = 0; i < 5; i++) c += A[Math.floor(rnd() * A.length)]; return 'RIP-' + c; }
function freshState() { return { credit: 0, cash: 0, wd: { day: '', total: 0 }, bal: CONFIG.DEMO_START_USD, offer: null, user: null, risk: 'normal', sound: true, coll: [], tx: [], streak: { n: 0, last: null }, freePacks: {}, rg: { spend: 0, deposit: 0, session: 0, coolUntil: 0, pending: null, day: '', spent: 0, deposited: 0 }, onboarded: false, cat: 'pkm', stats: { opened: 0, sold: 0, shipReq: 0 }, uid: 1, ref: { code: refCode(), usedCode: null, friends: [], earned: 0, milestones: [] }, feed: [] }; }
function load() { try { S = JSON.parse(localStorage.getItem(KEY)) || freshState(); } catch { S = freshState(); } const f = freshState(); for (const k in f) if (S[k] === undefined) S[k] = f[k]; for (const k in f.ref) if (S.ref[k] === undefined) S.ref[k] = f.ref[k]; for (const k in f.rg) if (S.rg[k] === undefined) S.rg[k] = f.rg[k]; for (const k in f.stats) if (S.stats[k] === undefined) S.stats[k] = f.stats[k]; }
function save() { localStorage.setItem(KEY, JSON.stringify(S)); }
function addTx(kind, amt, label) { S.tx.unshift({ t: Date.now(), kind, amt: r2(amt), label }); if (S.tx.length > 60) S.tx.length = 60; }
/* v0.9.3 store credit: buybacks + promos are non-withdrawable Store Credit, usable only for packs. Deposits stay in the deposited balance. */
const spendable = () => r2(S.bal + (S.credit || 0) + (S.cash || 0));
function payPack(price) { // v0.10.0: promo credit first, then deposits, then withdrawable sell-back cash (keeps cash-out-able money last)
  let left = price; const c = Math.min(S.credit || 0, left); S.credit = r2((S.credit || 0) - c); left = r2(left - c);
  const d = Math.min(S.bal, left); S.bal = r2(S.bal - d); left = r2(left - d); S.cash = r2((S.cash || 0) - left); }
function sellBack(c, v, uid) { // 100% buyback -> withdrawable sell-back cash; the physical serial returns to the pool
  S.cash = r2((S.cash || 0) + v); addTx('sell', v, `Sold back · ${c.name}`); const x = S.coll.find(q => q.uid === uid) || (uid && S.sold && S.sold[uid]); const ser = x?.serial;
  if (ser) { RZBackend.sellBack(ser); applyStock(); } }
function addCredit(v) { S.credit = r2((S.credit || 0) + v); }
function credit(usd, label, kind = 'reward') { usd = r2(usd); if (!usd) return 0; addCredit(usd); addTx(kind, usd, label); return usd; }
const QA = (() => { try { return !window.Capacitor?.isNativePlatform?.() && localStorage.getItem('rz.qa') === '1'; } catch { return false; } })(); // dev-only test hooks, never in the APK
load(); S.cat = 'pkm'; // v0.9.12: Pokémon is always the launch category
/* ---------- categories ----------
   Pokémon uses bundled card scans (existing prototype). One Piece / NFL / MLB / MTG are DEMO content: names, sets, numbers, grades and
   real market prices, shown with bundled real card photos (www/img/<cat>/, scripts/fetch_cat_images.py; prototype/demo use only, IP risk).
   cardArt() below is only a fallback frame for a card without a photo; its demo footer therefore never appears next to a real image. */
const CATS = [
  { id: 'pkm', name: 'Pokémon', long: 'Pokémon TCG', ico: '⚡', title: 'RIPZONE · TCG', file: 'data/cards.json' },
];
/* v0.11.1: Pokémon only. One Piece / NFL / MLB / MTG removed with their data + images. */
const CAT_BY = Object.fromEntries(CATS.map(c => [c.id, c]));
const ALL_PACKS = CATS.flatMap(c => CONFIG.LAUNCH_PRICES.map(price => { const base = artTier(price), fl = CONFIG.FLOORS[base] || 0;
  return { id: `${c.id}-${price}`, name: (c.id === 'pkm' && PKM_TIER[price]) || `${fmtPrice(price)} ${BASE_PACKS.find(b => b.id === base).name}`, price, base, cat: c.id, cards: 1, floorPct: fl, minCard: r2((CONFIG.PACK_MIN_X[price] ?? Math.max(fl || 0, CONFIG.MIN_CARD_X)) * price), maxPull: r2((CONFIG.PACK_MAX_X[price] ?? 20) * price), art: `img/packs/${c.id}-${base}.webp` }; }));
const packById = id => ALL_PACKS.find(p => p.id === id);
const baseName = id => CONFIG.FREE_PACK_PRICE[id] ? `${fmtPrice(CONFIG.FREE_PACK_PRICE[id])}` : id; // v0.9.18: '$5' (Pokémon tier names differ from the old Starter/Rare/Premium art tiers)
const freeKey = p => CONFIG.FREE_PACK_PRICE[p.base] === p.price ? p.base : null; // a free reward pack opens the matching-price pack in any category
const freeN = p => { const k = freeKey(p); return k ? S.freePacks[k] || 0 : 0; };
// packs the real inventory can't support are hidden for that category (listed in HIDDEN_PACKS; see verify_odds.py)
const catPacks = id => ALL_PACKS.filter(p => p.cat === id && (!CARDS.length || packOk(p)));
let PACKS = ALL_PACKS.filter(p => p.cat === (CAT_BY[S.cat] ? S.cat : 'pkm'));
const CAT_TIER = {};

/* Original placeholder card art (SVG, generated on first use and cached). Not a reproduction of any official card design. */
const TIER_FRAME = { common: '#b8c0d8', uncommon: '#39ff9f', rare: '#3fa9ff', epic: '#c04bff', legendary: '#ffcc33' };
const MANA = { W: '#d8c88f', U: '#2a6fd0', B: '#5a4766', R: '#d0392b', G: '#2e9a4e' };
const OPCOL = { Red: '#c0392b', Green: '#2e9a4e', Blue: '#2a6fd0', Purple: '#7d3cb5', Black: '#3a3a44', Yellow: '#d4ac0d' };
const xe = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[ch]);
function splitName(c) { // "Jayden Daniels [Gold Sparkle]" / "Monkey.D.Luffy (119) (SP) (Gold)" -> [name, variant]
  let n = c.name, v = ''; const b = n.match(/^(.*?)\s*\[(.+)\]\s*$/); if (b) { n = b[1]; v = b[2]; }
  const p = n.match(/^(.*?)\s*((?:\([^)]*\)\s*)+)$/); if (p) { n = p[1]; v = [p[2].replace(/[()]/g, '').replace(/\b\d{3}\b/g, '').replace(/\s+/g, ' ').trim(), v].filter(Boolean).join(' · '); }
  return [n, v];
}
function cardArt(c) {
  const cat = CAT_BY[c.cat], fr = TIER_FRAME[c.tier], [name, variant] = splitName(c), hi = c.tier === 'epic' || c.tier === 'legendary';
  let a1 = cat.bg[0], a2 = cat.bg[1];
  if (c.cat === 'mtg') { const cs = (c.colors || '').split('').filter(k => MANA[k]); a1 = cs.length > 1 ? '#a8842a' : MANA[cs[0]] || '#6b6f78'; }
  if (c.cat === 'op' && c.color) a1 = OPCOL[c.color.split(/[\s/]/)[0]] || a1;
  const ini = name.replace(/[^A-Za-z .]/g, '').split(/[\s.]+/).filter(Boolean).map(w => w[0]).join('').slice(0, 3).toUpperCase() || '?';
  const fs = name.length > 20 ? 21 : name.length > 15 ? 25 : 29;
  let motif = '';
  if (c.cat === 'nfl') motif = Array.from({ length: 9 }, (_, i) => `<line x1="${48 + i * 38}" y1="80" x2="${48 + i * 38}" y2="330" stroke="#fff" stroke-opacity=".16" stroke-width="3"/>`).join('') + `<text x="200" y="250" font-size="150" font-weight="900" text-anchor="middle" fill="#fff" fill-opacity=".1">${xe(c.number).slice(0, 3)}</text>`;
  else if (c.cat === 'mlb') motif = `<path d="M200 110 L300 205 L200 300 L100 205Z" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="4"/><path d="M60 90 Q120 205 60 320 M340 90 Q280 205 340 320" fill="none" stroke="#ff4b4b" stroke-opacity=".5" stroke-width="3" stroke-dasharray="7 7"/>`;
  else if (c.cat === 'op') motif = `<path d="M28 290 Q78 268 128 290 T228 290 T328 290 T428 290 V340 H28Z" fill="#fff" fill-opacity=".08"/><circle cx="200" cy="200" r="104" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="3"/><path d="M200 86 L212 200 L200 314 L188 200Z M86 200 L200 188 L314 200 L200 212Z" fill="#fff" fill-opacity=".12"/>`;
  else motif = (c.colors || 'C').split('').map((k, i, arr) => `<circle cx="${200 + (i - (arr.length - 1) / 2) * 46}" cy="205" r="96" fill="${MANA[k] || '#888'}" fill-opacity=".22"/>`).join('') + `<circle cx="200" cy="205" r="112" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width="2"/>`;
  const l1 = c.cat === 'mtg' ? `${c.set}` : c.cat === 'op' ? `${c.set}` : `${c.set}`;
  const l2 = c.cat === 'mtg' ? (c.ctype || '').slice(0, 34) : c.cat === 'op' ? [c.ctype, c.color, c.power ? c.power + ' power' : ''].filter(Boolean).join(' · ') : (c.cat === 'nfl' ? 'Football' : 'Baseball') + (variant ? ' · Parallel' : ' · Base');
  const l3 = variant ? variant.slice(0, 32) : c.rarity;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 558" width="400" height="558"><defs>
<linearGradient id="b" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="${a1}"/><stop offset="1" stop-color="${a2}"/></linearGradient>
<linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${fr}"/><stop offset=".5" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="${fr}"/></linearGradient>
<linearGradient id="h" x1="0" y1="0" x2="1" y2=".6"><stop offset="0" stop-color="#ff2bd6" stop-opacity=".25"/><stop offset=".35" stop-color="#00f0ff" stop-opacity=".18"/><stop offset=".7" stop-color="#ffcc33" stop-opacity=".22"/><stop offset="1" stop-color="#39ff9f" stop-opacity=".18"/></linearGradient>
<radialGradient id="g" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
<rect width="400" height="558" rx="22" fill="url(#f)"/><rect x="10" y="10" width="380" height="538" rx="16" fill="#07060f"/><rect x="16" y="16" width="368" height="526" rx="13" fill="url(#b)"/>
<text x="30" y="56" font-family="system-ui,Roboto,Arial,sans-serif" font-size="${fs}" font-weight="900" fill="#fff">${xe(name.slice(0, 26))}</text>
${c.cat === 'mtg' && c.mana ? `<text x="370" y="56" text-anchor="end" font-family="system-ui,Arial" font-size="16" font-weight="800" fill="#fff" fill-opacity=".85">${xe(c.mana.replace(/[{}]/g, '').slice(0, 10))}</text>` : ''}
<rect x="28" y="72" width="344" height="270" rx="10" fill="#000" fill-opacity=".35" stroke="${fr}" stroke-opacity=".7" stroke-width="2"/>
<svg x="0" y="0" width="400" height="400" viewBox="0 0 400 400"><clipPath id="w"><rect x="28" y="72" width="344" height="270" rx="10"/></clipPath><g clip-path="url(#w)">${motif}<rect x="28" y="72" width="344" height="270" fill="url(#g)"/></g></svg>
${c.tier === 'legendary' ? `<g transform="translate(200 207)" fill="${fr}" fill-opacity=".28">${Array.from({ length: 12 }, (_, i) => `<path d="M0 -118 L9 -70 L-9 -70Z" transform="rotate(${i * 30})"/>`).join('')}</g>` : ''}<rect x="40" y="310" width="${TIER_LABEL[c.tier].length * 9 + 22}" height="22" rx="11" fill="#07060f" fill-opacity=".7" stroke="${fr}" stroke-width="1.5"/><text x="51" y="326" font-family="system-ui,Arial,sans-serif" font-size="12" font-weight="900" letter-spacing="1" fill="${fr}">${TIER_LABEL[c.tier].toUpperCase()}</text><circle cx="200" cy="207" r="70" fill="#07060f" fill-opacity=".55" stroke="${fr}" stroke-width="4"/><text x="200" y="${ini.length > 2 ? 226 : 230}" text-anchor="middle" font-family="system-ui,Arial,sans-serif" font-size="${ini.length > 2 ? 52 : 64}" font-weight="900" fill="#fff" letter-spacing="2">${xe(ini)}</text>
<rect x="28" y="356" width="344" height="130" rx="10" fill="#07060f" fill-opacity=".55"/>
<text x="44" y="388" font-family="system-ui,Arial,sans-serif" font-size="19" font-weight="800" fill="#fff">${xe(l1.slice(0, 30))}</text>
<text x="44" y="418" font-family="system-ui,Arial,sans-serif" font-size="16" font-weight="600" fill="#fff" fill-opacity=".78">${xe(l2.slice(0, 36))}</text>
<text x="44" y="448" font-family="system-ui,Arial,sans-serif" font-size="17" font-weight="800" fill="${fr}">${xe(l3)}</text>
<text x="44" y="474" font-family="system-ui,Arial,sans-serif" font-size="14" font-weight="700" fill="#fff" fill-opacity=".6">#${xe(c.number || '—')} · ${xe(cat.name)}</text>
<text x="200" y="520" text-anchor="middle" font-family="system-ui,Arial,sans-serif" font-size="11" font-weight="800" letter-spacing="1" fill="#fff" fill-opacity=".55">RIPZONE DEMO ART · NOT AN OFFICIAL CARD</text>
${hi ? '<rect x="16" y="16" width="368" height="526" rx="13" fill="url(#h)"/>' : ''}</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
function setCat(id, silent) {
  if (!CAT_BY[id] || busy) return; const changed = S.cat !== id;
  S.cat = id; save(); PACKS = catPacks(id);
  $$('#catBar button').forEach(b => { b.classList.toggle('on', b.dataset.cat === id); b.setAttribute('aria-selected', b.dataset.cat === id); });
  if (!changed && !silent) return;
  const idx = Math.min(centerIdx || 0, PACKS.length - 1);
  buildRail(); requestAnimationFrame(() => { measureRail(); rail.scrollLeft = slideCenters[idx] - railHalf; centerIdx = -1; updateRail(); renderPackInfo(); });
  if (!silent && !reduceMotion) { anim(rail, [{ opacity: 0, transform: 'translate3d(24px,0,0)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.9,.3,1)' }); anim($('#packInfo'), [{ opacity: 0 }, { opacity: 1 }], { duration: 260 }); }
  warmTypical();
}
function renderCatBar() {
  $('#catBar').innerHTML = CATS.map(c => `<button role="tab" data-cat="${c.id}" class="${c.id === S.cat ? 'on' : ''}" aria-selected="${c.id === S.cat}"><span>${c.ico}</span>${c.name}${c.id === 'pkm' ? '' : '<em>BETA</em>'}</button>`).join('');
  $('#catBar').onclick = e => { const b = e.target.closest('[data-cat]'); if (!b || b.dataset.cat === S.cat) return; if (busy) return; if (Tut.active) return toast('Finish or skip the tutorial first'); buzz(8); setCat(b.dataset.cat); b.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' }); };
}

/* ---------- data ---------- */
let OUTLIERS = [], CARDS = [], BY_ID = {}, BY_TIER = {}, META = {}; // BY_TIER = Pokémon tiers (compat); CAT_TIER[cat][tier] for every category
const fmtUSD = n => (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtUSDs = n => Math.abs(n) >= 1000 ? (n < 0 ? '-$' : '$') + Math.round(Math.abs(n)).toLocaleString('en-US') : fmtUSD(n); // compact: whole dollars from $1,000
const fmt = fmtUSD;
const sellPrice = c => r2(c.value * CONFIG.BUYBACK);
/* Graded cards: only entries whose price source is a graded price for that exact grade carry c.graded (see scripts/fetch_graded.py). Raw cards never get a label. */
const gradeWho = g => g.grader === 'PSA' ? 'PSA' : 'GRADED'; // 'Graded 9' entries are any major grader (PSA/BGS/CGC/SGC) at grade 9
const slabChip = c => c.graded ? `<span class="slab-chip" title="${c.graded.label} price from ${c.graded.source}${c.graded.grader !== 'PSA' ? ' (' + c.graded.grader + ')' : ''}"><b>${gradeWho(c.graded)}</b>${c.graded.grade}</span>` : '';
const slabTop = c => c.graded ? `<div class="slab-lbl"><b>${gradeWho(c.graded)}</b><span>${c.graded.grade}</span><i>${c.graded.grader === 'PSA' && c.graded.grade === '10' ? 'GEM MT' : c.graded.grade === '9' ? 'MINT 9' : 'GRADED'}</i></div>` : '';
const GRADED_W = 0.25; // graded slabs are rarer than their raw copy (extra within-tier weight factor), so they stay a chase-within-the-chase
const gcls = c => c.graded ? ' graded' : '';
/* Where a card's USD value comes from: graded slabs use the graded sold-price guide for that grade, everything else the raw / ungraded market price. */
function priceSrc(c) {
  const m = CAT_BY[c.cat].meta || {};
  if (c.graded) return { kind: `${c.graded.label}${c.graded.grader !== 'PSA' ? ' (' + c.graded.grader + ')' : ''} graded market price`, src: c.priceSource?.source || c.graded.source, date: c.graded.fetched || c.priceSource?.fetched || m.fetched, url: c.graded.url };
  if (c.priceSource) return { kind: c.cat === 'nfl' || c.cat === 'mlb' ? 'Ungraded (raw) market price' : 'Raw near-mint market price', src: c.priceSource.source, date: c.priceSource.fetched, url: c.src };
  const sports = c.cat === 'nfl' || c.cat === 'mlb';
  return { kind: sports ? 'Ungraded (raw) market price' : 'Raw near-mint market price', src: (m.source || '').replace(/\s*\+\s*PriceCharting PSA 10/, ''), date: m.fetched, url: c.src };
}

async function loadData() {
  const metas = await Promise.all(CATS.map(c => fetch(c.file).then(r => r.json())));
  META = metas[0]; CARDS = [];
  CATS.forEach((cat, i) => {
    cat.meta = metas[i]; const T = CAT_TIER[cat.id] = {}; for (const t of TIERS) T[t] = [];
    for (const c of metas[i].cards) { c.avail = 1;
      // card value = current USD market price for the card in its listed condition (PSA slabs: graded price). No coin conversion.
      // files store value = round(USD x 40) (old coin scale); true USD is market / graded.usd (fallback value / coinsPerUSD)
      const usd = c.graded ? c.graded.usd : c.market > 0 ? c.market : c.value / (metas[i].coinsPerUSD || 40);
      if (!(usd > 0)) continue; // no verified market price -> not offered
      c.value = Math.max(0.01, r2(usd));
      c.cat = cat.id; BY_ID[c.id] = c;
      if (c.value > CONFIG.MAX_CARD_USD) { c.outlier = true; OUTLIERS.push(c); continue; } // single-sale outliers: kept in data, flagged, never in packs
      T[c.tier].push(c); c.w = 1 / Math.sqrt(c.value); CARDS.push(c);
      if (!c.img) { let u = null; Object.defineProperty(c, 'img', { get() { return u || (u = cardArt(c)); }, enumerable: false }); } // fallback frame only when no real photo is bundled
    }
    for (const t of TIERS) { const a = T[t]; a.wsum = a.reduce((s, c) => s + c.w, 0); a.ev = a.reduce((s, c) => s + c.w * c.value, 0) / (a.wsum || 1); }
  });
  BY_TIER = CAT_TIER.pkm;
  // per-pack card pool: every card of the category worth at least the pack's floor value (Grey = cheapest available ... Gold = grails)
  for (const p of ALL_PACKS) {
    const okOut = CONFIG.OUTLIER_OK_PRICES.includes(p.price); p.cands = CARDS.concat(okOut ? OUTLIERS : []).filter(c => c.cat === p.cat && c.value <= p.maxPull).sort((a, b) => a.value - b.value); // v0.9.21: every card (Collectr or filler) must sit inside the pack's floor..max-pull range
    const cs = p.cands.filter(c => c.value >= (p.minCard || 0));
    p.pool = { all: { cs } }; p.minVal = cs.length ? cs[0].value : 0; p.maxVal = cs.length ? cs[cs.length - 1].value : 0; p.floor = p.minCard || 0;
  }
  RZBackend.seed && RZBackend.seed(metas[0].cards.filter(c => c.serials)); applyStock();
}
/* v0.10.0 serialized stock: a card is in a pack only while >= 1 physical copy is 'available'; its weight scales with copies on hand.
   Called after every purchase / sell-back / ship so odds always reflect real inventory. */
function applyStock() {
  const m = RZBackend.availMap ? RZBackend.availMap() : null; if (!m || m.then) return;
  for (const c of CARDS) if (c.serials) c.avail = m[c.id] || 0;
  for (const p of ALL_PACKS) { if (!p.cands) continue; const cs = p.cands.filter(c => c.avail > 0 && c.value >= (p.minCard || 0)); p.pool = { all: { cs } }; p.minVal = cs.length ? cs[0].value : 0; p.maxVal = cs.length ? cs[cs.length - 1].value : 0; }
  for (const k in _D) delete _D[k]; for (const k in _typCache) delete _typCache[k];
}
function rollTier(odds) { let x = rnd(), acc = 0; for (const t of TIERS) { acc += odds[t] || 0; if (x < acc) return t; } return Object.keys(odds).pop(); }
/* ---------- v0.9.3 single-card engine ----------
   Every pack pulls exactly ONE card. Each risk mode is a probability distribution over real cards, D = { cs, pr }, solved so
   the expected market value of the single card is exactly rtpFor(mode) x price.
   normal: base rarity odds x within-rarity weights over this pack's pool (cards >= the floor value), then an exponential tilt
     exp(a*z) on standardised log-value, with a found by bisection so EV = RTP x price.
   high:   Normal, with every card worth >= the pack price boosted 2.5x, then re-tilted to the same EV (fewer mid hits, bigger chase).
   max:    two outcomes. P_GOLD (10%) = a Gold-band card (worth >= GOLD x price), otherwise (90%) a LOSS card worth less than
     the price (but >= the floor value on Premium/Legendary). Loss cards are tilted toward LOSS_X x price, Gold cards are tilted
     so EV is exact. 
   5050:   GOLD (q) = card in 1.8-2.2x price tilted to 2.0x, SILVER = card in 0.2-0.3x tilted toward 0.2x; q solved so EV = 90%. No floor.
   Max and 50/50 draw from the whole category inventory (same physical stock), not only the pack's rarity pool. */
const RISK = {
  normal: { label: 'Normal', ico: '◆', desc: 'Standard odds (default): about half of pulls are worth the price or more' },
  high: { label: 'High', ico: '▲', desc: 'About 1 in 5 pulls worth the price or more, with more top cards and more low-value cards' },
  max: { label: 'Max', ico: '⚡', desc: '10% Gold grail card (~5× price), otherwise a base card (~0.4×)' },
  '5050': { label: '50/50', ico: '◐', desc: 'Gold or Silver: ~43% Gold card at ~2× price, else Silver 0.05–0.11×' },
};
const RISK_IDS = ['normal', 'high', 'max', '5050']; // explicit order ('5050' is an integer-like key, so Object.keys would list it first)
const riskOf = m => RISK[m] ? m : 'normal';
/* 6 colour bands by the card's value as a multiple of the pack price (CONFIG.BANDS). Used for odds, reveal glow and the feed. */
const BAND_IDS = ['grey', 'green', 'blue', 'purple', 'red', 'gold'];
const BAND_LABEL = { silver: 'Silver', grey: 'Grey', green: 'Green', blue: 'Blue', purple: 'Purple', red: 'Red', gold: 'Gold' };
const BAND_HEX = { silver: '#dfe4ee', grey: '#b8c0d8', green: '#39ff9f', blue: '#3fa9ff', purple: '#c04bff', red: '#ff3d5a', gold: '#ffcc33' };
const bandIdx = (v, price) => { const x = v / price, B = CONFIG.BANDS; let i = 0; for (let k = 1; k < B.length; k++) if (x >= B[k]) i = k; return i; };
const FF_BANDS = ['silver', 'gold']; // 50/50 shows only Silver (loss) / Gold (win)
const bandsFor = (mode = S.risk) => riskOf(mode) === '5050' ? FF_BANDS : BAND_IDS;
const bandOf = (c, p, mode = S.risk) => riskOf(mode) === '5050' ? (c.value >= p.price ? 'gold' : 'silver') : BAND_IDS[bandIdx(c.value, p.price)];
const bandRange = (b, p) => { const i = BAND_IDS.indexOf(b), B = CONFIG.BANDS; return [B[i] * p.price, i < B.length - 1 ? B[i + 1] * p.price : Infinity]; };
const _D = {};
const FIFTY_RTP = () => CONFIG.FIFTY.RTP;
function rtpFor(mode) { return riskOf(mode) === '5050' ? FIFTY_RTP() : CONFIG.RTP; }
function tiltTo(cs, base, target) { // exponential tilt in log-value so the weighted mean card value = target (clamped to what the cards allow)
  const lv = cs.map(c => Math.log(c.value)), m = lv.reduce((a, b) => a + b, 0) / lv.length;
  const wts = a => { const ex = lv.map(l => a * (l - m)), mx = Math.max(...ex); return ex.map((e, i) => base[i] * Math.exp(e - mx)); };
  const mean = a => { const w = wts(a), W = w.reduce((x, y) => x + y, 0); return w.reduce((x, wi, i) => x + wi * cs[i].value, 0) / W; };
  let lo = -60, hi = 60; if (mean(lo) >= target) hi = lo; else if (mean(hi) <= target) lo = hi; else for (let k = 0; k < 120; k++) { const mid = (lo + hi) / 2; mean(mid) < target ? lo = mid : hi = mid; }
  const w = wts((lo + hi) / 2), W = w.reduce((a, b) => a + b, 0);
  return { cs, pr: w.map(x => x / W), ev: w.reduce((x, wi, i) => x + wi * cs[i].value, 0) / W };
}
const baseW = c => Math.pow(c.value, -.5) * (c.graded ? GRADED_W : 1) * (c.avail ?? 1);
function finish(D) { // add summary stats + a sorted CDF for exact percentiles
  let ev = 0, m2 = 0; D.cs.forEach((c, i) => { ev += D.pr[i] * c.value; m2 += D.pr[i] * c.value * c.value; });
  D.ev = ev; D.sd = Math.sqrt(Math.max(0, m2 - ev * ev));
  const live = D.cs.map((c, i) => [c.value, D.pr[i]]).filter(x => x[1] > 1e-12).sort((a, b) => a[0] - b[0]);
  D.sorted = live; D.min = live[0][0]; D.max = live[live.length - 1][0];
  let acc = 0; D.cum = live.map(x => acc += x[1]); return D;
}
function tierDist(cs, tbl, price, min, maxPull, target) { // v0.9.13: fixed tier chances (Rips-style table) + one shared log-value tilt inside every tier so EV = target
  const lo = x => x === 'F' ? min : x * price, hi = x => x === 'M' ? maxPull : x * price;
  let T = tbl.map(([q, a, b], k) => ({ q, cs: cs.filter(c => c.value >= lo(a) && (b === 'M' ? c.value <= hi(b) : c.value < hi(b))) }));
  // empty tier: its chance moves to the nearest non-empty tier on the same side of the price (keeps the at-or-above-price share)
  T.forEach((t, k) => { if (t.cs.length || !t.q) return; const above = tbl[k][1] !== 'F' && tbl[k][1] >= 1; const order = T.map((u, i) => i).filter(i => i !== k && T[i].cs.length && ((tbl[i][1] !== 'F' && tbl[i][1] >= 1) === above)).sort((a, b) => Math.abs(a - k) - Math.abs(b - k));
    const to = order[0] ?? T.map((u, i) => i).filter(i => T[i].cs.length).sort((a, b) => Math.abs(a - k) - Math.abs(b - k))[0]; if (to != null) { T[to].q += t.q; t.q = 0; } });
  T = T.filter(t => t.cs.length && t.q > 0); const lp = Math.log(price);
  const build = a => { const out = T.map(t => { const w = t.cs.map(c => baseW(c) * Math.exp(Math.max(-700, Math.min(700, a * (Math.log(c.value) - lp))))), W = w.reduce((x, y) => x + y, 0) || 1; return { cs: t.cs, pr: w.map(x => x / W), ev: w.reduce((x, wi, i) => x + wi * t.cs[i].value, 0) / W, q: t.q }; }); return { out, ev: out.reduce((x, t) => x + t.q * t.ev, 0) }; };
  let A = -40, B = 40; if (build(A).ev >= target) B = A; else if (build(B).ev <= target) A = B; else for (let k = 0; k < 100; k++) { const m = (A + B) / 2; build(m).ev < target ? A = m : B = m; }
  const r = build((A + B) / 2); return mix(r.out.map(t => [t, t.q]));
}
function monoDist(cs, T, high) { // v0.9.21 monotone odds: w = v^a with a <= 0 (Normal); High = lambda*flat + (1-lambda)*steep v^-6 (more grails AND more floor pulls). Both non-increasing in value; EV solved = T exactly.
  const pw = a => { const w = cs.map(c => Math.pow(c.value, a)), W = w.reduce((x, y) => x + y, 0); const pr = w.map(x => x / W); return { cs, pr, ev: pr.reduce((x, q, i) => x + q * cs[i].value, 0) }; };
  if (!high) { let A = -40, B = 0; if (pw(B).ev <= T) A = B; else if (pw(A).ev >= T) B = A; else for (let k = 0; k < 200; k++) { const m = (A + B) / 2; pw(m).ev < T ? A = m : B = m; } const r = pw((A + B) / 2); r.a = (A + B) / 2; return r; }
  const U = pw(0), Sd = pw(-6); const l = Math.max(0, Math.min(1, (T - Sd.ev) / (U.ev - Sd.ev))); return { cs, pr: cs.map((c, i) => l * U.pr[i] + (1 - l) * Sd.pr[i]), lambda: l };
}
function monoOk(D) { // every card's chance <= the chance of any cheaper card (ties at equal value allowed)
  const L = D.cs.map((c, i) => [c.value, D.pr[i]]).filter(x => x[1] > 1e-15).sort((a, b) => a[0] - b[0]); let prevMin = Infinity, curV = null, curMin = Infinity, curMax = 0;
  for (const [v, q] of L) { if (v !== curV) { prevMin = Math.min(prevMin, curMin); curV = v; curMin = q; curMax = q; } else { curMin = Math.min(curMin, q); curMax = Math.max(curMax, q); } if (q > prevMin * (1 + 1e-9)) return false; } return true; }
function mix(parts) { const cs = [], pr = []; for (const [P, k] of parts) P.cs.forEach((c, i) => { cs.push(c); pr.push(k * P.pr[i]); }); return { cs, pr }; }
function dist(p, mode = S.risk) {
  mode = riskOf(mode); const key = p.id + ':' + mode; if (_D[key]) return _D[key];
  const price = p.price, min = p.minCard || 0, catC = p.cands ? p.cands.filter(c => c.avail > 0) : CARDS.filter(c => c.cat === p.cat).sort((a, b) => a.value - b.value);
  let D;
  if (mode === 'normal' || mode === 'high') {
    const cs = p.pool.all.cs; if (!cs.length) return _D[key] = { ok: false, why: 'no cards at or above the floor', cs: [], pr: [] };
    const tbl = mode === 'high' ? CONFIG.TIERS_HIGH : CONFIG.NORMAL_40_PRICES.includes(price) ? CONFIG.TIERS_NORMAL_40 : CONFIG.TIERS_NORMAL;
    D = tierDist(cs, tbl, price, min, p.maxPull, CONFIG.RTP * price); D.tiers = tbl;
  } else if (mode === 'max') {
    const M = CONFIG.MAX, T = CONFIG.RTP * price, gMin = CONFIG.BANDS[5] * price;
    const lossC = catC.filter(c => c.value >= Math.max(min, CONFIG.MIN_CARD_X * price) && c.value < price), goldC = catC.filter(c => c.value >= gMin && c.value <= p.maxPull);
    if (goldC.length < CONFIG.MIN_HITS || !lossC.length) return _D[key] = { ok: false, why: goldC.length < CONFIG.MIN_HITS ? `only ${goldC.length} card${goldC.length === 1 ? '' : 's'} worth ${CONFIG.BANDS[5]}× the price (${fmtUSDs(gMin)}+) for Gold (need ${CONFIG.MIN_HITS}+)` : 'no loss cards between the floor and the price', cs: [], pr: [] };
    let loss = tiltTo(lossC, lossC.map(baseW), Math.max(M.LOSS_X * price, min));
    let gold = tiltTo(goldC, goldC.map(baseW), (T - (1 - M.P_GOLD) * loss.ev) / M.P_GOLD); // v0.9.13: Gold fixed at P_GOLD (10%), its average solved (~5x)
    if (Math.abs(M.P_GOLD * gold.ev + (1 - M.P_GOLD) * loss.ev - T) > 1e-9 * T) loss = tiltTo(lossC, lossC.map(baseW), (T - M.P_GOLD * gold.ev) / (1 - M.P_GOLD)); // gold pool can't reach it: move the loss average
    const q = Math.max(0, Math.min(1, (T - loss.ev) / (gold.ev - loss.ev))); // grail chance solved from the real pool averages so EV = RTP exactly
    D = mix([[gold, q], [loss, 1 - q]]); D.q = q; D.hi = gold; D.lo = loss; D.hiLabel = 'GOLD'; D.loLabel = 'LOSS';
  } else {
    const F = CONFIG.FIFTY, T = F.RTP * price;
    const inR = (c, R) => c.value >= R[0] * price && c.value <= R[1] * price;
    const goldC = catC.filter(c => inR(c, F.GOLD_RANGE)), silC = catC.filter(c => inR(c, F.SILVER_RANGE));
    if (!goldC.length || !silC.length) return _D[key] = { ok: false, why: !goldC.length ? `no card in the data worth ${F.GOLD_RANGE[0]}–${F.GOLD_RANGE[1]}× the price (${fmtUSDs(F.GOLD_RANGE[0] * price)}–${fmtUSDs(F.GOLD_RANGE[1] * price)}) for Gold` : `no card worth ${F.SILVER_RANGE[0]}–${F.SILVER_RANGE[1]}× the price (${fmtUSDs(F.SILVER_RANGE[0] * price)}–${fmtUSDs(F.SILVER_RANGE[1] * price)}) for Silver`, cs: [], pr: [] };
    const flat = c => (c.graded ? GRADED_W : 1) * (c.avail ?? 1);
    const gold = tiltTo(goldC, goldC.map(flat), F.GOLD_X * price), sil = tiltTo(silC, silC.map(flat), F.SILVER_X * price);
    const q = Math.max(0, Math.min(1, (T - sil.ev) / (gold.ev - sil.ev))); // P(gold) from the real pool averages => RTP exact (44% when pools average 1.8x / 0.2x)
    D = mix([[gold, q], [sil, 1 - q]]); D.q = q; D.hi = gold; D.lo = sil; D.hiLabel = 'GOLD'; D.loLabel = 'SILVER';
  }
  finish(D);
  // a mode is only offered when real card prices hit its target exactly (no invented prices); max/5050 also need their WIN/GOLD probability on target
  const T = rtpFor(mode) * price, qT = null;
  D.ok = Math.abs(D.ev - T) <= 1e-6 * T && (qT == null || Math.abs(D.q - qT) < 1e-6);
  if (!D.ok) D.why = Math.abs(D.ev - T) > 1e-6 * T ? `real card values top out at ${fmtUSDs(D.max)}: can't reach ${Math.round(rtpFor(mode) * 100)}% (${fmtUSDs(T)}) on average` : (mode === '5050' ? `the cheapest cards can't average ${fmtUSDs(D.lossTarget || CONFIG.FIFTY.LOSS_X * T / CONFIG.RTP)} for a lower-value card, so ${Math.round(qT * 100)}% top-card odds don't balance` : `needs ${Math.round(qT * 100)}% Gold odds but the inventory gives ${(D.q * 100).toFixed(2)}%`);
  D.hits = new Set(D.cs.filter((c, i) => D.pr[i] > 1e-12 && c.value >= price)).size;
  if (D.ok && mode !== 'normal' && mode !== '5050' && !dist(p, 'normal').ok) { D.ok = false; D.why = dist(p, 'normal').why; }
  if (D.ok && mode === 'normal' && D.hits < CONFIG.MIN_HITS) { D.ok = false; D.why = `only ${D.hits} card${D.hits === 1 ? '' : 's'} in the data worth the ${fmtUSDs(price)} price (need ${CONFIG.MIN_HITS}+)`; }
  return _D[key] = D;
}
const packOk = p => dist(p, 'normal').ok;
const modeOk = (p, m = S.risk) => dist(p, m).ok;
const compMin = P => Math.min(...P.cs.filter((c, i) => P.pr[i] > 1e-12).map(c => c.value)), compMax = P => Math.max(...P.cs.filter((c, i) => P.pr[i] > 1e-12).map(c => c.value));
function oddsFor(p, mode = S.risk) { const D = dist(p, mode), o = {}; D.cs.forEach((c, i) => { if (D.pr[i] <= 1e-12) return; const b = bandOf(c, p, mode); o[b] = (o[b] || 0) + D.pr[i]; }); return o; }
function poolFor(p, mode = S.risk) { // per band: cards, conditional mean, value span
  const D = dist(p, mode), P = {}; D.cs.forEach((c, i) => { if (D.pr[i] <= 1e-12) return; const b = bandOf(c, p, mode), q = P[b] = P[b] || { cs: [], pr: 0, ev: 0, min: Infinity, max: 0 }; if (!q.cs.includes(c)) q.cs.push(c); q.pr += D.pr[i]; q.ev += D.pr[i] * c.value; q.min = Math.min(q.min, c.value); q.max = Math.max(q.max, c.value); });
  for (const b in P) P[b].ev /= P[b].pr; return P;
}
function pickD(D, u) { let x = u ?? rnd(); for (let i = 0; i < D.cs.length; i++) { x -= D.pr[i]; if (x <= 0) return D.cs[i]; } return D.cs[D.cs.length - 1]; }
/* The single source of truth for what a pack contains (always 1 card): used by the buy flow and by scripts/verify_odds.py.
   force (QA screenshots only): a band id, e.g. 'gold', picks a card of that band from this mode's distribution. */
function rollPack(p, force, mode = S.risk, u) {
  const D = dist(p, mode);
  if (force && bandsFor(mode).includes(force)) { const ix = D.cs.map((c, i) => i).filter(i => D.pr[i] > 0 && bandOf(D.cs[i], p, mode) === force); if (ix.length) { const s = ix.reduce((a, i) => a + D.pr[i], 0); let x = rnd() * s; for (const i of ix) { x -= D.pr[i]; if (x <= 0) return [D.cs[i]]; } return [D.cs[ix[ix.length - 1]]]; } }
  return [pickD(D, u)];
}
// v0.9.14: the purchase-time draw, shared by startRip and the QA purchase test (one crypto seed -> u -> exactly one card)
function purchaseRoll(p, mode, force) { const seed = crypto.getRandomValues(new Uint32Array(1))[0], u = seed / 4294967296; return { seed, u, card: rollPack(p, force, mode, u)[0] }; }
function rollCard(tier, p) { const a = CAT_TIER[p?.cat || 'pkm'][tier]; let x = rnd() * a.wsum; for (const c of a) { x -= c.w; if (x <= 0) return c; } return a[a.length - 1]; }
function quantile(D, q) { const i = D.cum.findIndex(c => c >= q - 1e-12); return D.sorted[Math.max(0, i)][0]; }
/* Typical range: exact 5th-95th percentile (and median) of the single card's value. */
const _typCache = {};
function typicalRange(p, mode = S.risk) { const key = p.id + ':' + riskOf(mode); if (_typCache[key]) return _typCache[key]; const D = dist(p, mode); return _typCache[key] = [quantile(D, .05), quantile(D, .95), quantile(D, .5)]; }
function typicalRangeAsync(p, mode, cb) { cb(typicalRange(p, mode)); }
function packEV(p, mode = S.risk) { return dist(p, mode).ev; }
function packSD(p, mode = S.risk) { return dist(p, mode).sd; }
const CHASE_X = 2;
function atOrAbove(p, mode = S.risk) { const D = dist(p, mode); return D.cs.reduce((a, c, i) => a + (c.value >= p.price ? D.pr[i] : 0), 0); }
function tierTxt(p, mode) { const t = mode === 'high' ? CONFIG.TIERS_HIGH : CONFIG.NORMAL_40_PRICES.includes(p.price) ? CONFIG.TIERS_NORMAL_40 : CONFIG.TIERS_NORMAL; return t.map(([q, a, b]) => `${Math.round(q * 100)}% ${a === 'F' ? 'floor' : a + '×'}–${b === 'M' ? 'max' : b + '×'}`).join(', '); }
function chaseP(p, mode = S.risk, x = CHASE_X) { const D = dist(p, mode), v = x * p.price; return D.cs.reduce((a, c, i) => a + (c.value >= v ? D.pr[i] : 0), 0); }
function topCardP(p, mode = S.risk) { const D = dist(p, mode); return D.cs.reduce((a, c, i) => a + (c.value === D.max ? D.pr[i] : 0), 0); }
function packRange(p, mode = S.risk) { const D = dist(p, mode); return [D.min, D.max]; }
function packFloor(p, mode = S.risk) { const m = riskOf(mode); return m === '5050' ? 0 : m === 'max' ? r2(Math.max(p.minCard || 0, CONFIG.MIN_CARD_X * p.price)) : p.minCard || 0; } // single-card floor (Premium/Legendary), not in 50/50

/* ---------- haptics ---------- */
const NativeHaptics = window.Capacitor?.isNativePlatform?.() && window.Capacitor.registerPlugin ? window.Capacitor.registerPlugin('Haptics') : null;
function buzz(p) {
  try {
    if (NativeHaptics) {
      const d = Array.isArray(p) ? p.reduce((a, b, i) => i % 2 ? a : a + b, 0) : p;
      d <= 12 ? NativeHaptics.impact({ style: 'LIGHT' }) : d < 40 ? NativeHaptics.impact({ style: 'MEDIUM' }) : NativeHaptics.vibrate({ duration: Math.min(d, 400) });
    } else if (navigator.vibrate && navigator.userActivation?.hasBeenActive !== false) navigator.vibrate(p);
  } catch {}
}

/* ---------- UI: wallet / nav / toast ---------- */
let shownBal = S.bal;
function renderWallet(bump) {
  const el = $('#balUSD'), from = shownBal, to = spendable();
  if (from === to || !bump || reduceMotion) { shownBal = to; el.textContent = fmtUSD(to); }
  else {
    el.parentElement.classList.remove('bump'); void el.offsetWidth; el.parentElement.classList.add('bump');
    const t0 = performance.now(), dur = 600; shownBal = to;
    const step = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = fmtUSD(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); else el.textContent = fmtUSD(to); };
    requestAnimationFrame(step);
  }
  if ($('#view-store').classList.contains('active')) renderWalletCard();
  if (S.user && typeof UserService !== 'undefined') UserService.saveBalance();
}
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200); }
function nav(v) {
  if (HOME2_NAV) { if (v === 'more') { if (!document.querySelector('.view.active:is(#view-shop,#view-collection,#view-rewards,#view-store)')) nav('shop'); drawer(true); return; } drawer(false); }
  $$('.view').forEach(x => x.classList.toggle('active', x.id === 'view-' + v));
  $$('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.nav === v || ['rules', 'terms', 'refer', 'how', 'privacy', 'rg', 'profile', 'kyc', 'odds', 'support'].includes(v) && b.dataset.nav === 'more'));
  if (v === 'collection') renderCollection(); else if (selMode) setSelMode(false);
  if (v === 'refer') renderRefer();
  if (v === 'rewards') renderRewards();
  if (v === 'rg') renderRG();
  if (v === 'odds') renderOddsAll();
  if (v === 'profile') renderProfile();
  if (v === 'store') renderStore();
  if (v === 'shop') requestAnimationFrame(() => { measureRail(); updateRail(); if (document.documentElement.classList.contains('home2')) h2Layout(); });
}
document.addEventListener('click', e => { const n = e.target.closest('[data-nav]'); if (n) { e.preventDefault(); nav(n.dataset.nav); } });

/* ---------- daily streak ---------- */
const dayKey = (t = Date.now()) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const dayDiff = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
function streakLast(v) { // v0.9.18: tolerate legacy/odd saved values (timestamp, ISO string) -> local YYYY-MM-DD, else null
  if (!v) return null; if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v; const t = typeof v === 'number' ? v : Date.parse(v); return isFinite(t) ? dayKey(t) : null; }
function streakState() { // which day of the 7-day cycle is claimable today, and whether the streak broke
  const st = S.streak || (S.streak = { n: 0, last: null }), today = dayKey(), last = streakLast(st.last);
  if (!last) return { today: 0, claimed: false, broke: false };
  const gap = dayDiff(last, today);
  if (!isFinite(gap) || gap < 0) return { today: 0, claimed: false, broke: false }; // clock went backwards / bad data: allow a fresh day-1 claim
  if (gap === 0) return { today: (st.n - 1) % 7, claimed: true, broke: false };
  if (gap === 1) return { today: st.n % 7, claimed: false, broke: false };
  return { today: 0, claimed: false, broke: st.n > 0 };
}
const fmtCountdown = ms => { const h = Math.floor(ms / 3.6e6), m = Math.floor(ms % 3.6e6 / 6e4), s2 = Math.floor(ms % 6e4 / 1e3); return `${h}:${String(m).padStart(2, '0')}:${String(s2).padStart(2, '0')}`; };
function rewardsReady() { return !streakState().claimed; }
let dailyDay = dayKey();
function renderDaily() {
  const b = $('#dailyBtn'), ready = rewardsReady();
  if (b) { b.classList.toggle('wait', !ready); b.classList.toggle('ready', ready); const t = $('#dailyTxt'); if (t) t.textContent = ready ? 'Daily reward' : 'Rewards'; }
  // v0.9.18: the home Daily button is hidden in the new home, so the Rewards tab + menu item carry the 'ready' dot
  $$('.tabbar [data-nav="rewards"], #view-more [data-nav="rewards"]').forEach(x => x.classList.toggle('rw-ready', ready));
  const k = dayKey(); if (k !== dailyDay) { dailyDay = k; if ($('#view-rewards').classList.contains('active')) renderRewards(); } // v0.9.18: local midnight passed while the app was open -> re-render (was stuck on 'Claimed')
  else if ($('#view-rewards').classList.contains('active')) updateRewardsTimers();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { dailyDay = ''; renderDaily(); } }); // resume from background: re-check the day
$('#dailyBtn')?.addEventListener('click', () => nav('rewards'));
setInterval(renderDaily, 1000);
function claimFX(fromEl, usd) { // cash flies from the button into the wallet, then the balance ticks up
  const r = fromEl.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, g = $('#balUSD').getBoundingClientRect();
  FX.burst(x, y, 50, ['#5dffa8', '#d6ffe9', '#ffffff', '#ffcc33'], 1);
  if (usd > 0) FX.fly(x, y, g.left + 10, g.top + g.height / 2, Math.min(26, 8 + Math.round(Math.sqrt(usd) * 4)), '#5dffa8');
  anim(fromEl, [{ transform: 'scale(1)' }, { transform: 'scale(.92)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 420, fill: 'none' });
  buzz([15, 40, 15, 40, 30]);
  setTimeout(() => renderWallet(true), 650);
}
function grantPacks(packs) { for (const k in packs) S.freePacks[k] = (S.freePacks[k] || 0) + packs[k]; }
const packTxt = o => Object.entries(o || {}).map(([k, v]) => `${v} free ${baseName(k)} pack${v > 1 ? 's' : ''}`).join(' + ');
function claimStreak() {
  const st = streakState(); if (st.claimed) return toast('Come back tomorrow for day ' + (st.today + 2 > 7 ? 1 : st.today + 2));
  if (RG.cooling()) return RG.blocked();
  const btn0 = $('#streakClaim'); if (btn0) btn0.disabled = true; // v0.9.18: no double claim from a fast double tap
  const d = st.today, rw = STREAK[d];
  S.streak = { n: d + 1, last: dayKey() }; credit(rw.usd, `Daily streak · day ${d + 1}`); if (rw.pack) grantPacks({ [rw.pack]: 1 });
  save(); const btn = $('#streakClaim'); claimFX(btn, rw.usd);
  const tile = $(`.sday[data-d="${d}"]`); tile && anim(tile, [{ transform: 'scale(1)' }, { transform: 'scale(1.18) rotate(-3deg)' }, { transform: 'scale(1)' }], { duration: 500, fill: 'none', easing: 'cubic-bezier(.3,1.6,.5,1)' });
  toast(`🔥 Day ${d + 1}: +${fmtUSD(rw.usd)} credit${rw.pack ? ` + FREE ${baseName(rw.pack)} pack` : ''}`);
  setTimeout(() => { renderRewards(); renderDaily(); renderPackInfo(); }, 520);
}
function renderRewards() {
  const st = streakState(), cyc = st.claimed ? st.today : st.today - 1; // index of last claimed day in this cycle
  const tiles = STREAK.map((rw, d) => { const done = d <= cyc && !(st.broke), today = d === st.today && !st.claimed;
    return `<div class="sday ${d === 6 ? 'big' : ''} ${done ? 'done' : ''} ${today ? 'today' : ''}" data-d="${d}"><div class="sd-day">DAY ${d + 1}</div>
      <div class="sd-usd">${fmtUSD(rw.usd)}</div><div class="sd-sub">credit</div>
      ${rw.pack ? `<div class="sd-pack"><span class="fp-art mini pack-tier-${rw.pack}"></span>+ FREE ${baseName(rw.pack)} pack</div>` : ''}${done ? '<div class="sd-check">✓</div>' : ''}</div>`; }).join('');
  const fp = Object.entries(S.freePacks).filter(([, n]) => n > 0);
  $('#rewardsBody').innerHTML = `
    <div class="rw-card streak-card">
      <div class="rw-top"><div><b>Daily login streak</b><div class="muted small">${st.broke ? 'Streak reset — you missed a day. Back to day 1!' : `🔥 ${st.claimed ? S.streak.n : Math.max(0, st.today)}-day streak · miss a day and it resets`}</div></div>
        <div class="rw-day">Day ${st.today + 1}<small>of 7</small></div></div>
      <div class="sgrid">${tiles}</div>
      <button class="cta" id="streakClaim" ${st.claimed ? 'disabled' : ''}>${st.claimed ? `<span>✓ Claimed · day ${st.today + 2 > 7 ? 1 : st.today + 2} in <span id="streakCd" class="cd"></span></span>` : `Claim day ${st.today + 1}: +${fmtUSD(STREAK[st.today].usd)}${STREAK[st.today].pack ? ` + FREE ${baseName(STREAK[st.today].pack)} pack` : ''}`}</button>
    </div>
    ${fp.length ? `<div class="rw-card"><b>Your free packs</b><div class="fp-list">${fp.map(([k, n]) => `<button class="fp" data-fp="${k}"><span class="fp-art pack-tier-${k}"></span><span><b>${n}× ${baseName(k)}</b><small>Tap to open free · any category</small></span>›</button>`).join('')}</div></div>` : ''}
    <button class="ref-banner" data-nav="refer">🤝 <span><b>Invite friends: ${fmtUSD(REF.perFriend.usd)} credit each</b><small>Paid once a friend opens ${REF.perFriend.afterPacks} packs. Milestones unlock free packs.</small></span>›</button>
    <p class="fine">Rewards are small promotional credits added to your USD balance, plus free packs. Promotional-credit terms (for example a play-through requirement before withdrawal) are an open item for counsel.</p>`;
  $('#streakClaim').onclick = claimStreak;
  $$('#rewardsBody [data-fp]').forEach(b => b.onclick = () => { const i = PACKS.findIndex(q => freeKey(q) === b.dataset.fp); nav('shop'); requestAnimationFrame(() => { measureRail(); snapTo(i); }); });
  updateRewardsTimers();
}
function updateRewardsTimers() {
  const sc = $('#streakCd'); if (sc) { const t = new Date(); t.setHours(24, 0, 0, 0); sc.textContent = fmtCountdown(t - Date.now()); }
}

/* ---------- pack art ---------- */
function artHTML(p, lite, tear) { // brand pack art (img/packs/<cat>-<tier>.webp, 614x1024) + the pack's price chip
  const v2 = pack3d(p); // v0.9.12 packs-v2 (3D foil, price printed on the art): shop/ring use the yaw_0 render, the tear uses the flat front art
  if (v2 && v2.tear && v2.tear.includes(0)) {
    if (!tear) return `<div class="art brand v2" style="background-image:url(${pack3dImg(p, 't0')})" role="img" aria-label="${CAT_BY[p.cat].name} ${p.name} pack"><div class="foil"></div></div>`;
    // v0.9.12 tear: the 3D render itself (yaw 0 base + yaw -15/+15 blended on top for hand-held parallax, driven by --wl/--wr on .rpack)
    return `<div class="art brand v2 t3d"><i class="pc" style="background-image:url(${pack3dImg(p, 't0')})"></i></div>`; }
  if (tear) // no 3D renders yet: placeholder pouch = flat art masked to the 3D pouch outline x pillow shading (shared packs-v2 layer)
    return `<div class="art brand ao3d" style="background-image:url(${p.art})"><i class="ao"></i>${lite ? '' : `<div class="pprice">${fmtPrice(p.price)}</div>`}</div>`;
  if (lite) return `<div class="art brand lite" style="background-image:url(${p.art})"></div>`; // tear-strip slices only show the top band
  return `<div class="art brand" style="background-image:url(${p.art})" role="img" aria-label="${CAT_BY[p.cat].name} ${p.name} pack"><div class="pprice">${fmtPrice(p.price)}</div>${p.cat !== 'pkm' ? '<div class="pcat">BETA</div>' : ''}<div class="foil"></div></div>`;
}

/* ---------- shop carousel ---------- */
const rail = $('#packRail');
let slides = [], slideCenters = [], railHalf = 0, centerIdx = 0, railRAF = 0;
function buildRail() {
  rail.innerHTML = '<div class="spacer"></div>' + PACKS.map((p, i) => `
    <div class="slide${CARDS.length && !packOk(p) ? ' na' : ''}" data-i="${i}"><div class="pack-tilt"><div class="pack-float"><div class="pack-halo pack-tier-${p.base}"></div><div class="pack pack-tier-${p.base} cat-${p.cat}"><div class="pack-shadow"></div>${artHTML(p)}<div class="sheen"></div></div></div><div class="slide-meta"><span class="sm-price pack-tier-${p.base}">${fmtPrice(p.price)}</span><span class="sm-top">Min <b>${fmtUSDs(p.minCard)}</b> · Max <b>${fmtUSDs(p.maxVal || p.maxPull)}</b></span></div></div></div>`).join('') + '<div class="spacer"></div>';
  slides = $$('.slide', rail).map(el => ({ el, tilt: $('.pack-tilt', el), pack: $('.pack', el), foil: $('.foil', el), sheen: $('.sheen', el) })); slides.forEach((s, i) => { s.art = $('.art.v2', s.el); s.p = PACKS[i]; s.yk = 't0'; }); // v0.9.17: angled yaw stills for side packs PACKS.forEach(p => { const M = pack3d(p); if (M) M.angles.forEach(g => { if (g) new Image().src = pack3dImg(p, (M.tear || []).includes(g) ? 't' + g : 'y' + g); }); });
  $('#packDots').innerHTML = PACKS.map(() => '<i></i>').join('');
  if (CARDS.length) markRail(); renderHero();
  measureRail(); if (document.documentElement.classList.contains('home2')) requestAnimationFrame(() => h2Layout());
}
function markRail() { // after card data loads: top-hit values + packs the real inventory can't support
  $$('#packRail .slide').forEach((el, i) => { const p = PACKS[i]; if (!p) return; const ok = packOk(p), b = $('.sm-top', el); el.classList.toggle('na', !ok);
    if (b) b.innerHTML = ok ? `Min Value <b>${fmtUSDs(p.minCard)}</b> · Max Pull <b>${fmtUSDs(p.maxVal)}</b>` : '<b class="na-t">Needs inventory</b>'; });
}
function renderHero() {
  const hi = PACKS.map((q, i) => [q, i]).filter(([q]) => q.pool && packOk(q)).pop(); if (!hi) return; // featured = the highest pack the real inventory supports
  const [p, hiIdx] = hi, top = p.pool.all.cs.slice().sort((a, b) => b.value - a.value).slice(0, 3);
  $('#hero').innerHTML = `<div class="hero-card pack-tier-${p.base}"><div class="hero-bg"></div><div class="hero-glow"></div>
    <div class="hero-pack"><div class="hp-float"><div class="pack mini pack-tier-${p.base} cat-${p.cat}">${artHTML(p)}<div class="sheen hero-sheen"></div></div></div></div>
    <div class="hero-txt"><span class="hero-tag">★ FEATURED DROP</span><b class="hero-name">${CAT_BY[p.cat].name} ${p.name}</b>
      <div class="hero-hits">${top.map(c => `<div class="hh${gcls(c)}"><img src="${c.img}" alt="${c.name}" loading="lazy" decoding="async"></div>`).join('')}<span>Top hit<b>${fmtUSDs(top[0].value)}</b></span></div>
      <button class="hero-cta" id="heroCta">Rip for ${fmtUSDs(p.price)} ›</button></div></div>`;
  $('#heroCta').onclick = () => { snapTo(hiIdx); setTimeout(() => $('#packInfo').scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' }), 380); buzz(8); };
}
function measureRail() { railHalf = rail.clientWidth / 2; slideCenters = slides.map(s => s.el.offsetLeft + s.el.offsetWidth / 2); }
let tiltX = 0, tiltY = 0, tiltTX = 0, tiltTY = 0;
function updateRail() {
  railRAF = 0;
  const sl = rail.scrollLeft, w = HOME2 ? H2_SLIDE : 190;
  let best = 0, bestD = 1e9;
  slides.forEach((s, i) => {
    const o = (slideCenters[i] - sl - railHalf) / w, a = Math.min(Math.abs(o), 2);
    if (Math.abs(o) < bestD) { bestD = Math.abs(o); best = i; }
    const c = a < .5 ? 1 - a * 2 : 0;
    const rx = tiltX * c, ry = -o * 32 + tiltY * c;
    if (HOME2 && s.art && s.p && pack3d(s.p)) { const M = pack3d(s.p), sg = o < 0 ? 1 : -1, k = Math.abs(o) < .3 ? 't0' : Math.abs(o) < .85 && (M.tear || []).includes(15 * sg) ? 't' + 15 * sg : M.angles.includes(30 * sg) ? 'y' + 30 * sg : 't0';
      if (k !== s.yk) { s.yk = k; s.art.style.backgroundImage = `url(${pack3dImg(s.p, k)})`; } }
    if (HOME2) { s.tilt.style.transform = `translate3d(${-o * H2_PULL}px,${a * 10}px,${-a * 60}px) scale(${H2_S * (1 - a * .25)})`; s.tilt.style.opacity = 1 - Math.min(a, 1) * .2 - Math.max(0, a - 1) * .5; } // video study: sides ~0.75, pushed back in Z, ~80% brightness (opacity over the dark bg) // v0.9.15 Triumph-style flat scale: centre 100%, neighbours ~72%
    else { s.tilt.style.transform = `translate3d(${-o * 18}px,${a * 22}px,${-a * 120}px) rotateY(${ry}deg) rotateX(${rx}deg) scale(${1 - a * .12})`;
    s.tilt.style.opacity = 1 - a * .38; }
    s.foil.style.transform = `translate3d(${(o * -45) + tiltY * 2.2}%,${tiltX * 1.5}%,0)`;
    s.sheen.style.transform = `translate3d(${o * -120 + tiltY * 6}%,0,0)`;
  });
  if (best !== centerIdx || !slides[best].el.classList.contains('center')) {
    centerIdx = best;
    slides.forEach((s, i) => s.el.classList.toggle('center', i === best));
    $$('#packDots i').forEach((d, i) => d.classList.toggle('on', i === best));
    renderPackInfo();
    buzz(6);
  }
  // ease tilt toward target (pointer / gyro)
  tiltX += (tiltTX - tiltX) * .15; tiltY += (tiltTY - tiltY) * .15;
  if (Math.abs(tiltTX - tiltX) > .05 || Math.abs(tiltTY - tiltY) > .05) schedRail();
}
function schedRail() { if (!railRAF) railRAF = requestAnimationFrame(updateRail); }
rail.addEventListener('scroll', schedRail, { passive: true });
/* v0.9.23 idle spin: the centred Pokémon pack plays its 360° spin ~0.7 s after it settles, then again ~4.7 s after the previous one started while it stays centred.
   The clip is an ANIMATED WEBP (img/spin/pkm-<price>.webp, 150 frames @60fps, plays once) with a lossless alpha plane and the pack silhouette forced fully opaque
   in every frame (scripts/solid_spin.py). No <video>: Android WebView's VP9-alpha and MP4+blend paths were what let you see into the pack.
   Each play uses a fresh blob: URL so the animation always starts at frame 0. The still hides only after the clip has decoded; any scroll/drag cancels. Off under reduced motion. */
var H2Spin = window.H2Spin = (() => { let t = 0, v = null, art = null, last = -1, fails = 0, off = false; const BLOB = {}, DUR = 2400, FIRST = 700, AGAIN = 2000; // start-to-start ~4.7 s (2.4 s spin + hand-back + 2 s rest)
  const blobFor = k => BLOB[k] || (BLOB[k] = fetch(`img/spin/${k}.webp`).then(r => { if (!r.ok) throw 0; return r.blob(); }));
  function stop() { clearTimeout(t); t = 0; if (v) { const vv = v, aa = art; v = null; art = null; aa && (aa.style.opacity = ''); requestAnimationFrame(() => requestAnimationFrame(() => { vv.classList.remove('on'); setTimeout(() => { URL.revokeObjectURL(vv.src); vv.remove(); }, 160); })); } }
  function arm() { stop(); if (true /* v0.11.1: idle pack spin removed (Ricky: nothing moves at rest) */ || !HOME2 || reduceMotion || busy || off) return; const i = centerIdx, p = PACKS[i]; if (!p || p.cat !== 'pkm') return; if (!pack3d(p) || !slides[i]) { t = setTimeout(arm, 400); return; }
    const k = pack3dKey(p); blobFor(k).catch(() => {}); // start fetching now so the first spin is ready on time
    t = setTimeout(async () => { const s = slides[i]; if (!s || centerIdx !== i || !$('#view-shop').classList.contains('active') || document.hidden || busy) return;
      const a = s.art || $('.art', s.el); if (!a) return; let b; try { b = await blobFor(k); } catch { fails++; if (fails >= 2) off = true; return; }
      if (centerIdx !== i || v) return; const im = new Image(); im.className = 'h2-spin alpha'; im.alt = ''; im.decoding = 'sync'; im.src = URL.createObjectURL(b);
      try { await im.decode(); } catch { URL.revokeObjectURL(im.src); fails++; if (fails >= 2) off = true; return; }
      if (centerIdx !== i || busy) { URL.revokeObjectURL(im.src); return; }
      v = im; art = a; a.parentElement.append(im); const me = im;
      requestAnimationFrame(() => requestAnimationFrame(() => { if (v !== me) return; me.classList.add('on'); setTimeout(() => { if (v === me && art) art.style.opacity = '0'; }, 140); }));
      t = setTimeout(() => { if (v === me) { last = i; stop(); arm(); } }, DUR + 120); }, last === i ? AGAIN : FIRST); }
  let drag = false; rail.addEventListener('scroll', () => drag ? stop() : arm(), { passive: true }); rail.addEventListener('pointerdown', () => { drag = true; stop(); }, { passive: true }); addEventListener('pointerup', () => { if (drag) { drag = false; arm(); } }, { passive: true }); document.addEventListener('visibilitychange', () => document.hidden && stop());
  window.__spinAlpha = 'webp';
  return { arm, stop }; })();
addEventListener('resize', () => { measureRail(); schedRail(); });
// pointer tilt / mouse drag with momentum (touch uses native momentum scrolling)
let drag = null;
rail.addEventListener('pointerdown', e => {
  drag = { x: e.clientX, y: e.clientY, sl: rail.scrollLeft, t: performance.now(), v: 0, moved: false, type: e.pointerType, lx: e.clientX, lt: performance.now() };
  if (e.pointerType === 'mouse') { rail.style.scrollSnapType = 'none'; rail.setPointerCapture(e.pointerId); }
});
rail.addEventListener('pointermove', e => {
  const r = rail.getBoundingClientRect();
  if (!drag || drag.type !== 'mouse') { tiltTX = ((e.clientY - r.top) / r.height - .5) * -16; tiltTY = ((e.clientX - r.left) / r.width - .5) * 22; schedRail(); }
  if (!drag) return;
  const dx = e.clientX - drag.x; if (Math.abs(dx) > 4) drag.moved = true;
  if (drag.type === 'mouse') {
    const now = performance.now(); drag.v = .8 * drag.v + .2 * ((e.clientX - drag.lx) / Math.max(1, now - drag.lt)); drag.lx = e.clientX; drag.lt = now;
    rail.scrollLeft = drag.sl - dx;
  }
});
const endDrag = e => {
  if (!drag) return;
  const d = drag; drag = null; tiltTX = tiltTY = 0; schedRail();
  if (d.type === 'mouse') {
    let v = -d.v * 16; // px per frame
    const fling = () => {
      if (Math.abs(v) < .6) { rail.style.scrollSnapType = ''; snapTo(nearestIdx()); return; }
      rail.scrollLeft += v; v *= .93; requestAnimationFrame(fling);
    };
    requestAnimationFrame(fling);
  }
  if (!d.moved && e.type === 'pointerup') {
    const s = e.target.closest('.slide'); if (!s) return;
    const i = +s.dataset.i; i === centerIdx ? buyPack() : snapTo(i);
  }
};
rail.addEventListener('pointerup', endDrag); rail.addEventListener('pointercancel', endDrag);
rail.addEventListener('pointerleave', () => { if (!drag) { tiltTX = tiltTY = 0; schedRail(); } });
function nearestIdx() { const sl = rail.scrollLeft; let b = 0; slideCenters.forEach((c, i) => { if (Math.abs(c - sl - railHalf) < Math.abs(slideCenters[b] - sl - railHalf)) b = i; }); return b; }
function snapTo(i) { rail.scrollTo({ left: slideCenters[i] - railHalf, behavior: reduceMotion ? 'auto' : 'smooth' }); }
// gyro parallax for the centered pack (where permitted)
addEventListener('deviceorientation', e => { if (e.gamma == null) return; tiltTY = Math.max(-12, Math.min(12, e.gamma / 3)); tiltTX = Math.max(-10, Math.min(10, (e.beta - 45) / -4)); schedRail(); }, { passive: true });

const rngTxt = t => `${fmtUSDs(sig2(t[0]))}–${fmtUSDs(sig2(t[1]))}`;
function riskChips(p) {
  return riskChips0(p).replace(/<button class="rk ([^"]*)"([^>]*data-risk="(\w+)")/g, (x, cl, rest, m) => `<button class="rk ${cl}${modeOk(p, m) ? '' : ' off'}"${rest}`);
}
function riskChips0(p) {
  return `<div class="risk" role="radiogroup" aria-label="Value spread">${RISK_IDS.map(m => { const R = RISK[m], t = _typCache[p.id + ':' + m];
    return `<button class="rk rk-${m === '5050' ? 'ff' : m}${m === S.risk ? ' on' : ''}" role="radio" aria-checked="${m === S.risk}" data-risk="${m}"><span class="rk-ico">${R.ico}</span><b>${R.label}</b><small data-rr="${m}">${!modeOk(p, m) ? 'n/a' : t ? rngTxt(t) : '…'}</small></button>`; }).join('')}</div>`;
}
function riskDetail(p) {
  const m = S.risk, R = RISK[m];
  if (m === '5050' || m === 'max') { const D = dist(p, m), hi = D.hi, lo = D.lo;
    const head = m === '5050' ? `<span class="ffm gold">Gold ${pct(D.q)} ~${fmtUSDs(hi.ev)}</span> / <span class="ffm silver">Silver ${pct(1 - D.q)} ~${fmtUSDs(lo.ev)}</span> · ${Math.round(FIFTY_RTP() * 100)}% payback`
      : `Grail or base: ${pct(D.q)} GOLD card (≥ ${CONFIG.BANDS[5]}× price) · ${pct(1 - D.q)} lower-value card (~${CONFIG.MAX.LOSS_X}×, under the price${p.minCard ? `, ≥ ${fmtUSDs(p.minCard)} floor` : ''}) · ${Math.round(CONFIG.RTP * 100)}% payback`;
    return `<div class="rk-detail ff"><div class="rk-desc">${head}</div><div class="ff-split">
      <div class="ff-side hit${m === '5050' ? ' ffg' : ''}"><small>${D.hiLabel} · ${pct(D.q)}</small><b>${fmtUSDs(compMin(hi))} – ${fmtUSDs(compMax(hi))}</b><em>avg ${fmtUSDs(hi.ev)} · ${(hi.ev / p.price).toFixed(1)}× price</em></div>
      <div class="ff-side miss${m === '5050' ? ' ffs' : ''}"><small>${D.loLabel} · ${pct(1 - D.q)}</small><b>${fmtUSDs(compMin(lo))} – ${fmtUSDs(compMax(lo))}</b><em>avg ${fmtUSDs(lo.ev)} · ${m === '5050' ? 'no floor' : p.minCard ? 'floor holds' : 'no floor on this pack'}</em></div></div></div>`; }
  return `<div class="rk-detail"><div class="rk-desc">${R.desc}</div><div class="rk-facts"><span>≥ price <b>${pct(atOrAbove(p, m))}</b></span><span>2×+ hit <b>${pct(chaseP(p, m))}</b></span><span>Spread <b>± ${fmtUSDs(packSD(p, m))}</b></span><span>EV <b>${Math.round(packEV(p, m) / p.price * 100)}%</b></span></div></div>`;
}
const bandRows = p => { const o = oddsFor(p), P = poolFor(p); return bandsFor().filter(b => o[b] > 0).map(b => `<div class="odd b-${b}" data-b="${b}"><span class="rn">${BAND_LABEL[b]}</span><div class="bar"><i style="transform:scaleX(${Math.max(.02, Math.sqrt(o[b]))})"></i></div><span class="pct">${pct(o[b])}</span><small class="was">${fmtUSDs(P[b].min)}${P[b].max > P[b].min ? '–' + fmtUSDs(P[b].max) : ''}</small></div>`).join(''); };
const bandKey = p => S.risk === '5050' ? `<div class="band-key"><span class="b-silver"><i></i>Silver ~${CONFIG.FIFTY.SILVER_X}×</span><span class="b-gold"><i></i>Gold ~${CONFIG.FIFTY.GOLD_X}×</span></div>` : `<div class="band-key">${BAND_IDS.map((b, i) => `<span class="b-${b}"><i></i>${BAND_LABEL[b]} ${i === 0 ? `&lt;${CONFIG.BANDS[1]}×` : i === 5 ? `≥${CONFIG.BANDS[5]}×` : `${CONFIG.BANDS[i]}–${CONFIG.BANDS[i + 1]}×`}</span>`).join('')}</div>`;
function renderPackInfo() {
  if (!CARDS.length) return;
  const p = PACKS[centerIdx]; if (!p) return;
  if (!packOk(p)) { // the real card data can't support this price point: say so instead of inventing prices
    $('#packInfo').innerHTML = `<div class="pi-top"><div><div class="pi-name">${p.name} Pack</div><div class="pi-sub">${CAT_BY[p.cat].ico} ${CAT_BY[p.cat].long}${p.cat !== 'pkm' ? ' <em class="beta">BETA</em>' : ''}</div>${p.cat !== 'pkm' ? '<div class="beta-note">Beta: art and features in progress</div>' : ''}</div>
      <div class="pi-range"><span class="pi-price">${fmtUSD(p.price)}</span>Top card in data<b>${fmt(CARDS.filter(c => c.cat === p.cat).reduce((a, c) => Math.max(a, c.value), 0))}</b></div></div>
      <div class="na-box"><b>Needs higher-value inventory</b><span>${dist(p, 'normal').why}. This pack opens once enough real cards at this price are in stock.</span></div>`;
    $('#buyBar').innerHTML = `<button class="cta cash low" id="buyBtn" disabled>Not available yet · ${fmtUSD(p.price)}</button><div class="ev">No odds are published for this pack until its inventory exists.</div>`;
    return;
  }
  if (!modeOk(p, S.risk)) { const why = dist(p, S.risk).why;
    $('#packInfo').innerHTML = `<div class="pi-top"><div><div class="pi-name">${p.name} Pack</div><div class="pi-sub">${CAT_BY[p.cat].ico} ${CAT_BY[p.cat].long}</div><button class="odds-link" id="oddsLink">ⓘ Odds &amp; Rules</button></div>
      <div class="pi-range"><span class="pi-price">${fmtUSD(p.price)}</span>Spread<b>${RISK[S.risk].label}</b></div></div>
      <div class="risk-h"><span>Risk</span><small>pick an available option</small></div>${riskChips(p)}
      <div class="na-box"><b>${RISK[S.risk].label} isn't available on this pack</b><span>${why}.</span></div>`;
    $('#buyBar').innerHTML = `<button class="cta cash low" id="buyBtn" disabled>${RISK[S.risk].label} not available · ${fmtUSD(p.price)}</button><div class="ev">Choose Normal or another available risk option.</div>`;
    $('#oddsLink').onclick = () => { S.risk = 'normal'; save(); renderPackInfo(); showOdds(p); };
    $$('#packInfo [data-risk]').forEach(b => b.onclick = () => { S.risk = b.dataset.risk; save(); buzz(8); renderPackInfo(); });
    return;
  }
  const [mn, mx] = packRange(p), ev = packEV(p), fl = packFloor(p), D = dist(p);
  const price = p.price, can = spendable() + 1e-9 >= price;
  const chase = [...new Set(D.cs.filter((c, i) => D.pr[i] > 1e-12))].sort((a, b) => b.value - a.value).slice(0, 4);
  $('#packInfo').innerHTML = `
    <div class="pi-top"><div><div class="pi-name">${p.name} Pack</div><div class="pi-sub">${CAT_BY[p.cat].ico} ${CAT_BY[p.cat].long}${p.cat !== 'pkm' ? ' <em class="beta">BETA</em>' : ''}</div>${p.cat !== 'pkm' ? '<div class="beta-note">Beta: art and features in progress</div>' : ''}<button class="odds-link" id="oddsLink">ⓘ Odds &amp; Rules</button></div>
      <div class="pi-range"><span class="pi-price">${fmtUSD(price)}</span>Card value range<b>${fmt(mn)} – ${fmt(mx)}</b></div></div>
    <div class="risk-h"><span>Risk</span><small>typical card value · Payback ${Math.round(CONFIG.RTP * 100)}% (50/50: ${Math.round(FIFTY_RTP() * 100)}%)</small></div>
    ${riskChips(p)}
    ${riskDetail(p)}
    <div class="pi-stats"><div class="ps floor"><small>Guaranteed floor</small><b>${fl ? fmt(fl) : 'None'}</b><em>${fl ? 'min card · ' + Math.round(fl / p.price * 100) + '% of price' : S.risk === '5050' ? 'not in 50/50 mode' : 'no floor on this pack'}</em></div>
      <div class="ps typ"><small>Typical card (90%)</small><b id="piTyp">${typHTML(p)}</b><em>market value · 5th–95th pct</em></div>
      <div class="ps top"><small>Top card</small><b>${fmtUSDs(mx)}</b><em id="piLeg">${S.risk === '5050' ? `${pct(dist(p, '5050').q)} chance of Gold (1.8–2.2×)` : `${pct(chaseP(p))} chance of a ${CHASE_X}×+ card`}</em></div></div>
    <div class="mode-odds cash"><span class="std">USD</span><span>Expected card value ${Math.round(rtpFor(S.risk) * 100)}% of price (market) · instant buyback ${BBP()} of market</span></div>
    <div class="odds bands">${bandRows(p)}</div>
    <div class="chase"><span class="lbl">TOP CARDS</span>${chase.map(c => `<div class="cc${gcls(c)}"><img src="${c.img}" alt="${c.name}" loading="lazy" decoding="async">${slabTop(c)}<span>${fmtUSDs(c.value)}</span></div>`).join('')}</div>
    `;
  const free = freeN(p) > 0, rk = S.risk === 'normal' ? '' : ` · ${RISK[S.risk].label}`;
  $('#buyBar').innerHTML = free ? `<button class="cta free" id="buyBtn">🎁 Open FREE ${p.name} pack${rk}<small>${freeN(p)} free · then ${fmtUSD(price)}</small></button>
    <div class="ev">Free pack from rewards/referrals · EV ${fmt(ev)} market value · buyback ${BBP()}</div>` : `<button class="cta cash ${can ? '' : 'low'}" id="buyBtn">${can ? (HOME2 ? `Buy for ${fmtPrice(price)}` : `Rip for ${fmtUSD(price)}${rk}`) : `＋ Add funds · rip for ${fmtPrice(price)}`}</button>
    <div class="ev">EV ${fmt(ev)} · ${Math.round(ev / p.price * 100)}% of price in market value · buyback ${BBP()} = ${fmt(ev * CONFIG.BUYBACK)}</div>`;
  if (Tut.trialPending()) { const n = Tut.trialN + 1;
    $('#buyBar').innerHTML = `<button class="cta trial" id="buyBtn">🎁 Free practice rip ${n} of 3<small>Demo · nothing charged or credited</small></button>
      <div class="ev">Practice rips are scripted showcases with bigger-than-usual hits. Real packs use the published odds.</div>`; }
  $('#buyBtn').onclick = buyPack; $('#oddsLink').onclick = () => showOdds(p);
  $$('#packInfo [data-risk]').forEach(b => b.onclick = () => { if (S.risk === b.dataset.risk) return; S.risk = b.dataset.risk; save(); buzz(8); renderPackInfo();
    const on = $('#packInfo .rk.on'); on && anim(on, [{ transform: 'scale(.92)' }, { transform: 'scale(1.06)' }, { transform: 'none' }], { duration: 260, fill: 'none' }); });
  RISK_IDS.filter(m => modeOk(p, m)).forEach(m => typicalRangeAsync(p, m, t => { const e = $(`#packInfo [data-rr="${m}"]`); if (e && PACKS[centerIdx] === p) e.textContent = rngTxt(t); }));
}
const sig2 = v => { if (v <= 0) return 0; const m = Math.pow(10, Math.floor(Math.log10(v)) - 1); return Math.round(v / m) * m; }; // 2 significant figures: hides Monte-Carlo jitter
const idle = window.requestIdleCallback ? f => requestIdleCallback(f, { timeout: 400 }) : f => setTimeout(f, 60);
function typHTML(p) {
  const c = _typCache[p.id + ':' + S.risk];
  if (c) return rngTxt(c);
  const m = S.risk; typicalRangeAsync(p, m, () => { const e = $('#piTyp'); if (e && PACKS[centerIdx] === p && S.risk === m) { e.textContent = typHTML(p); e.style.opacity = 1; } });
  return '…';
}
function warmTypical() { const jobs = PACKS.filter(q => modeOk(q, S.risk)); let i = 0; const next = () => { if (i < jobs.length) typicalRangeAsync(jobs[i++], S.risk, () => idle(next)); }; idle(next); }
const pct = x => x > 0 && x < .0001 ? '<0.01%' : x >= .1 ? (x * 100).toFixed(0) + '%' : x >= .01 ? (x * 100).toFixed(1) + '%' : (x * 100).toFixed(2) + '%';

/* ---------- particles (canvas) ---------- */
const FX = (() => {
  const cv = $('#fx'), ctx = cv.getContext('2d'); let P = [], raf = 0, dpr = 1, W = 0, H = 0, host = null;
  function size() { dpr = 1; /* 1x canvas: particles are soft dots anyway, 4x fewer pixels per frame */ W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  // canvas lives in the stage; move to body-level overlay for shop bursts
  function ensureHost() { if (!$('#stage').classList.contains('open')) { if (!host) { host = document.createElement('canvas'); host.className = 'fx'; host.style.cssText = 'position:fixed;inset:0;z-index:70;pointer-events:none'; document.body.appendChild(host); } return host; } return cv; }
  let cur = cv, cctx = ctx;
  function use(c) { if (c !== cur) { cur = c; cctx = c.getContext('2d'); } if (c.width !== Math.round(innerWidth * dpr)) { c.width = innerWidth * dpr; c.height = innerHeight * dpr; } cctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  const SPR = {};
  function sprite(c) { // pre-rendered glowing dot per color (drawImage is far cheaper than arc + shadowBlur)
    if (SPR[c]) return SPR[c];
    const k = document.createElement('canvas'); k.width = k.height = 32; const g = k.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, '#fff'); gr.addColorStop(.25, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return SPR[c] = k;
  }
  const STR = {};
  function star(c) { // pre-rendered 4-point glitter star per colour
    if (STR[c]) return STR[c];
    const k = document.createElement('canvas'); k.width = k.height = 32; const g = k.getContext('2d');
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 7); gr.addColorStop(0, '#fff'); gr.addColorStop(.4, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(16, 0); g.quadraticCurveTo(17.5, 14.5, 32, 16); g.quadraticCurveTo(17.5, 17.5, 16, 32); g.quadraticCurveTo(14.5, 17.5, 0, 16); g.quadraticCurveTo(14.5, 14.5, 16, 0); g.fill();
    return STR[c] = k;
  }
  size(); addEventListener('resize', size);
  function loop() {
    cctx.clearRect(0, 0, W, H);
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i]; p.life -= 1 / 60 * p.decay;
      if (p.life <= 0) { P[i] = P[P.length - 1]; P.pop(); continue; }
      if (p.kind === 2) { // homing coin: arc from card to wallet
        p.t += p.dt; if (p.t >= 1) { P[i] = P[P.length - 1]; P.pop(); continue; }
        const e = p.t < .5 ? 2 * p.t * p.t : 1 - Math.pow(-2 * p.t + 2, 2) / 2;
        p.x = p.x0 + (p.x1 - p.x0) * e + Math.sin(p.t * Math.PI) * p.sw; p.y = p.y0 + (p.y1 - p.y0) * e - Math.sin(p.t * Math.PI) * p.arc; p.life = 1;
      } else {
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr; }
      cctx.globalAlpha = Math.min(1, p.life * 1.6);
      cctx.fillStyle = p.c;
      if (p.kind === 0) { const r = p.r * (0.5 + p.life * .5) * 2.2; cctx.drawImage(sprite(p.c), p.x - r, p.y - r, r * 2, r * 2); }
      else if (p.kind === 3) { p.ph += p.tw; const k = .35 + .65 * Math.abs(Math.sin(p.ph)), r = p.r * k * 2.4; cctx.globalAlpha = Math.min(1, p.life * 1.4) * k; cctx.drawImage(star(p.c), p.x - r, p.y - r, r * 2, r * 2); }
      else { const c = Math.cos(p.rot), s = Math.sin(p.rot); cctx.setTransform(c * dpr, s * dpr, -s * dpr, c * dpr, p.x * dpr, p.y * dpr); cctx.fillRect(-p.r, -p.r * .45, p.r * 2, p.r * .9); cctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    }
    cctx.globalAlpha = 1;
    raf = P.length ? requestAnimationFrame(loop) : (cctx.clearRect(0, 0, W, H), 0);
  }
  function add(p) { if (P.length < 600) P.push(p); if (!raf) raf = requestAnimationFrame(loop); }
  return {
    reset() { P = []; },
    sparks(x, y, n, colors, dir = 0) { return; // v0.9.12 matte pass: no light-streak sparks
      use(ensureHost());
      for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (rnd() - .5) * 2.4 + dir * .6, s = 2 + rnd() * 5;
        add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: .22, drag: .97, r: 1.2 + rnd() * 2.2, life: 1, decay: 1.6 + rnd(), c: colors[i % colors.length], kind: 0, rot: 0, vr: 0 }); }
    },
    burst(x, y, n, colors, power = 1) {
      use(ensureHost());
      for (let i = 0; i < n; i++) { const a = rnd() * 6.283, s = (2 + rnd() * 9) * power;
        add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, g: .16, drag: .965, r: 2 + rnd() * 4, life: 1, decay: .7 + rnd() * .6, c: colors[i % colors.length], kind: i % 3 ? 1 : 0, rot: rnd() * 6, vr: (rnd() - .5) * .4 }); }
    },
    fly(x0, y0, x1, y1, n, color) {
      use(ensureHost());
      for (let i = 0; i < n; i++) add({ x: x0, y: y0, x0: x0 + (rnd() - .5) * 40, y0: y0 + (rnd() - .5) * 50, x1, y1, t: -i * .045, dt: 1 / (38 + rnd() * 10), arc: 60 + rnd() * 90, sw: (rnd() - .5) * 80, r: 2.6 + rnd() * 1.6, life: 1, decay: 0, c: color, kind: 2, rot: 0, vr: 0, g: 0, drag: 1, vx: 0, vy: 0 });
    },
    glitter(x, y, n, colors, spread = 1) { return; // v0.9.12 matte pass: no twinkle/glint stars
      use(ensureHost());
      for (let i = 0; i < n; i++) { const a = rnd() * 6.283, s = (1 + rnd() * 4.5) * spread;
        add({ x: x + (rnd() - .5) * 60, y: y + (rnd() - .5) * 90, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, g: .03, drag: .94, r: 2.5 + rnd() * 3.5, life: 1, decay: .45 + rnd() * .45, c: colors[i % colors.length], kind: 3, rot: 0, vr: 0, ph: rnd() * 6, tw: .15 + rnd() * .25 }); }
    },
    rise(x, y, w, n, color) { // suspense motes drifting up
      use(ensureHost());
      for (let i = 0; i < n; i++) add({ x: x + (rnd() - .5) * w, y: y + (rnd() - .5) * 60, vx: (rnd() - .5) * .6, vy: -1 - rnd() * 2.2, g: -.01, drag: .995, r: 1 + rnd() * 2.2, life: 1, decay: .8 + rnd() * .6, c: color, kind: 0, rot: 0, vr: 0 });
    },
  };
})();

/* ---------- WAAPI helper ---------- */
const anim = (el, kf, o) => el.animate(kf, Object.assign({ fill: 'forwards', easing: 'cubic-bezier(.2,.8,.2,1)' }, o)).finished.catch(() => {});
const wait = ms => new Promise(r => setTimeout(r, ms));

/* ---------- buying ---------- */
let busy = false;
/* ---------- v0.9.15 Home v2: pack grid + pack detail sheet (odds, value range, risk, live feed live here, shown before purchase) ---------- */
/* v0.9.16: 'More' tab removed; the profile avatar (top-left) opens the same menu as a slide-in drawer. Phone/browser back closes it. */
var HOME2_NAV = false;
function drawer(on) { const d = $('#view-more'), r = document.documentElement; if (!d || r.classList.contains('drawer-open') === on) return;
  r.classList.toggle('drawer-open', on); d.setAttribute('aria-hidden', String(!on)); try { renderProfileEntry(); } catch (_) {} h2Avatar();
  if (on) { history.pushState({ rzDrawer: 1 }, ''); d.scrollTop = 0; } else if (history.state?.rzDrawer) history.back(); }
addEventListener('popstate', () => { if (document.documentElement.classList.contains('drawer-open')) { document.documentElement.classList.remove('drawer-open'); } });
function h2Avatar() { const a = $('#h2Av'); if (!a) return; let p = null; try { p = UserService.getProfile(); } catch (_) {} const n = (p?.username || '').replace(/[^A-Za-z0-9]/g, '');
  a.innerHTML = n ? `<b>${n.slice(0, 2).toUpperCase()}</b>` : '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="12" cy="8.5" r="4"/><path d="M4 20.5c0-4.2 3.6-6.5 8-6.5s8 2.3 8 6.5z"/></svg>'; }
const HOME2 = CONFIG.HOME_V2 && !/[?&]home=old/.test(location.search); let H2_SLIDE = 250, H2_PULL = 52, H2_S = 1;
function h2Layout(force) { // v0.9.15c: the carousel takes the leftover height; the centre pack scales to fill it (Triumph size), sides ~75% with ~20% visible at the edges
  if (!HOME2) return; const wrap = $('#view-shop .carousel-wrap'); if (!wrap || !wrap.clientHeight) return;
  const W = rail.clientWidth || innerWidth, Hh = wrap.clientHeight; if (force !== true && h2Layout.k === W + 'x' + Hh) return; h2Layout.k = W + 'x' + Hh;
  H2_S = Math.max(.6, Math.min(Hh * .9 / 272, W * .64 / 172)); const pw = 172 * H2_S;
  H2_SLIDE = Math.round(W * .62); H2_PULL = H2_SLIDE - (W / 2 + .3 * .75 * pw);
  rail.style.setProperty('--h2slide', H2_SLIDE + 'px'); measureRail(); const i = Math.max(0, centerIdx); if (slideCenters[i] != null) rail.scrollLeft = slideCenters[i] - railHalf; updateRail();
}
if (HOME2) document.documentElement.classList.add('home2');

function h2Sync() { setTimeout(() => window.H2Spin?.arm(), 0); // home v2 (Triumph-style): name, 'What's inside', Min Value | MAX PULL | Pack style, Buy for $X
  const p = PACKS[centerIdx]; if (!p || !HOME2) return; const ok = !!p.pool && modeOk(p, S.risk), D = ok ? dist(p, S.risk) : null, el = $('#h2Info'); if (!el) return;
  document.documentElement.classList.toggle('h2-glow', !!CONFIG.HOME_GLOW && p.price >= 100); document.documentElement.style.setProperty('--h2g', `var(--tier-${p.base}, #5ff3ff)`);
  el.innerHTML = `<div class="h2-name">${p.name} Pack${p.cat !== 'pkm' ? ' <em class="beta">BETA</em>' : ''}</div>
    <div class="h2-pills"><button class="h2-inside" id="h2Inside" aria-label="What's inside: browse the cards in this pack"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 5C6.5 5 2.7 9.3 1.5 12c1.2 2.7 5 7 10.5 7s9.3-4.3 10.5-7C21.3 9.3 17.5 5 12 5zm0 11.5A4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 0 1 0 9zm0-2.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" fill="currentColor"/></svg>What's inside</button><button class="h2-inside h2-oddsp" id="h2Odds" aria-label="Odds and pack style">ⓘ Odds</button></div>
    ${p.cat !== 'pkm' ? '<div class="h2-beta">Beta: art and features in progress</div>' : ''}
    <div class="h2-stats"><div class="h2-s"><small>Min Value</small><b>${D ? h2usd(D.min) : '—'}</b></div>
      <div class="h2-s mid"><small>Max Pull</small><b>${D ? h2usd(D.max) : '—'}</b></div>
      <button class="h2-s right" id="h2Style" aria-label="Pack style: ${RISK[S.risk].label}. Change"><small>Pack style</small><b>${RISK[S.risk].label} <i>›</i></b></button></div>`;
  requestAnimationFrame(() => h2Layout()); $('#h2Odds').onclick = openOS; $('#h2Inside').onclick = insideSheet; $('#h2Style').onclick = () => openOS(true); H2Tick.set(p); h2Cat();
}
const h2usd = v => fmtUSDs(v).replace(/\.00$/, ''); // $500 not $500.00 (Triumph style); cents kept when present
function insideSheet() { // every card this pack can pull in the current pack style, high to low, with its band colour tag
  const p = PACKS[centerIdx]; if (!p?.pool || !modeOk(p, S.risk)) return toast('Not available for this pack style'); buzz(6);
  const D = dist(p, S.risk), seen = new Set(), cs = D.cs.filter((c, i) => D.pr[i] > 1e-12 && !seen.has(c.id) && seen.add(c.id)).sort((a, b) => b.value - a.value);
  sheet(`<h3 class="os-h">What's inside</h3><div class="wi-sub">${p.name} Pack · ${RISK[S.risk].label} · ${cs.length} cards · ${fmtUSDs(D.min)} – ${fmtUSDs(D.max)}</div>
    <div class="wi-grid">${cs.map(c => { const b = bandOf(c, p, S.risk); return `<div class="wi-c"><div class="wi-img"><img src="${c.img}" alt="" loading="lazy" decoding="async"></div><i class="wi-tag" style="--bc:${BAND_HEX[b]}">${BAND_LABEL[b]}</i><b>${fmtUSDs(c.value)}</b><small>${xe(c.name)}</small></div>`; }).join('')}</div>
    <button class="cta ghost" id="wiOdds" style="margin-top:12px">See odds</button>`);
  $('#sheetBody').scrollTop = 0; $('#wiOdds').onclick = () => { closeSheet(); openOS(); };
}
function catPicker() { buzz(6); sheet(`<h3 class="os-h">Category</h3><div class="cat-pick">${CATS.map(c => `<button data-pc="${c.id}" class="${c.id === S.cat ? 'on' : ''}"><span>${c.ico}</span>${c.name}${c.id === 'pkm' ? '' : '<em>BETA</em>'}${c.id === S.cat ? '<i>✓</i>' : ''}</button>`).join('')}</div>`);
  $$('#sheetBody [data-pc]').forEach(b => b.onclick = () => { closeSheet(); if (b.dataset.pc !== S.cat) { if (busy) return; setCat(b.dataset.pc); } h2Cat(); }); }
function h2Cat() { const b = $('#h2CatBtn'); if (b) b.innerHTML = `<span class="h2-ci">◎</span>${CAT_BY[S.cat].name}${S.cat === 'pkm' ? '' : ' <em>BETA</em>'}<i>⌄</i>`; }
const H2Tick = (() => { // one line: recent big pulls for the CENTERED pack only (demo feed, simulated like the old live feed)
  const N = ['Kai', 'Mew', 'Neo', 'Pul', 'Hol', 'Zap', 'Lun', 'Sno', 'Gol', 'Rip', 'Vau', 'Cha'];
  let pk = null, timer = 0, el = null;
  function line(p) { const D = p.pool && modeOk(p, 'normal') ? dist(p, 'normal') : null; if (!D) return '';
    const big = D.cs.filter((c, i) => D.pr[i] > 1e-9 && c.value >= 2 * p.price); if (!big.length) return '';
    const c = big[Math.floor(Math.pow(rnd(), 1.4) * big.length)];
    return `<span class="h2-live"><i></i>LIVE</span><span class="h2-tx"><b>${N[Math.floor(rnd() * N.length)]}***</b> pulled <b class="h2-v">${xe(c.name)}</b> <b class="h2-usd">${fmtUSDs(c.value)}</b> <small>· ${1 + Math.floor(rnd() * 30)}m ago</small></span>`; }
  function show() { if (!el || !pk) return; const h = line(pk); if (!h) { el.style.opacity = 0; return; }
    if (reduceMotion || !el.innerHTML) { el.innerHTML = h; el.style.opacity = 1; return; }
    el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate3d(0,-6px,0)' }], { duration: 160, easing: 'ease-in' }).onfinish = () => { el.innerHTML = h; el.style.opacity = 1;
      el.animate([{ opacity: 0, transform: 'translate3d(0,6px,0)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' }); }; }
  return { set(p) { el = $('#h2Tick'); if (pk === p) return; pk = p; show(); clearInterval(timer); timer = setInterval(() => { if (!document.hidden && $('#view-shop').classList.contains('active')) show(); }, 3600); } };
})();
function openOS(toModes) { const o = $('#os'); renderPackInfo(); $('#osScroll').scrollTop = 0; if (toModes === true) requestAnimationFrame(() => { const r = $('#os .risk'); if (r) $('#osScroll').scrollTop = Math.max(0, r.offsetTop - 60); r?.animate([{ opacity: .4 }, { opacity: 1 }], { duration: 500 }); }); o.classList.add('open'); o.setAttribute('aria-hidden', 'false'); buzz(6); }
function closeOS() { const o = $('#os'); if (!o?.classList.contains('open')) return false; o.classList.remove('open'); o.setAttribute('aria-hidden', 'true'); h2Sync(); return true; }
if (HOME2) { addEventListener('resize', () => requestAnimationFrame(h2Layout)); document.body.append($('#os')); const cb = document.createElement('button'); cb.id = 'h2CatBtn'; cb.className = 'h2-cat'; cb.setAttribute('aria-label', 'Choose category'); cb.onclick = catPicker; $('.topbar .brand').after(cb); h2Cat(); const av = document.createElement('button'); av.id = 'h2Av'; av.className = 'h2-av'; av.setAttribute('aria-label', 'Profile and menu'); av.onclick = () => drawer(true); cb.before(av); h2Avatar(); setTimeout(h2Avatar, 0); addEventListener('load', h2Avatar); HOME2_NAV = true; document.documentElement.classList.add('h2-nav'); const dm = $('#view-more'); document.body.append(dm); dm.setAttribute('aria-hidden', 'true'); const bd = document.createElement('div'); bd.className = 'drawer-bd'; bd.onclick = () => drawer(false); document.body.append(bd); dm.querySelector('h2').innerHTML = 'Menu <button class="drawer-x" aria-label="Close menu">✕</button>'; dm.querySelector('.drawer-x').onclick = () => drawer(false); dm.addEventListener('click', e => { if (e.target.closest('button:not([data-nav]):not(.drawer-x)')) return; }, true); $('#osSlot').append($('#packInfo')); const r0 = renderPackInfo; renderPackInfo = function () { r0(); h2Sync(); }; } // odds sheet on top; the pack's full odds/risk panel lives inside it
if (HOME2) { $('#osBack').onclick = closeOS; $('#osX').onclick = closeOS; $('#osDone').onclick = closeOS; }
async function buyPack() { if (HOME2) closeOS(); if (busy) return; if (Tut.trialPending()) return Tut.startTrial(); return startRip(PACKS[centerIdx], false); }
async function startRip(p, again) {
  // v0.11.1: in a Rip Again chain the reveal stage is still open; any early exit must close it so the user never gets stuck on the old card
  const ok = await startRip0(p, again); if (!ok && again && !busy) { REV = null; closeStage(); }
  return ok;
}
async function startRip0(p, again) {
  const free = freeN(p) > 0;
  const price = free ? 0 : p.price;
  if (!modeOk(p, S.risk)) { toast(`${RISK[S.risk].label} isn't available on this pack`); return; }
  if (!RG.allow(price)) return;
  if (!free && spendable() + 1e-9 < price) { Funds.open({ need: r2(price - spendable()), pack: p }); return; }
  if (!(await RZC.prePurchase(p, price, again))) return; // v0.11.0: self-exclusion, geo, 18+ ID, odds + value-range preview, then odds lock
  // roll now; reveal lowest -> highest for a rising climax
  const force = QA && window.__ripzone?.forceTop; // QA hook (screenshots only): force the card's colour band, e.g. 'gold'
  const fc = QA && window.__ripzone?.forceCard && BY_ID[window.__ripzone.forceCard]; // QA hook (screenshots only): put a specific card in the pack
  // v0.10.0: odds are locked at purchase (snapshot audited) and a physical serial is RESERVED before any money moves; if the odds
  // can't be honoured from real stock, the purchase is refused and nothing is charged.
  if (!dist(p, S.risk).ok) { toast('This pack is restocking. Odds can\'t be honoured right now, so you were not charged.'); return; }
  const snap = { ev: r2(dist(p, S.risk).ev), bands: oddsFor(p, S.risk), ranges: RZC.ranges(p, S.risk), floor: packFloor(p, S.risk), max: dist(p, S.risk).max, lockedAt: Date.now() };
  let roll = purchaseRoll(p, S.risk, force), res = RZBackend.purchase({ packId: p.id, mode: S.risk, price, cardId: (fc || roll.card).id, seed: roll.seed, u: roll.u, snapshot: snap, user: S.user?.phone });
  if (!res.ok && BY_ID[(fc || roll.card).id]?.serials) { applyStock(); toast(res.msg || 'Purchase refused'); return; }
  busy = true; S.lastPack = p.id;
  if (free) S.freePacks[freeKey(p)]--; else { payPack(price); addTx('pack', -price, `${CAT_BY[p.cat].name} ${p.name} pack`); }
  RG.spend(price); applyStock();
  // v0.9.11: the outcome is fixed HERE, at purchase, before any animation. One crypto seed -> u in [0,1) -> the card. Every animation after
  // this only reveals the stored result. The card goes straight into the Vault, so closing the app mid-animation never re-rolls or loses it.
  const { seed, u, card } = roll, now = Date.now();
  const pulls = [card].map(c => fc || c).map(c => ({ id: c.id, uid: S.uid++, decided: null, band: bandOf(c, p, S.risk), owned: true })); // exactly one card
  const x0 = pulls[0], c0 = BY_ID[x0.id];
  (S.history = S.history || []).unshift({ id: 'P' + now.toString(36) + '-' + x0.uid, t: now, pack: p.id, cat: p.cat, mode: S.risk, price, free, result: { card: c0.id, name: c0.name, band: x0.band, value: c0.value }, seed, u, qa: !!(force || fc) || undefined });
  S.history.length > 500 && (S.history.length = 500);
  S.coll.push({ uid: x0.uid, id: x0.id, t: vNow(), pulledAt: vNow(), purchase: res.purchaseId || S.history[0].id, serial: res.serial }); S.history[0].serial = res.serial;
  S.stats.opened++; setTimeout(() => Stats.sync(), 0);
  S.pending = { pack: p.id, pulls }; save(); renderWallet(true);
  // pre-decode every image so nothing pops in during the reveal
  await Promise.all(pulls.map(x => { const im = new Image(); im.src = BY_ID[x.id].img; return im.decode().catch(() => {}); }));
  if (again) await ripAgainTransition();
  // v0.9.12 pack picker: purely cosmetic. The card above is already decided and in the Vault; every pack in the ring holds it.
  if (S.picker !== false && !reduceMotion) { const ok = await PackPicker.run(p); if (!ok) { delete S.pending; save(); busy = false; renderWallet(true); renderPackInfo(); toast('Your card is in your Vault'); return; } }
  openStage(p, pulls, !!(S.picker !== false && !reduceMotion));
  return true;
}

/* ---------- v0.9.12 PACK PICKER (Rips-style 3D ring) ----------
   10 identical copies of the purchased pack on a ring. The result is fixed at purchase and already in the Vault, so the pick is cosmetic.
   Motion: velocity from the last ~100ms of pointer samples, exponential friction, then a critically damped spring snap (no tweens).
   Perf: passive listeners, no layout reads while dragging (sizes measured once), every item promoted to its own layer up front, one ring
   transform per frame. Multi-angle renders (img/packs-v2, see scripts/sync_packs_v2.py) crossfade between the two nearest angles per item
   (opacity only); without them the flat brand art is the placeholder. */
let PACK3D = null; // www/img/packs-v2/manifest.json (scripts/sync_packs_v2.py): { "pkm-25": { angles: [-30,-15,0,15,30], back, shop, front } }
const PACK3D_READY = fetch('img/packs-v2/manifest.json').then(r => r.ok ? r.json() : null).then(m => { PACK3D = m || {}; }).catch(() => { PACK3D = {}; });
const pack3dKey = p => `${p.cat}-${p.price}`;
const pack3d = p => PACK3D && PACK3D[pack3dKey(p)];
const pack3dImg = (p, f) => `img/packs-v2/${pack3dKey(p)}/${f}.webp`;
const PackPicker = {
  N: 10,
  run(p) {
    return new Promise(async done => {
      const N = this.N, step = 360 / N, IW = 128, IH = Math.round(IW * PH / PW), RAD = Math.round((IW + 26) / (2 * Math.tan(Math.PI / N)));
      const M = pack3d(p), A = M ? M.angles.slice().sort((x, y) => x - y) : null, SRCS = M ? [...A.map(a => pack3dImg(p, (M.tear || []).includes(a) ? 't' + a : 'y' + a)), ...(M.back ? [pack3dImg(p, 'back')] : [])] : null;
      const face = M ? `<div class="pp-3d">${SRCS.map(src => `<img src="${src}" alt="" draggable="false">`).join('')}</div>`
        : `<div class="pp-sc" style="transform:scale(${IW / PW})"><div class="pack pack-tier-${p.base} cat-${p.cat}" style="--w:250px;--h:417px">${artHTML(p)}</div></div>`;
      const root = document.createElement('div'); root.className = 'pp';
      root.innerHTML = `<div class="pp-top"><b>Pick your pack</b><small>Every pack holds your card. Picking is just for fun.</small></div>
        <div class="pp-scene"><div class="pp-bob"><div class="pp-ring">${Array.from({ length: N }, (_, i) => `<div class="pp-it" data-i="${i}" style="width:${IW}px;height:${IH}px;margin:${-IH / 2}px 0 0 ${-IW / 2}px;transform:rotateY(${i * step}deg) translateZ(${RAD}px) scale(var(--s))">${face}</div>`).join('')}</div></div></div>
        <div class="pp-bot"><button class="cta cash" id="ppPick">Pick this pack</button><small>Your card is determined the moment you purchase; animations do not affect the result.</small></div>`;
      document.body.appendChild(root);
      await Promise.all((M ? SRCS : [p.art]).map(src => { const im = new Image(); im.src = src; return im.decode().catch(() => {}); }));
      const ring = $('.pp-ring', root), scene = $('.pp-scene', root), items = $$('.pp-it', root), bob = $('.pp-bob', root); items[0].classList.add('front');
      const layers = M ? items.map(it => $$('img', it)) : null, shown = M ? items.map(() => ({ key: '' })) : null;
      const W = scene.clientWidth || 360, degPerPx = 200 / W; // measured once: nothing below reads layout
      let snapClicked = false;
      const clack = sp => { SFX.tick(sp); buzz(sp > .5 ? 4 : 2); };
      let ang = 0, vel = 0, drag = false, idle = true, raf = 0, lastFront = 0, closed = false, snap = null, last = performance.now(), moved = 0, lx = 0;
      const samples = []; // [t, angle] from the last pointer moves
      const front = () => ((Math.round(-ang / step) % N) + N) % N;
      const AMAX = A ? A[A.length - 1] : 0, BK = M && M.back ? A.length : -1, YAW = -1; // YAW: sign mapping ring angle -> render yaw
      const setOp = (i, ws) => { const L = layers[i], sh = shown[i], key = ws.map(w => w[0]).join(','); // ws: [[layerIndex, weight]...]
        if (sh.key !== key) { L.forEach(im => { im.style.opacity = 0; }); sh.key = key; } // v0.9.21 solid crossfade: the lower layer stays at 1 and only the upper layer fades in, so the pack is never see-through mid-blend (two 0.5 layers = 75% opaque)
        const o = ws.slice().sort((a, b) => a[0] - b[0]); L[o[0][0]].style.opacity = o.length > 1 ? 1 : o[0][1].toFixed(3); if (o.length > 1) L[o[1][0]].style.opacity = o[1][1].toFixed(3); };
      const views = () => { if (!M) return; // each pack faces the viewer (counter-rotated); the render for its view yaw supplies the depth
        for (let i = 0; i < N; i++) { let v = ((i * step + ang) % 360 + 540) % 360 - 180, y = YAW * v, ay = Math.abs(y), sg = Math.sign(y) || 1;
          if (ay <= AMAX) { let k = A.findIndex(a => a >= y); if (k <= 0) setOp(i, [[Math.max(0, k), 1]]); else { const f = (y - A[k - 1]) / (A[k] - A[k - 1]); setOp(i, [[k - 1, 1 - f], [k, f]]); } }
          else { const edge = sg > 0 ? A.length - 1 : 0; if (BK < 0 || ay <= 75) setOp(i, [[edge, 1]]); else if (ay < 105) { const f = (ay - 75) / 30; setOp(i, [[edge, 1 - f], [BK, f]]); } else setOp(i, [[BK, 1]]); }
          items[i].style.transform = `rotateY(${i * step}deg) translateZ(${RAD}px) rotateY(${(-(i * step + ang)).toFixed(2)}deg) scale(var(--s))`; } }; // face the viewer: the render supplies the angle
      const frame = now => { const dt = Math.min(34, now - last) / 1000; last = now;
        if (!drag) {
          if (idle) { /* v0.11.1: carousel sits completely still at rest; it only moves when the user swipes */ }
          else if (snap == null) { vel *= Math.exp(-2.6 * dt); ang += vel * dt; // natural friction decay (deg/s)
            if (Math.abs(vel) < 40) { snap = Math.round(ang / step) * step; snapClicked = false; } } // hand over to the spring near rest
          if (snap != null) { const k = 90, c = 2 * Math.sqrt(k); vel += (k * (snap - ang) - c * vel) * dt; ang += vel * dt; // critically damped spring
            if (Math.abs(snap - ang) < .02 && Math.abs(vel) < .5) { ang = snap; vel = 0; } }
        }
        ring.style.transform = `translate3d(0,0,${-RAD}px) rotateY(${ang.toFixed(3)}deg)`; views();
        const f = front(); if (f !== lastFront) { items[lastFront].classList.remove('front'); items[f].classList.add('front'); lastFront = f; clack(Math.min(1, Math.abs(vel) / 400 + (drag ? .4 : 0))); }
        if (snap != null && !snapClicked && Math.abs(snap - ang) < .3) { snapClicked = true; clack(.15); }
        if (!closed) raf = requestAnimationFrame(frame); };
      raf = requestAnimationFrame(frame); this.ang = () => ang; if (QA) window.__ripzone_pp = () => ang.toFixed(2); // QA probe (read-only)
      const P = { passive: true };
      scene.addEventListener('pointerdown', e => { if (bob.style.animationName !== 'none') bob.style.animation = 'none'; drag = true; idle = false; snap = null; vel = 0; moved = 0; lx = e.clientX; samples.length = 0; samples.push([e.timeStamp, ang]); try { scene.setPointerCapture(e.pointerId); } catch {} }, P);
      scene.addEventListener('pointermove', e => { if (!drag) return; const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        for (const ev of (evs.length ? evs : [e])) { const dx = ev.clientX - lx; lx = ev.clientX; ang += dx * degPerPx; moved += Math.abs(dx); samples.push([ev.timeStamp, ang]); }
        while (samples.length > 2 && samples[samples.length - 1][0] - samples[0][0] > 100) samples.shift(); }, P);
      const up = e => { if (!drag) return; drag = false; const s0 = samples[0], s1 = samples[samples.length - 1], dt = (s1[0] - s0[0]) / 1000;
        vel = dt > .008 && (e.timeStamp - s1[0]) < 80 ? Math.max(-900, Math.min(900, (s1[1] - s0[1]) / dt)) : 0; // release velocity from the last ~100ms
        if (Math.abs(vel) < 40) { snap = Math.round(ang / step) * step; snapClicked = false; } };
      scene.addEventListener('pointerup', up, P); scene.addEventListener('pointercancel', up, P);
      const pick = async () => { if (closed) return; closed = true; cancelAnimationFrame(raf); buzz(14);
        const fi = front(); ang = -fi * step + Math.round((ang + fi * step) / 360) * 360; ring.style.transform = `translate3d(0,0,${-RAD}px) rotateY(${ang}deg)`; views();
        const sel = items[fi], r = sel.getBoundingClientRect();
        const fly = document.createElement('div'); fly.className = 'pp-fly'; fly.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
        fly.innerHTML = `<div class="pp-sc" style="transform:scale(${r.width / PW})"><div class="pack pack-tier-${p.base} cat-${p.cat}" style="--w:250px;--h:417px">${artHTML(p)}</div></div>`;
        root.appendChild(fly); sel.style.opacity = 0;
        items.forEach(n => n !== sel && anim(n, [{ opacity: 1 }, { opacity: 0 }], { duration: 260 }));
        anim(scene, [{ transform: 'none' }, { transform: 'translate3d(0,0,-400px) scale(.85)' }], { duration: 340, easing: 'cubic-bezier(.4,0,.2,1)' });
        anim($('.pp-top', root), [{ opacity: 1 }, { opacity: 0 }], { duration: 200 }); anim($('.pp-bot', root), [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
        this.root = root; this.fly = fly; done(true); };
      $('#ppPick', root).onclick = pick;
      scene.addEventListener('click', e => { const it = e.target.closest('.pp-it'); if (moved > 8) { moved = 0; return; }
        if (it && +it.dataset.i === front()) pick(); else if (it) { idle = false; vel = 0; let t = -(+it.dataset.i) * step; while (t - ang > 180) t -= 360; while (ang - t > 180) t += 360; snap = t; snapClicked = false; } });
      this.cancel = () => { if (closed) return; closed = true; SFX.suspenseStop(); cancelAnimationFrame(raf); anim(root, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 }).then(() => root.remove()); this.cancel = null; done(false); };
      anim(root, [{ opacity: 0 }, { opacity: 1 }], { duration: 220 }); SFX.suspenseStart();
    });
  },
  handoff(packRoot) { // the tear pack waits invisibly; the flown copy scales onto its exact rect, then the real pack takes over
    const root = this.root, fly = this.fly; this.root = this.fly = null; this.cancel = null; if (!root) return;
    packRoot.style.opacity = 0;
    const r = packRoot.getBoundingClientRect(), f = fly.getBoundingClientRect();
    // v0.9.21 seamless handoff: decode every tear-pack image while the copy flies, show the real pack UNDER the copy, wait until it has painted (2 frames), then fade the copy out (no blink)
    const urls = [...new Set([...packRoot.querySelectorAll('[style*="background-image"]')].map(e => (e.style.backgroundImage.match(/url\(["']?([^"')]+)/) || [])[1]).filter(Boolean))];
    const dec = Promise.all(urls.map(u => { const im = new Image(); im.src = u; return im.decode().catch(() => {}); }));
    const flyA = anim(fly, [{ transform: 'none' }, { transform: `translate3d(${r.left - f.left}px,${r.top - f.top}px,0) scale(${r.width / f.width})` }], { duration: 420, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'forwards' });
    const frames = n => new Promise(r => { const f = () => --n <= 0 ? r() : requestAnimationFrame(f); requestAnimationFrame(f); });
    Promise.all([flyA, dec]).then(async () => { packRoot.style.opacity = ''; document.body.appendChild(fly); fly.style.zIndex = 71; await frames(2); await anim(root, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }); root.remove(); await frames(4); await wait(150); anim(fly, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' }).then(() => fly.remove()); }); // the copy stays opaque on top while the picker veil fades, then dissolves onto the identical tear pack // keep the copy on top until the real pack has painted underneath, then fade only the copy
  },
};
/* ---------- v0.9.12 foil flakes: a few pre-made sprites, WAAPI transform/opacity only ---------- */
const Flakes = { n: 0,
  spawn(x, y, k, dir = 1) { if (reduceMotion) return;
    for (let i = 0; i < k && this.n < 14; i++) { const im = document.createElement('img'); im.src = `img/packs-v2/_flake${(Math.random() * 3) | 0}.webp`; im.className = 'flake'; im.alt = '';
      im.style.left = x + 'px'; im.style.top = y + 'px'; stage.appendChild(im); this.n++;
      const dx = dir * (20 + Math.random() * 70) + (Math.random() - .5) * 40, dy = -(20 + Math.random() * 50), r = (Math.random() - .5) * 720, s = .5 + Math.random() * .6, d = 650 + Math.random() * 450;
      im.animate([{ transform: `translate3d(-50%,-50%,0) scale(${s}) rotate(0deg)`, opacity: 1 }, { transform: `translate3d(${dx * .6}px,${dy}px,0) scale(${s}) rotate(${r * .5}deg)`, opacity: 1, offset: .35 },
        { transform: `translate3d(${dx}px,${dy + 120}px,0) scale(${s * .8}) rotate(${r}deg)`, opacity: 0 }], { duration: d, easing: 'cubic-bezier(.2,.6,.4,1)' }).finished.then(() => { im.remove(); this.n--; }); } } };
/* ---------- RIP STAGE ---------- */
const stage = $('#stage'), ripArea = $('#ripArea');
const N_SLICES = 24, BAND = 14, PW = 250, PH = 417, SW = PW / N_SLICES; // PH: 600x1000 render / 614x1024 art aspect (no stretch)
let STRIP = 49; // tear line (px from the top of the stage box): set per pack in openStage
let R = null; // rip session
function resetStageFx() {
  for (const sel of ['#dim', '#rglow', '.rays', '#flash']) { const el = $(sel); el.getAnimations().forEach(a => a.cancel()); el.style.opacity = 0; }
}
async function ripAgainTransition() { // reveal shrinks away while a fresh pack is prepared
  const rv = $('#reveal');
  await Promise.all([anim(rv, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.86) translate3d(0,40px,0)' }], { duration: 320, easing: 'cubic-bezier(.4,0,.6,1)' }),
    anim($('.rays'), [{ opacity: getComputedStyle($('.rays')).opacity }, { opacity: 0 }], { duration: 300 })]);
  rv.getAnimations().forEach(a => a.cancel());
}
/* ---------- sound (WebAudio, synthesised: no audio assets) ---------- */
const SFX = (() => {
  let ctx = null, noise = null, src = null, gain = null, bp = null;
  function ensure() {
    if (!S.sound) return null;
    if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC();
      const n = Math.floor(ctx.sampleRate * 1.2); noise = ctx.createBuffer(1, n, ctx.sampleRate); const d = noise.getChannelData(0); let l = 0;
      for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; l = .55 * l + .45 * w; d[i] = Math.random() < .015 ? w * 1.6 : l; } } // brown-ish noise with fibre crackles
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  function burst(dur, f0, f1, g0, type = 'bandpass', q = 1.2) { if (S.fx === false) return;
    const c = ensure(); if (!c) return; const t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noise; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    g.gain.setValueAtTime(g0, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    s.connect(f).connect(g).connect((out(), master)); s.start(t, Math.random() * .8, dur + .05);
  }
  function stop() { if (gain && ctx) { gain.gain.setTargetAtTime(0, ctx.currentTime, .09); const s = src; setTimeout(() => { try { s.stop(); } catch {} }, 600); } src = gain = bp = null; }
  // v0.9.12 rendered audio (scripts/make_audio.py: procedural synthesis, no samples). Decoded once into AudioBuffers; one master gain.
  const FILES = ['suspense_loop', 'tick', 'stinger_soft', 'stinger_mid', 'stinger_red', 'stinger_gold'], BUF = {};
  let master = null, loading = null, bed = null, tapNode = null; // bed = { src, lp, g }
  function out() { const c = ensure(); if (!c) return null; if (!master) { // master -6 dB -> soft compressor -> brick-wall-ish limiter
      master = c.createGain(); master.gain.value = .5; const cp = c.createDynamicsCompressor(); cp.threshold.value = -20; cp.knee.value = 24; cp.ratio.value = 3; cp.attack.value = .012; cp.release.value = .28;
      const lim = c.createDynamicsCompressor(); lim.threshold.value = -4; lim.knee.value = 2; lim.ratio.value = 20; lim.attack.value = .002; lim.release.value = .12; master.connect(cp).connect(lim).connect(c.destination); tapNode = lim; } return c; }
  const EQP = (n, up) => { const a = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1); a[i] = up ? Math.sin(x * Math.PI / 2) : Math.cos(x * Math.PI / 2); } return a; }; // equal-power curves
  function fade(param, from, to, t, dur) { param.cancelScheduledValues(t); const k = EQP(64, to > from); param.setValueCurveAtTime(k.map(v => to > from ? from + (to - from) * v : to + (from - to) * v), t, dur); }
  function load() { const c = out(); if (!c || loading) return loading; return loading = Promise.all(FILES.map(f => fetch(`audio/${f}.ogg`).then(r => r.arrayBuffer()).then(b => c.decodeAudioData(b)).then(d => { BUF[f] = d; }).catch(() => {}))); }
  function play(name, vol = 1, when = 0, att = 0) { const c = out(); if (!c || !BUF[name] || S.fx === false) return null; const s = c.createBufferSource(), g = c.createGain(); s.buffer = BUF[name]; if (att) { g.gain.value = 0; fade(g.gain, 0, vol, c.currentTime + when, att); } else g.gain.value = vol; s.connect(g).connect(master); s.start(c.currentTime + when); return s; }
  const STING = { silver: 'stinger_soft', grey: 'stinger_soft', green: 'stinger_soft', blue: 'stinger_mid', purple: 'stinger_mid', red: 'stinger_red', gold: 'stinger_gold' };
  return {
    unlock() { ensure(); load(); },
    load,
    tick(speed = 1) { const sn = play('tick', .1 + .16 * Math.min(1, speed), 0, .004); if (sn) sn.playbackRate.value = .9 + Math.random() * .18 + .06 * Math.min(1, speed); }, // pitch jitter; softer when slow
    suspenseStart() { const c = out(); if (!c) return; load().then(() => { if (bed || !BUF.suspense_loop || !S.sound || S.music === false) return; const t = c.currentTime, src = c.createBufferSource(), lpf = c.createBiquadFilter(), g = c.createGain();
      src.buffer = BUF.suspense_loop; src.loop = true; lpf.type = 'lowpass'; lpf.frequency.value = 900; g.gain.value = 0; fade(g.gain, 0, .4, t, 1.2); // 1.2 s equal-power fade-in
      src.connect(lpf).connect(g).connect(master); src.start(t); bed = { src, lp: lpf, g }; }); },
    suspenseIntensify() { if (!bed) return; const t = ctx.currentTime; bed.lp.frequency.setTargetAtTime(7000, t, .6); { const g = bed.g.gain, v = g.value; g.cancelScheduledValues(t); g.setValueAtTime(v, t); g.setTargetAtTime(.55, t + .01, .8); } bed.src.playbackRate.setTargetAtTime(1.06, t, 1.5); },
    suspenseStop(dur = .8) { if (!bed) return; const b = bed; bed = null; const t = ctx.currentTime; fade(b.g.gain, Math.max(.0001, b.g.gain.value), 0, t, dur); try { b.src.stop(t + dur + .1); } catch {} }, // equal-power fade-out, never a hard cut
    stinger(band) { this.suspenseStop(.8); play(STING[band] || 'stinger_soft', band === 'gold' ? .9 : .75, 0, .25); }, // equal-power crossfade: bed out .8 s, stinger in .25 s // duck the bed into the stinger
    tap() { const c = out(); if (!c) return null; const d = c.createMediaStreamDestination(); tapNode.connect(d); return d.stream; }, // QA: record the mix for previews
    setMuted(m) { if (master) master.gain.setTargetAtTime(m ? 0 : .5, ctx.currentTime, .08); if (m) { this.suspenseStop(.3); stop(); } },
    tearStart() { const c = ensure(); if (!c) return; stop(); src = c.createBufferSource(); src.buffer = noise; src.loop = true; bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = .9; bp.frequency.value = 1800; gain = c.createGain(); gain.gain.value = 0; src.connect(bp).connect(gain).connect((out(), master)); src.start(); },
    tearSpeed(v) { if (!gain) return; const t = ctx.currentTime; gain.gain.setTargetAtTime(Math.min(.5, .06 + v * .28), t, .025); bp.frequency.setTargetAtTime(1300 + Math.min(3, v) * 1300, t, .04); },
    crackle(v) { burst(.018 + Math.random() * .02, 3500 + Math.random() * 2500, 2500, Math.min(.35, .12 + v * .08), 'highpass', .7); },
    rip(v) { stop(); burst(.28, 3200, 500, Math.min(.7, .35 + v * .12)); },
    stop,
    chime(lvl) { const c = ensure(); if (!c || lvl < 2) return; const t = c.currentTime; [0, 4, 7, 12].slice(0, lvl).forEach((st, i) => { const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = 660 * Math.pow(2, st / 12); g.gain.setValueAtTime(0, t + i * .06); g.gain.linearRampToValueAtTime(.12, t + i * .06 + .01); g.gain.exponentialRampToValueAtTime(.001, t + i * .06 + .6); o.connect(g).connect((out(), master)); o.start(t + i * .06); o.stop(t + i * .06 + .65); }); },
  };
})();
function openStage(p, pulls, fromPicker) {
  FX.reset(); resetStageFx();
  stage.classList.add('open'); document.documentElement.classList.add('sky-stage'); stage.setAttribute('aria-hidden', 'false'); setTimeout(() => stage.classList.contains('open') && document.body.classList.add('ripping'), 320); // v0.9.4: stop painting the shop behind the stage
  $('#reveal').classList.remove('on'); $('#revealRail').innerHTML = ''; $('#revealPanel').innerHTML = ''; clearSummary();
  $('#stageHint').style.display = 'none'; // v0.9.16: no instruction banner / demo tear; a calm 'Swipe to rip' hint fades in only after 10 s idle
  $('.rays').style.opacity = 0;
  STRIP = pack3d(p)?.tear ? 62 : 49; // v2 render: below the crimp seal band (y~150/1000); flat art: ~12% of the pack
  const top = STRIP - BAND, SH = STRIP + BAND;
  ripArea.innerHTML = `
    <div class="rpack${pack3d(p)?.tear ? ' v2' : ''}" style="--strip:${STRIP}px;--band:${BAND}px">
      <div class="shadow"></div>
      <div class="pull-stack">${pulls.map((_, i) => `<div class="cb cardback" style="transform:translate3d(0,${i * -1.5}px,0)"></div>`).join('')}</div>
      <div class="pack pack-tier-${p.base} cat-${p.cat}">
        <div class="rp-body">
          <div class="rp-half l"><div class="art-wrap" style="position:absolute;left:0;top:${-top}px">${artHTML(p, false, true)}</div></div>
          <div class="rp-half r"><div class="art-wrap" style="position:absolute;left:${-PW / 2}px;top:${-top}px">${artHTML(p, false, true)}</div></div>
          <div class="rp-splitline"></div>
        </div>
        <svg class="rp-edge" width="${PW}" height="${SH + 6}" viewBox="0 0 ${PW} ${SH + 6}" aria-hidden="true"><polyline class="e0" points=""/><polyline class="e1" points=""/><polyline class="e2" points=""/></svg>
        <div class="rp-strip">${Array.from({ length: N_SLICES }, (_, i) => `<div class="rp-slice" style="left:${i * SW}px;width:${SW + .6}px;height:${SH}px"><div class="art-wrap" style="position:absolute;left:${-i * SW}px;top:0">${artHTML(p, true, true)}</div><i class="rp-fold"></i></div>`).join('')}</div>
        <div class="rp-crinkle"></div>
        <div class="sheen" style="border-radius:10px"></div>
        <div class="rp-hint" aria-hidden="true">Swipe to rip <i>→</i></div>
      </div>
      <div class="rp-name">${p.name} Pack</div>
    </div>`;
  const root = $('.rpack', ripArea);
  R = { p, pulls, root, slices: $$('.rp-slice', root), strip: $('.rp-strip', root), halves: $$('.rp-half', root), edge: $$('.rp-edge polyline', root), crinkle: $('.rp-crinkle', root),
    stack: $('.pull-stack', root), sheen: $('.sheen', root), foils: $$('.foil', root), torn: 0, front: 0, dir: 0, active: false, done: false, raf: 0,
    hb: new Float32Array(N_SLICES + 1).fill(NaN), jm: Array.from({ length: N_SLICES }, () => [0, 0]), tornAt: new Array(N_SLICES).fill(false),
    sp: Array.from({ length: N_SLICES }, () => ({ a: 0, va: 0, y: 0, vy: 0, x: 0, vx: 0, z: 0, vz: 0, cr: 0 })), v: 0, lx: 0, ly: STRIP, lt: 0, cr: 0, crX: 0, crY: STRIP };
  R.slices.forEach(s => s.style.clipPath = `polygon(0 0,100% 0,100% ${STRIP}px,0 ${STRIP}px)`);
  setBodyClip();
  // entrance: pack drops in with a spin
  if (fromPicker) PackPicker.handoff(root); // the picked pack is already centred: cross-fade into the tear pack, no drop-in
  else anim(root, [{ transform: 'translate3d(0,120%,0) rotate(-8deg) scale(.7)', opacity: 0 }, { transform: 'translate3d(0,-4%,0) rotate(1deg) scale(1.02)', opacity: 1, offset: .7 }, { transform: 'none', opacity: 1 }], { duration: reduceMotion ? 1 : 650, fill: 'none' });
  anim($('.stage-bg'), [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
  idleShimmer(); Tut.on('stage'); SFX.suspenseStart(); ripHint(true);
}
/* v0.9.16 idle hint: hidden at start; fades in after 10 s without a swipe; hides on touch; timer restarts on release without a rip */
const RIP_HINT_MS = 10000;
function tiltArt(deg) { // v0.9.17: swap the tear pack's art to the nearest yaw still while tilting (real angled view)
  const M = pack3d(R.p); if (!M) return; const s = deg > 0 ? 1 : -1, ad = Math.abs(deg), k = ad < 9 ? 't0' : ad < 24 && (M.tear || []).includes(15 * s) ? 't' + 15 * s : M.angles.includes(30 * s) ? 'y' + 30 * s : 't0';
  if (k === R.artK) return; R.artK = k; const u = `url(${pack3dImg(R.p, k)})`; $$('.art', R.root).forEach(n => { n.style.backgroundImage = u; $$('.pc', n).forEach(q => q.style.backgroundImage = u); }); }
function ripHint(arm) { if (!R) return; clearTimeout(R.hintT); const h = R.root && $('.rp-hint', R.root); if (h) h.classList.remove('on');
  if (arm && !R.done && !R.auto && !R.flick) { const r0 = R; R.hintT = setTimeout(() => { if (R === r0 && !R.done && !R.active && !R.auto && !R.flick && stage.classList.contains('open')) h?.classList.add('on'); }, RIP_HINT_MS); } }
function idleShimmer() { // v0.9.12: removed (no app-added reflections on packs)
  return;
  R.sheenAnim = R.sheen.animate([{ transform: 'translate3d(-120%,0,0)' }, { transform: 'translate3d(120%,0,0)' }], { duration: 2200, iterations: Infinity, easing: 'ease-in-out' });
}
function packRect() { return R.root.getBoundingClientRect(); }
/* jagged tear geometry. hb[b] = tear height at column boundary b (pack coords), jm[i] = two inner jag points per column. */
const colX = (i, f) => (i + f) * SW;
function jag(i) { const L = R.hb[i], Rr = R.hb[i + 1], [m1, m2] = R.jm[i]; return [[colX(i, 0), L], [colX(i, .33), L + (Rr - L) * .33 + m1], [colX(i, .66), L + (Rr - L) * .66 + m2], [colX(i, 1), Rr]]; }
function setBodyClip() { // body halves show the foil from the tear line down; untorn columns keep the flat strip line
  const top = STRIP - BAND;
  R.halves.forEach((h, side) => { const x0 = side * PW / 2, pts = [];
    for (let i = side * N_SLICES / 2; i < (side + 1) * N_SLICES / 2; i++) { if (R.tornAt[i]) jag(i).forEach(([x, y]) => pts.push(`${(x - x0).toFixed(1)}px ${(y - top).toFixed(1)}px`)); else pts.push(`${(colX(i, 0) - x0).toFixed(1)}px ${BAND}px`, `${(colX(i, 1) - x0).toFixed(1)}px ${BAND}px`); }
    h.style.clipPath = `polygon(${pts.join(',')},100% 100%,0 100%)`; });
}
function tearColumn(i, y, v) { // tear one column at finger height y, speed v (px/ms): slow = ragged, fast = clean
  if (R.tornAt[i]) return;
  const jit = Math.max(.8, 4.2 - v * 1.6), yy = Math.max(STRIP - BAND + 3, Math.min(STRIP + BAND - 3, y));
  for (const b of [i, i + 1]) if (isNaN(R.hb[b])) R.hb[b] = yy + (rnd() - .5) * 2 * jit;
  R.jm[i] = [(rnd() - .5) * 2.6 * jit, (rnd() - .5) * 2.6 * jit];
  R.tornAt[i] = true;
  const pts = jag(i), s = R.slices[i]; s.classList.add('peel');
  s.style.clipPath = `polygon(0 0,100% 0,${pts.slice().reverse().map(([x, y]) => `${(x - colX(i, 0)) / SW * 100}% ${y.toFixed(1)}px`).join(',')})`;
  s.style.transformOrigin = `50% ${((pts[0][1] + pts[3][1]) / 2).toFixed(1)}px`;
  R.sp[i].cr = (rnd() - .5) * 7; // foil crinkle: each torn piece kinks a little differently
}
function drawEdge() { // bright fibrous torn edge along the cut (body side + a fainter flap side)
  const order = []; for (let k = 0; k < N_SLICES; k++) { const i = R.dir >= 0 ? k : N_SLICES - 1 - k; if (R.tornAt[i]) order.push(i); }
  order.sort((a, b) => a - b);
  const pts = order.flatMap(i => jag(i)).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  R.edge.forEach(e => e.setAttribute('points', pts));
}
function advanceTo(px, py, v) { // finger at pack coords (px, py) moving at v px/ms
  const front = R.dir > 0 ? (px + 4) / SW : (PW - px + 4) / SW, nt = Math.max(0, Math.min(N_SLICES, Math.floor(front)));
  R.front = Math.max(R.front, Math.min(N_SLICES, front));
  if (nt > R.torn) {
    const y0 = R.ly;
    for (let k = R.torn; k < nt; k++) {
      const i = R.dir > 0 ? k : N_SLICES - 1 - k, f = (k - R.torn + 1) / (nt - R.torn);
      tearColumn(i, y0 + (py - y0) * f, v);
      if (k % 3 === 0) buzz(5);
      if (k % 2 === 0) SFX.crackle(v);
      if (k % 4 === 0) Flakes.spawn(R.rect.left + (i + .5) * SW, R.rect.top + (R.hb[i] || STRIP), 1, R.dir);
    }
    R.torn = nt; setBodyClip(); drawEdge();
  }
  R.ly = py; R.crX = Math.max(0, Math.min(PW, px)); R.crY = py; R.cr = Math.min(1, R.cr + v * .25);
}
ripArea.addEventListener('pointerdown', e => { ripHint(false);
  if (!R || R.done) return;
  SFX.unlock();
  const r = packRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  R.rect = r;
  if (y > -50 && y < STRIP + 60 && x > -40 && x < PW + 40) {
    R.active = true; if (!R.dir) R.dir = x < PW / 2 ? 1 : -1; R.lx = x; R.ly = Math.max(STRIP - BAND, Math.min(STRIP + BAND, y)); R.lt = performance.now(); R.v = 0;
    ripArea.setPointerCapture(e.pointerId);
    R.sheenAnim?.cancel(); SFX.tearStart(); SFX.suspenseIntensify();
    if (!R.raf) R.raf = requestAnimationFrame(tearTick);
  } else R.tapCandidate = { x: e.clientX, y: e.clientY, t: performance.now() };
});
ripArea.addEventListener('pointermove', e => {
  if (R && !R.active && !R.done && !R.auto && !R.flick && R.tapCandidate && !R.torn) { // v0.9.16 (video study): drag the pack body to tilt it, clamped to ±45°
    const dx = e.clientX - R.tapCandidate.x; if (!R.tilting && Math.abs(dx) > 8) { R.tilting = true; try { ripArea.setPointerCapture(e.pointerId); } catch (_) {} R.tiltEl = R.root; R.stack.style.visibility = 'hidden'; R.tiltEl.getAnimations().forEach(a => a.finish?.()); R.tiltEl.getAnimations().forEach(a => a.cancel()); }
    if (R.tilting) { R.tiltA = Math.max(-45, Math.min(45, dx * .35)); R.tiltEl.style.transform = `rotateY(${R.tiltA}deg)`; tiltArt(R.tiltA); }
    return; }
  if (!R || !R.active || R.done || R.flick) return;
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; // every touch sample, so the tear follows the real path
  for (const ev of evs.length ? evs : [e]) {
    const x = ev.clientX - R.rect.left, y = ev.clientY - R.rect.top, now = ev.timeStamp || performance.now(), dt = Math.max(1, now - R.lt);
    const inst = Math.max(0, (x - R.lx) * R.dir) / dt; R.v = R.v * .7 + inst * .3; R.lx = x; R.lt = now;
    advanceTo(x, y, R.v); /* v0.9.12: tilt blend off (double image): yaw_0 only */
  }
  SFX.tearSpeed(R.v);
  if (R.v > 1.7 && R.torn >= 3 && R.torn < N_SLICES) flickRest(R.v); // fast flick: rips the rest clean
  else if (R.torn >= N_SLICES * .85) flickRest(Math.max(1, R.v)); // past ~85% the seal finishes and flies on its own
});
const tearUp = e => {
  if (R?.tilting) { tiltArt(0); R.tilting = false; R.tapCandidate = null; const el = R.tiltEl, a0 = R.tiltA || 0; el.style.transform = ''; setTimeout(() => { if (R?.stack) R.stack.style.visibility = ''; }, 430); anim(el, [{ transform: `rotateY(${a0}deg)` }, { transform: `rotateY(${-a0 * .12}deg)`, offset: .6 }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' }); ripHint(true); return; }
  if (!R) return;
  if (R.active && !R.done) {
    R.active = false; SFX.tearSpeed(0);
    if (R.flick) return;
    if (R.v > .9 && R.torn >= N_SLICES * .3) flickRest(Math.max(1.2, R.v));
    else if (R.torn >= N_SLICES * .4) flickRest(1); // released past 40%: completes
    else if (R.torn > 0) flickRest(1); // v0.9.5: a released partial tear always completes cleanly (no half-peeled strip left behind)
    else { SFX.stop(); ripHint(true); }
  } else if (R.tapCandidate && !R.done && e.type === 'pointerup' && performance.now() - R.tapCandidate.t < 350) autoTear(); // tap anywhere = auto rip
  else if (R && !R.done && !R.auto && !R.flick && !R.active) ripHint(true);
  R.tapCandidate = null;
};
ripArea.addEventListener('pointerup', tearUp); ripArea.addEventListener('pointercancel', tearUp);
$('#skipBtn')?.addEventListener('click', () => { if (!R) return; if (!R.done) autoTear(true); else if (REV && !REV.running) REV.skipAll(); });
function flickRest(v) { // continue the tear on its own at the flick speed, drifting along the last finger height
  if (R.flick || R.done) return; R.flick = true; R.rect = packRect();
  let px = R.dir > 0 ? R.torn * SW : PW - R.torn * SW, py = R.ly, last = performance.now(); const vy = (STRIP - py) * .002;
  const step = now => { if (!R || R.done) return; const dt = Math.min(32, now - last); last = now; px += R.dir * v * dt; py += vy * dt; advanceTo(px, py, v); SFX.tearSpeed(v);
    if (R.torn >= N_SLICES) completeTear(v); else requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function tearTick() { // per-frame springs: torn pieces peel up and curl behind the tear front (transform only)
  if (!R) return;
  const K = .16, D = .26;
  for (let i = 0; i < N_SLICES; i++) {
    if (!R.tornAt[i]) continue;
    const k = R.dir > 0 ? i : N_SLICES - 1 - i, d = Math.max(0, R.front - k), sp = R.sp[i], fly = R.done ? 1 : 0;
    const e = 1 - Math.exp(-d / 2.2), ta = -(14 + 50 * e) - fly * 25, ty = -(3 + 13 * e), tx = R.dir * 4 * e, tz = R.dir * -3 * e + sp.cr * .45; // smooth saturating peel: the flap stays one piece
    sp.va += (ta - sp.a) * K - sp.va * D; sp.a += sp.va; sp.vy += (ty - sp.y) * K - sp.vy * D; sp.y += sp.vy;
    sp.vx += (tx - sp.x) * K - sp.vx * D; sp.x += sp.vx; sp.vz += (tz - sp.z) * K - sp.vz * D; sp.z += sp.vz;
    R.slices[i].style.transform = `translate3d(${sp.x.toFixed(2)}px,${sp.y.toFixed(2)}px,0) rotate(${sp.z.toFixed(2)}deg) skewX(${(sp.z * .8).toFixed(2)}deg) scaleY(${Math.cos(sp.a * Math.PI / 180).toFixed(3)})`; // 2D peel (scaleY = cos of the lift angle): no per-frame 3D perspective raster, holds 60fps on low-end GPUs
  }
  // foil crinkle highlight rides the tear front; fades when the finger stops
  { const tl = R.tilt ?? 0; R.tiltS = (R.tiltS ?? 0) + (tl - (R.tiltS ?? 0)) * .12; const w = R.tiltS; // hand-held parallax: blend the +-15 deg renders (one style write)
    if (Math.abs(w - (R.tiltW ?? 9)) > .004) { R.tiltW = w; R.root.style.setProperty('--wl', Math.max(0, -w).toFixed(3)); R.root.style.setProperty('--wr', Math.max(0, w).toFixed(3)); } }
  R.cr *= .9; R.crinkle.style.opacity = (R.cr * .3).toFixed(3); R.crinkle.style.transform = `translate3d(${(R.crX - 40).toFixed(1)}px,${(R.crY - 40).toFixed(1)}px,0) rotate(${(R.crX * 3) % 360}deg)`;
  // the pack flexes slightly under tension while the finger is down
  if (R.active && !R.done) R.root.style.transform = `rotate(${(R.dir * -R.torn * .1).toFixed(2)}deg) translate3d(0,${(R.torn * .15).toFixed(2)}px,0)`;
  R.raf = R.done && R.flapDone ? 0 : requestAnimationFrame(tearTick);
}
async function autoTear(fast) {
  if (!R || R.done || R.auto || R.flick) return;
  R.auto = true; if (!R.dir) R.dir = 1; R.rect = packRect(); SFX.unlock(); SFX.tearStart(); SFX.suspenseIntensify();
  ripHint(false); R.sheenAnim?.cancel();
  if (!R.raf) R.raf = requestAnimationFrame(tearTick);
  const v = fast ? 2.6 : .75, t0 = performance.now(); let lastX = R.dir > 0 ? R.torn * SW : PW - R.torn * SW;
  await new Promise(res => { const step = now => { if (!R || R.done) return res(); const t = now - t0, x = lastX + R.dir * v * t, y = STRIP - 2 + Math.sin(t / 70) * 4 + (t / 400);
    advanceTo(x, y, v); SFX.tearSpeed(v); if (R.torn >= N_SLICES) return res(); requestAnimationFrame(step); }; requestAnimationFrame(step); });
  completeTear(v);
}
async function completeTear(v = 1) {
  if (!R || R.done) return;
  for (let i = 0; i < N_SLICES; i++) if (!R.tornAt[i]) tearColumn(i, R.ly, v);
  setBodyClip(); drawEdge(); R.front = N_SLICES;
  R.done = true; R.active = false; Tut.on('torn');
  const Rs = R, dir = Rs.dir || 1;
  $('#stageHint').style.display = 'none';
  buzz([18, 24, 40]); SFX.rip(v);
  const rr = packRect();
  Flakes.spawn(rr.left + rr.width / 2, rr.top + STRIP, 7, dir);
  Rs.root.style.transform = '';
  // v0.9.5: nothing from the pack may linger over/behind the card: kill the tear line, crinkle highlight, guides and seam right away,
  // and fly the two halves apart + fade to 0 within 300ms, then display:none them (transform/opacity only)
  for (const sel of ['.rp-edge', '.rp-crinkle', '.rp-splitline', '.pack > .sheen', '.shadow']) $$(sel, Rs.root).forEach(n => { n.getAnimations().forEach(a => a.cancel()); n.style.display = 'none'; });
  // v0.9.12: the pack body stays (no split): a soft settle, then the card rises out of the open top
  anim(Rs.root, [{ transform: 'none' }, { transform: 'translate3d(0,5px,0) scale(.995)', offset: .45 }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'none' });
  // the flap flies off with the flick's momentum: ballistic + spin + gravity, then fades (transform/opacity only)
  { let x = 0, y = 0, r = 0; const vx0 = dir * (3 + Math.min(4, v) * 3.2), vy0 = -(5 + Math.min(4, v) * 2.4), vr = dir * (2.5 + Math.min(4, v) * 2.2); let vx = vx0, vy = vy0, t = 0, last = performance.now();
    const fly = now => { const f = Math.min(2.5, (now - last) / 16.7); last = now; t += f; vy += .55 * f; vx *= Math.pow(.99, f); x += vx * f; y += vy * f; r += vr * f;
      Rs.strip.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${r.toFixed(1)}deg)`; Rs.strip.style.opacity = Math.max(0, 1 - Math.max(0, t - 22) / 18).toFixed(3);
      if (t < 42 && R === Rs) requestAnimationFrame(fly); else { Rs.strip.style.opacity = 0; Rs.flapDone = true; } };
    requestAnimationFrame(fly); }
  await wait(200); // settle, then one continuous rise
  // v0.9.9: ONE continuous rise: the card leaves the pack mouth straight to its peak above the sleeve (no glide/reset), then drops in
  const mover = Rs.stack;
  const target = buildReveal(Rs.p, Rs.pulls);
  const bk = $('.face.back', target), sr = mover.getBoundingClientRect(), br = bk.getBoundingClientRect();
  const sc = br.width / sr.width, PEAK = -1.12;
  const dx = (br.left + br.width / 2) - (sr.left + sr.width / 2), dy = (br.top + br.height / 2 + PEAK * br.height) - (sr.top + sr.height / 2);
  { const body = $('.pack', Rs.root); setTimeout(() => anim(body, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate3d(0,26px,0) scale(.97)' }], { duration: 360, easing: 'cubic-bezier(.4,0,.7,.4)' }), 330); } // body leaves once the card is clear of the top
  await anim(mover, [{ transform: 'translate3d(0,0,0) scale(1)' }, { transform: `translate3d(${dx}px,${dy}px,0) scale(${sc})` }], { duration: 700, easing: 'cubic-bezier(.25,.9,.3,1)', fill: 'forwards' });
  $('#reveal').classList.add('on');
  { const a = mover.getBoundingClientRect(), b = bk.getBoundingClientRect(); REV.fromPx = (a.top + a.height / 2) - (b.top + b.height / 2); } // exact handoff, no jump
  ripArea.innerHTML = ''; // the pack is fully gone before the card enters the sleeve
  REV.enter();
  if (!Tut.active || Tut.trialN > 0) setTimeout(() => REV && REV.reveal(), 0); // practice rip 1 lets the player tap to flip
}

/* ---------- REVEAL (single card) ---------- */
let REV = null;
const BAND_LVL = { silver: 0, grey: 0, green: 1, blue: 2, purple: 3, red: 3, gold: 4 }; // suspense / burst intensity per colour band
const pullBand = (x, p) => x.band || bandOf(BY_ID[x.id], p);
function buildReveal(p, pulls) {
  const rr = $('#revealRail'), x = pulls[0], c = BY_ID[x.id], band = pullBand(x, p);
  rr.innerHTML = `<div class="spacer"></div><div class="rslide b-${band}" data-i="0"><div class="rscale"><div class="flip"><div class="face back cardback"></div><div class="slv f"><img class="sl" src="img/fx/sleeve.webp" alt=""><img class="gl" src="img/fx/gloss.webp" alt=""></div><div class="slv b"><img class="sl" src="img/fx/sleeve.webp" alt=""><img class="gl" src="img/fx/gloss.webp" alt=""></div>
      <div class="face front${gcls(c)}"><img src="${c.img}" alt="${c.name}" decoding="sync">${slabTop(c)}<div class="holo"></div></div></div></div><div class="decided"></div><div class="tap">TAP TO REVEAL</div></div><div class="spacer"></div>`;
  rr.scrollLeft = 0;
  const el = $('.rslide', rr);
  REV = {
    p, pulls, band, el, els: [el], revealed: [false], running: false, flip: $('.flip', el), glow: $('#rglow'), holo: $('.holo', el),
    enter() { if (ripArea.childElementCount) ripArea.innerHTML = ''; FX.reset(); if (this.pre) this.flip.style.transform = 'rotateY(180deg)'; this.sleeved = sleeveIn(el, this.fromPx, this.pre); this.renderPanel(); Tut.on('cards'); },
    update() {},
    async reveal() {
      if (this.revealed[0] || this.running) return;
      this.running = true; this.revealed[0] = true; el.classList.add('revealing');
      $('#revealPanel').innerHTML = `<div class="rp-meta" style="margin-top:28px;letter-spacing:.3em">• • •</div>`;
      await this.sleeved;
      if (this.pre) { const col = BAND_HEX[band], lvl = BAND_LVL[band], r = this.flip.getBoundingClientRect(); this.glow.style.setProperty('--rc', col); // already face-up from the carousel
        anim(this.glow, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: .3 + lvl * .12, transform: 'scale(1)' }], { duration: 420 }); if (lvl >= 1) FX.sparks(r.left + r.width / 2, r.top + r.height / 2, 10 + lvl * 8, [col, '#fff'], 0); buzz(lvl >= 3 ? [20, 40, 30] : 10); }
      else { await buildup(band, this.flip, this.glow, this.holo); glossSweep($('.slv.b .gl', el), 0); }
      el.classList.add('revealed'); this.running = false; this.renderPanel(); Tut.on('revealed');
    },
    renderPanel() {
      const panel = $('#revealPanel');
      if (!this.revealed[0] || this.running) { panel.innerHTML = `<div class="rp-meta" style="color:var(--cyan);margin-top:18px">Tap the card to flip it</div>`; return; }
      const sell = sellPrice(c), ps = priceSrc(c), mult = c.value / p.price;
      panel.innerHTML = `<div class="b-${band}"><span class="rbadge band">${BAND_LABEL[band]} · ${mult >= 10 ? Math.round(mult) : mult.toFixed(mult < 1 ? 2 : 1)}× price</span></div>
        <div class="rp-name">${c.name} ${slabChip(c)}</div><div class="rp-meta">${c.set} · #${c.number} · ${c.rarity}</div>
        <div class="rp-val"><i class="coin usd"></i>${fmt(c.value)}<span class="mkt-tag">MARKET</span>${x.practice ? '<span class="trial-tag">PRACTICE</span>' : ''}</div>
        <div class="rp-src">${ps.kind} · ${xe(ps.src)} · ${ps.date}</div>
        ${x.decided ? `<div class="rp-meta" style="margin-top:12px">${x.decided === 'keep' ? '🔐 Kept in your Vault' : x.decided === 'ship' ? '📦 Added to your ship requests (in Vault)' : '⚡ Sold back for ' + fmt(sell)}</div>` :
        `<div class="rp-actions${x.practice ? '' : ' three'}"><button class="btn-keep" data-act="keep">🔐 Vault</button><button class="btn-sell" data-act="sell">Sell back ${BBP()}<small>${fmt(sell)} to balance</small></button>${x.practice ? '' : '<button class="btn-ship" data-act="ship">📦 Ship</button>'}</div>`}
        ${!x.decided && !x.practice ? `<button class="cta cash sellagain" id="sellAgainBtn">⚡ Sell ${fmt(sell)} &amp; Rip Again<small>withdrawable balance · next ${fmtUSD(p.price)} ${RISK[S.risk].label} pack</small></button>` : ''}
        ${x.practice ? '' : `<button class="rz-rcpt" id="rcptBtn">🧾 Receipt · locked odds · serial ${xe(S.coll.find(k => k.uid === x.uid)?.serial || '')}</button>`}
        ${endRow(this.p, !x.decided)}`;
      const rb = $('#rcptBtn'); if (rb) rb.onclick = () => RZC.receipt(S.coll.find(k => k.uid === x.uid)?.purchase);
      $$('[data-act]', panel).forEach(b => b.onclick = () => this.decide(b.dataset.act));
      const d = $('#doneBtn'); if (d) d.onclick = () => { this.autoKeep(); closeStage(); };
      const noFunds = () => { const p = this.p; this.autoKeep(); closeStage(); setTimeout(() => Funds.open({ need: r2(p.price - spendable()), pack: p }), 280); };
      const ag = $('#againBtn'); if (ag) ag.onclick = () => { if (!canAfford(this.p)) return noFunds(); this.autoKeep(); REV = null; busy = false; startRip(this.p, true); };
      const sa = $('#sellAgainBtn'); if (sa) sa.onclick = () => { if (x.decided || this.running) return; const p = this.p;
        if (freeN(p) <= 0 && spendable() + sell + 1e-9 < p.price) return noFunds();
        sa.disabled = true; this.chain = true; this.decide('sell'); toast(`Sold back · +${fmt(sell)} · ripping again`); // same buyback path: Store Credit + credit fly-to-balance animation
        setTimeout(() => { if (REV !== this) return; REV = null; busy = false; startRip(p, true); }, 520); };
    },
    decide(act, silent) {
      if (x.decided) return;
      if (act === 'ship' && x.practice) act = 'keep';
      x.decided = act;
      if (BAND_LVL[band] >= 3 && !x.fed) { x.fed = 1; Ticker.push({ user: 'You', card: c, pack: this.p.name, me: true }); }
      if (x.practice) { if (act === 'sell') Tut.trialGC = r2(Tut.trialGC + sellPrice(c)); } // practice rips never add money or cards
      else if (x.owned) { const ix = S.coll.findIndex(q => q.uid === x.uid); // v0.9.11: already in the Vault since purchase
        if (act === 'sell') { const v = sellPrice(c); sellBack(c, v, x.uid); if (ix >= 0) S.coll.splice(ix, 1); S.stats.sold++;
          if (!silent) { const r = this.flip.getBoundingClientRect(), g = $('#balUSD').getBoundingClientRect(); FX.burst(r.left + r.width / 2, r.top + r.height / 2, 30, ['#5dffa8', '#d6ffe9'], .8); FX.fly(r.left + r.width / 2, r.top + r.height / 2, g.left + 10, g.top + g.height / 2, 12, '#5dffa8'); } }
        else if (act === 'ship' && ix >= 0) { S.coll[ix].ship = Date.now(); S.stats.shipReq++; } }
      else if (act === 'keep' || act === 'ship') { S.coll.push({ uid: x.uid, id: x.id, t: vNow(), pulledAt: vNow(), ship: act === 'ship' ? Date.now() : undefined }); if (act === 'ship') S.stats.shipReq++; }
      else { const v = sellPrice(c); sellBack(c, v, x.uid); S.stats.sold++;
        if (!silent) { const r = this.flip.getBoundingClientRect(), g = $('#balUSD').getBoundingClientRect(); FX.burst(r.left + r.width / 2, r.top + r.height / 2, 30, ['#5dffa8', '#d6ffe9'], .8); FX.fly(r.left + r.width / 2, r.top + r.height / 2, g.left + 10, g.top + g.height / 2, 12, '#5dffa8'); } }
      delete S.pending; save(); renderWallet(true);
      if (!this.chain) el.classList.add(act === 'sell' ? 'sold' : 'kept'); $('.decided', el).textContent = act === 'keep' ? 'KEPT' : act === 'ship' ? 'SHIP' : 'SOLD';
      if (!silent) buzz(12); Tut.on('decided', act === 'sell' ? sellPrice(c) : 0);
      if (act === 'ship' && !silent) { toast(`📦 ${c.name}: ship request Requested · flat ${fmtUSD(CONFIG.SHIP_FEE)} (demo)`); if (!S.addr) setTimeout(() => shipForm(() => {}), 350); }
      if (!silent && !this.chain) this.renderPanel();
      if (!silent && !x.practice && !this.chain) setTimeout(() => { if (REV === this) closeStage(); }, act === 'sell' ? 750 : 550); // v0.9.6: Vault / Sell / Ship return to the shop
    },
    autoKeep() { if (!x.decided) { this.decide('keep', true); toast('Card sent to your Vault'); } },
    skipAll() { if (this.revealed[0] || this.running) return; this.revealed[0] = true; this.flip.style.transform = 'rotateY(180deg)'; el.classList.add('revealed'); this.renderPanel(); },
  };
  rr.onclick = e => { if (!e.target.closest('.rslide') || !REV) return; if (REV.revealed[0] && !REV.running) { const pu = REV.pulls[0]; Inspect.open(BY_ID[pu?.id] || pu?.card || pu); } else REV.reveal(); }; // v0.9.17: tap the revealed card to inspect it
  $('#reveal').onclick = e => { const R0 = REV; if (!R0 || !R0.revealed[0] || R0.running || R0.pulls[0].practice) return; // tap outside = vault the card and go back to the shop
    if (e.target.closest('.rslide, button, a, #revealPanel .rp-actions, #sellAgainBtn')) return; R0.autoKeep(); closeStage(); };
  return REV.flip;
}

/* rarity-based suspense buildup + flip */
/* v0.9.4 penny sleeve: the face-down card slides up into a clear sleeve (pre-rendered bitmap), a gloss band sweeps across, then the sleeved card flips. Transform/opacity only. */
const EASE_OUT = 'cubic-bezier(.22,1,.36,1)';
function glossSweep(g, delay) { return; /* v0.9.12: no gloss sweeps */ if (!g || reduceMotion) return; anim(g, [{ opacity: 0, transform: 'translate3d(-130px,0,0) rotate(14deg)' }, { opacity: 1, offset: .3 }, { opacity: 0, transform: 'translate3d(300px,0,0) rotate(14deg)' }], { duration: 640, delay, easing: 'cubic-bezier(.4,0,.2,1)' }); }
async function sleeveIn(el, fromPeak, pre) {
  const back = $(pre ? '.face.front' : '.face.back', el), R0 = pre ? 'rotateY(180deg) ' : '', sv = $$('.slv', el);
  if (reduceMotion) { sv.forEach(n => n.style.opacity = 1); return; }
  // v0.9.7: the open sleeve sits in place; the face-down card drops in from above through the top opening (ease-in fall, soft settle)
  sv.forEach(n => anim(n, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: EASE_OUT }));
  if (fromPeak != null) { // v0.9.9: continue from the exact peak the rise ended at: straight down, then the settle bounce
    const pk = fromPeak.toFixed(1) + 'px';
    await anim(back, [{ transform: `${R0}translate3d(0,${pk},0)`, easing: 'cubic-bezier(.55,0,.85,.45)' }, { transform: `${R0}translate3d(0,2.2%,0)`, offset: .68, easing: 'cubic-bezier(.2,.8,.3,1)' },
      { transform: `${R0}translate3d(0,-1%,0)`, offset: .85, easing: 'cubic-bezier(.4,0,.4,1)' }, { transform: `${R0}translate3d(0,0,0)` }], { duration: 560 });
    glossSweep($(pre ? '.slv.b .gl' : '.slv.f .gl', el), 0); await wait(220); return;
  }
  await anim(back, [{ transform: 'translate3d(0,-128%,0)', opacity: 0, easing: 'linear' }, { transform: 'translate3d(0,-112%,0)', opacity: 1, offset: .14, easing: 'cubic-bezier(.55,0,.85,.45)' },
    { transform: 'translate3d(0,2.2%,0)', opacity: 1, offset: .72, easing: 'cubic-bezier(.2,.8,.3,1)' }, { transform: 'translate3d(0,-1%,0)', opacity: 1, offset: .86, easing: 'cubic-bezier(.4,0,.4,1)' }, { transform: 'translate3d(0,0,0)', opacity: 1 }], { duration: 640, delay: 180 });
  glossSweep($('.slv.f .gl', el), 0); await wait(220);
}
async function buildup(band, flip, glow, holo) { // intensity follows the card's colour band (value vs the pack price)
  const lvl = BAND_LVL[band], col = BAND_HEX[band];
  glow.style.setProperty('--rc', col);
  const dim = $('#dim');
  const rays = $('.rays'); rays.style.setProperty('--ray', col + '55');
  const r = flip.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const flash = $('#flash');
  if (reduceMotion) { flip.style.transform = 'rotateY(180deg)'; glow.style.opacity = lvl >= 2 ? .6 : .25; return; }
  if (lvl <= 1) {
    if (lvl === 1) await anim(flip, [{ transform: 'none' }, { transform: 'translate3d(0,-10px,0) rotateZ(-3deg)' }, { transform: 'none' }], { duration: 260 });
    anim(glow, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: lvl ? .55 : .25, transform: 'scale(1)' }], { duration: 500 });
    setTimeout(() => SFX.stinger(band), 300);
    await anim(flip, [{ transform: 'rotateY(0)' }, { transform: 'rotateY(190deg)', offset: .75 }, { transform: 'rotateY(180deg)' }], { duration: 520, easing: 'cubic-bezier(.3,.7,.3,1)' });
    buzz(10);
    if (lvl) { FX.sparks(cx, cy, 18, [col, '#fff'], 0); FX.glitter(cx, cy, 14, [col, '#ffffff'], .7); }
    return;
  }
  // rare+ : suspense phase
  const dur = [0, 0, 650, 1250, 2100][lvl];
  buzz(lvl === 4 ? [20, 80, 20, 80, 30, 60, 40] : lvl === 3 ? [20, 60, 30] : 15);
  anim(dim, [{ opacity: 0 }, { opacity: [0, 0, .25, .45, .6][lvl] }], { duration: dur * .6 });
  if (lvl >= 3) anim(rays, [{ opacity: 0, transform: 'rotate(0deg) scale(.6)' }, { opacity: lvl === 4 ? .9 : .5, transform: 'rotate(60deg) scale(1)' }], { duration: dur, easing: 'ease-in' });
  // glow heartbeat accelerating
  const beats = lvl === 2 ? 2 : lvl === 3 ? 4 : 7;
  const kf = []; for (let b = 0; b <= beats; b++) { const t = 1 - Math.pow(1 - b / beats, 1.6); kf.push({ offset: t, opacity: b % 2 ? .25 + lvl * .1 : .1 + b / beats * .4, transform: `scale(${.7 + b / beats * .35})` }); }
  anim(glow, kf, { duration: dur, easing: 'linear' });
  // card shake with rising amplitude + levitate
  const sk = []; const n = Math.round(dur / 45);
  for (let k = 0; k <= n; k++) { const amp = (k / n) * (lvl === 4 ? 7 : lvl === 3 ? 5 : 3), s = k % 2 ? 1 : -1; sk.push({ transform: `translate3d(${s * amp}px,${-k / n * (lvl * 6)}px,0) rotateZ(${-s * amp * .4}deg) scale(${1 + k / n * .06 * lvl / 2})` }); }
  sk[sk.length - 1] = { transform: `translate3d(0,${-lvl * 6}px,0) scale(${1 + .06 * lvl / 2})` };
  const motes = setInterval(() => FX.rise(cx, cy + 80, 240, lvl * 2, col), 60);
  await anim(flip, sk, { duration: dur, easing: 'linear' });
  clearInterval(motes);
  // the flip + burst
  buzz(lvl === 4 ? [60, 30, 120] : 40);
  const fl = anim(flip, [{ transform: `translate3d(0,${-lvl * 6}px,0) rotateY(0) scale(1.1)` }, { transform: 'translate3d(0,-20px,0) rotateY(200deg) scale(1.16)', offset: .6 }, { transform: 'rotateY(180deg) scale(1)' }], { duration: 640 + lvl * 40, easing: 'cubic-bezier(.3,.7,.2,1)' });
  await wait(260);
  flash.style.background = col;
  anim(flash, [{ opacity: 0 }, { opacity: [0, 0, .3, .55, .8][lvl], offset: .12 }, { opacity: 0 }], { duration: lvl === 4 ? 900 : 550, easing: 'ease-out' });
  anim(glow, [{ opacity: .8, transform: 'scale(1.25)' }, { opacity: lvl === 4 ? .85 : .65, transform: 'scale(1)' }], { duration: 700 });
  FX.burst(cx, cy, [0, 0, 50, 110, 220][lvl], lvl === 4 ? ['#ffcc33', '#fff3a8', '#ffffff', '#ff8a00', '#ff2bd6', '#00f0ff'] : [col, '#ffffff', col], lvl === 4 ? 1.5 : 1.1);
  if (lvl >= 2) window.Sky?.rockets(lvl, col); // v0.9.16 big-win rockets behind the card (same Blue+ threshold as the celebration stinger)
  if (lvl === 4) setTimeout(() => FX.burst(cx, cy - 60, 120, ['#ffcc33', '#ffffff', '#ff2bd6', '#00f0ff', '#39ff9f'], 1.2), 380);
  FX.glitter(cx, cy, [0, 0, 30, 55, 90][lvl], lvl === 4 ? ['#ffcc33', '#fff3a8', '#ffffff', '#ff2bd6'] : [col, '#ffffff'], 1 + lvl * .15); SFX.stinger(band);
  setTimeout(() => FX.glitter(cx, cy, [0, 0, 12, 24, 40][lvl], [col, '#ffffff'], .6), 420);
  if (lvl >= 3) holo.animate([{ opacity: .55, transform: 'translate3d(-30%,-10%,0)' }, { opacity: .55, transform: 'translate3d(30%,10%,0)' }], { duration: 2200, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
  await fl;
  anim(dim, [{ opacity: [0, 0, .25, .45, .6][lvl] }, { opacity: lvl === 4 ? .3 : 0 }], { duration: 600 });
  if (lvl >= 3) rays.animate([{ transform: 'rotate(60deg)', opacity: lvl === 4 ? .9 : .5 }, { transform: 'rotate(420deg)', opacity: lvl === 4 ? .45 : 0 }], { duration: 9000, fill: 'forwards', easing: 'linear' });
}

function clearSummary() { $('#revealRail').getAnimations().forEach(a => a.cancel()); }
function canAfford(p) { if (freeN(p) > 0) return true; return spendable() + 1e-9 >= p.price; }
function endRow(p, undecided) {
  if (REV?.pulls[0]?.practice) { const n = Tut.trialN + 1; return `<div class="end-row one"><button class="cta" id="doneBtn">${n < 3 ? `Continue → practice rip ${n + 1} of 3` : 'Continue'}</button></div>
    ${undecided ? `<div class="rp-meta" style="margin-top:6px">Practice cards are not kept</div>` : ''}`; }
  return undecided ? `<div class="rp-meta rp-note">If you don't choose, the card goes to your Vault · Vault cards auto-sell after ${VAULT_DAYS()} days</div>` : ''; // v0.9.6: Done / Rip again removed
}
function closeStage() {
  SFX.suspenseStop(.8);
  document.body.classList.remove('ripping');
  anim(stage, [{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'none' }).then(() => {
    stage.classList.remove('open'); document.documentElement.classList.remove('sky-stage'); stage.setAttribute('aria-hidden', 'true');
    $('#revealRail').innerHTML = ''; $('#reveal').classList.remove('on'); clearSummary(); $('.rays').getAnimations().forEach(a => a.cancel()); $('.rays').style.opacity = 0;
    $('#dim').getAnimations().forEach(a => a.cancel()); $('#rglow').getAnimations().forEach(a => a.cancel()); $('#rglow').style.opacity = 0;
    R = null; REV = null; busy = false; renderPackInfo();
    if (Tut.active) return Tut.on('closed');
    const kept = S.coll.length; toast(`${kept} card${kept === 1 ? '' : 's'} in your Vault`);
  });
}

/* ---------- collection (Vault) ---------- */
let collFilter = 'all';
var selMode = false, collVisible = []; const selSet = new Set();
$('#collFilter').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; collFilter = b.dataset.f; $$('#collFilter button').forEach(x => x.classList.toggle('on', x === b)); renderCollection(); });
function collValue() { let m = 0, b = 0; for (const x of S.coll) { const c = BY_ID[x.id]; if (!c) continue; m += c.value; if (!x.ship) b += sellPrice(c); } return { m: r2(m), b: r2(b) }; }
const shipItems = () => S.coll.filter(x => x.ship && BY_ID[x.id]);
function renderCollection() {
  const v = collValue(), sh = shipItems();
  $('#collTotals').innerHTML = `<div class="tot cash"><small>Market value</small><b>${fmtUSDs(v.m)}</b></div><div class="tot"><small>Buyback ${BBP()}</small><b>${fmtUSDs(v.b)}</b></div><div class="tot"><small>Cards</small><b>${S.coll.length}</b></div>`;
  $('#collFounder').innerHTML = vaultWarn() + founderTag(UserService.getProfile()) + (sh.length ? `<button class="ship-banner" id="shipBanner">📦 <span><b>${sh.length} card${sh.length === 1 ? '' : 's'} requested for shipping</b><small>Flat ${fmtUSD(CONFIG.SHIP_FEE)} per shipment · demo, nothing ships yet</small></span>›</button>` : '');
  const sb = $('#shipBanner'); if (sb) sb.onclick = showShipList;
  let items = S.coll.filter(x => BY_ID[x.id]);
  if (collFilter === 'ship') items = items.filter(x => x.ship); else if (collFilter.startsWith('cat:')) items = items.filter(x => BY_ID[x.id].cat === collFilter.slice(4)); else if (collFilter !== 'all') items = items.filter(x => BY_ID[x.id].tier === collFilter);
  items.sort((a, b) => BY_ID[b.id].value - BY_ID[a.id].value);
  $('#collEmpty').style.display = items.length ? 'none' : '';
  collVisible = items.filter(x => !x.ship).map(x => x.uid); for (const u of [...selSet]) if (!S.coll.some(x => x.uid === u && !x.ship)) selSet.delete(u); if (selMode) setTimeout(updateSelBar);
  $('#collGrid').innerHTML = items.map(x => { const c = BY_ID[x.id];
    return `<button class="gcard r-${c.tier}${gcls(c)}${x.ship ? ' shipping' : ''}${selSet.has(x.uid) ? ' picked' : ''}" data-uid="${x.uid}"><i class="pick"></i><img src="${c.img}" alt="${c.name}" loading="lazy" decoding="async">${slabTop(c)}${c.cat !== 'pkm' ? `<i class="gcat">${CAT_BY[c.cat].ico}</i>` : ''}${x.ship ? '' : vaultBadge(x)}<div class="v usd"><span>${x.ship ? '📦' : 'MKT'}</span><span>${fmtUSDs(c.value)}</span></div></button>`; }).join('');
}
$('#collGrid').addEventListener('click', e => { const g = e.target.closest('.gcard'); if (!g) return; const u = +g.dataset.uid;
  if (selMode) { if (g.classList.contains('shipping')) return toast('Requested for shipping · cancel the request to sell it'); selSet.has(u) ? selSet.delete(u) : selSet.add(u); g.classList.toggle('picked', selSet.has(u)); buzz(8); updateSelBar(); } else openCard(u); });
/* multi-select: sell back (USD) or request shipping */
function setSelMode(on) { selMode = on; selSet.clear(); $('#view-collection').classList.toggle('selecting', on); $('#selToggle').textContent = on ? 'Cancel' : 'Select'; $('#selToggle').classList.toggle('on', on); $('#collHint').textContent = on ? '· tap cards to select' : '· tap a card to sell, keep or ship'; $$('#collGrid .gcard.picked').forEach(g => g.classList.remove('picked')); updateSelBar(); }
function selTotals() { let usd = 0, mkt = 0, n = 0; for (const x of S.coll) { if (!selSet.has(x.uid) || x.ship) continue; const c = BY_ID[x.id]; if (!c) continue; n++; usd += sellPrice(c); mkt += c.value; } return { usd: r2(usd), mkt: r2(mkt), n }; }
function selLabel(t) { return fmtUSD(t.usd); }
function updateSelBar() { const t = selTotals(); $('#selCount').textContent = `${t.n} selected`; $('#selTotal').textContent = t.n ? `Market ${fmtUSD(t.mkt)} · buyback ${selLabel(t)}` : 'Tap cards to select'; const b = $('#selSell'); b.disabled = !t.n; b.innerHTML = t.n ? `⚡ Sell ${t.n}<small>${selLabel(t)}</small>` : 'Sell'; const sp = $('#selShip'); sp.disabled = !t.n; sp.innerHTML = t.n ? `📦 Ship<small>${t.n} card${t.n === 1 ? '' : 's'}</small>` : '📦 Ship'; const allOn = collVisible.length && collVisible.every(u => selSet.has(u)); $('#selAll').textContent = allOn ? 'Clear' : `Select all${collFilter !== 'all' ? ' shown' : ''}`; }
$('#selToggle').addEventListener('click', () => setSelMode(!selMode));
$('#selAll').addEventListener('click', () => { const allOn = collVisible.length && collVisible.every(u => selSet.has(u)); collVisible.forEach(u => allOn ? selSet.delete(u) : selSet.add(u)); $$('#collGrid .gcard').forEach(g => g.classList.toggle('picked', selSet.has(+g.dataset.uid))); buzz(10); updateSelBar(); });
const selStrip = top => `<div class="sel-strip">${top.slice(0, 6).map(x => { const c = BY_ID[x.id]; return `<div class="gcard r-${c.tier}${gcls(c)}"><img src="${c.img}" alt="${c.name}"></div>`; }).join('')}${top.length > 6 ? `<div class="sel-more">+${top.length - 6}</div>` : ''}</div>`;
const selPicked = () => S.coll.filter(x => selSet.has(x.uid) && !x.ship && BY_ID[x.id]).sort((a, b) => BY_ID[b.id].value - BY_ID[a.id].value);
$('#selSell').addEventListener('click', () => { const t = selTotals(); if (!t.n) return;
  sheet(`<div style="text-align:center"><div class="rp-name">Sell ${t.n} card${t.n === 1 ? '' : 's'} back?</div>${selStrip(selPicked())}
    <div class="rp-val" style="justify-content:center"><i class="coin usd"></i>${fmt(t.usd)}</div>
    <div class="rp-meta">Instant buyback at ${BBP()} of the current ${fmt(t.mkt)} market value, paid to your USD balance. This can't be undone.</div></div>
    <div class="row2"><button class="cta ghost" id="shClose">Cancel</button><button class="cta cash" id="shSellSel">Sell ${t.n}<small>${selLabel(t)}</small></button></div>`);
  $('#shClose').onclick = closeSheet;
  $('#shSellSel').onclick = () => { const tt = selTotals(); S.coll.filter(q => selSet.has(q.uid) && !q.ship).forEach(q => { const c = BY_ID[q.id]; if (c) sellBack(c, sellPrice(c), q.uid); }); S.coll = S.coll.filter(q => !(selSet.has(q.uid) && !q.ship)); S.stats.sold += tt.n; save(); renderWallet(true); closeSheet(); setSelMode(false); renderCollection(); toast(`Sold ${tt.n} card${tt.n === 1 ? '' : 's'} for ${selLabel(tt)}`); buzz([15, 30, 15]); };
});
$('#selShip').addEventListener('click', () => { const t = selTotals(); if (!t.n) return; const picked = selPicked();
  sheet(`<div style="text-align:center"><div class="rp-name">Ship ${t.n} card${t.n === 1 ? '' : 's'} to you?</div>${selStrip(picked)}
    <div class="mp-break"><div><span>Cards (${fmt(t.mkt)} market)</span><b>${t.n}</b></div><div><span>Flat shipping</span><b>${fmtUSD(CONFIG.SHIP_FEE)}</b></div></div>
    <div class="rp-meta">Demo placeholder: the cards are marked as a ship request in your Vault. No address is collected, nothing ships and the fee is not charged.</div></div>
    <div class="row2"><button class="cta ghost" id="shClose">Cancel</button><button class="cta" id="shShipSel">Request shipping<small>${fmtUSD(CONFIG.SHIP_FEE)} insured</small></button></div>`);
  $('#shClose').onclick = closeSheet;
  $('#shShipSel').onclick = () => shipForm(() => { const now = Date.now(); let n = 0; for (const x of S.coll) if (selSet.has(x.uid) && !x.ship) { x.ship = now; n++; } S.stats.shipReq += n; save(); closeSheet(); setSelMode(false); renderCollection(); toast(`📦 ${n} card${n === 1 ? '' : 's'} added to ship requests (demo)`); buzz([15, 30, 15]); });
});
function showShipList() {
  const sh = shipItems().sort((a, b) => BY_ID[b.id].value - BY_ID[a.id].value), mkt = r2(sh.reduce((a, x) => a + BY_ID[x.id].value, 0));
  sheet(`<h2 style="text-align:center">Ship requests <span class="demo-tag">DEMO</span></h2>
    <div class="ship-list">${sh.map(x => { const c = BY_ID[x.id]; return `<div class="ship-row"><img src="${c.img}" alt=""><span><b>${c.name}</b><small>${c.set} · ${fmtUSD(c.value)} market · requested ${new Date(x.ship).toLocaleDateString()}</small></span><button class="ship-x" data-unship="${x.uid}">Cancel</button></div>`; }).join('')}</div>
    <div class="mp-break"><div><span>${sh.length} card${sh.length === 1 ? '' : 's'} · market value</span><b>${fmtUSD(mkt)}</b></div><div class="mtot"><span>Flat shipping</span><b>${fmtUSD(CONFIG.SHIP_FEE)}</b></div></div>
    <p class="fine">Placeholder for physical fulfilment from inventory: address capture, payment of the fee, packing and tracking are not built yet. Nothing is charged or shipped.</p>
    <button class="cta ghost" id="shClose">Close</button>`);
  $('#shClose').onclick = closeSheet;
  $$('#sheetBody [data-unship]').forEach(b => b.onclick = () => { const x = S.coll.find(q => q.uid === +b.dataset.unship); if (x) delete x.ship; save(); renderCollection(); shipItems().length ? showShipList() : closeSheet(); toast('Ship request cancelled · card is back in your Vault'); });
}
function openCard(uid) {
  const x = S.coll.find(q => q.uid === uid); if (!x) return; const c = BY_ID[x.id], sell = sellPrice(c), ps = priceSrc(c);
  sheet(`<button class="sheet-card insp-open r-${c.tier}${gcls(c)}" id="sheetInsp" aria-label="Inspect card"><img src="${c.img}" alt="${c.name}">${slabTop(c)}<i class="insp-hint">⤢ Inspect</i></button>
    <div style="text-align:center"><span class="rbadge r-${c.tier}">${TIER_LABEL[c.tier]}</span><div class="rp-name">${c.name} ${slabChip(c)}</div><div class="rp-meta">${c.set} · #${c.number} · ${c.rarity} · ${CAT_BY[c.cat].long}</div>
    <div class="rp-val"><i class="coin usd"></i>${fmt(c.value)}<span class="mkt-tag">MARKET</span></div>
    <button class="fav-btn${S.fav && S.fav.uid === uid ? ' on' : ''}" id="shFav" aria-pressed="${!!(S.fav && S.fav.uid === uid)}">${S.fav && S.fav.uid === uid ? '★ Favorite card' : '☆ Set as favorite'}</button>
    <div class="rp-src">${ps.kind}<br>Source: ${ps.url ? `<a href="${xe(ps.url)}" target="_blank" rel="noopener">${xe(ps.src)}</a>` : xe(ps.src)} · price date ${ps.date}</div></div>
    ${x.ship ? `<div class="rp-meta" style="text-align:center;margin:10px 0">📦 Status: <b>Requested</b> · ${new Date(x.ship).toLocaleDateString()} · to ${S.addr ? xe(S.addr.city + ', ' + S.addr.state) : 'address pending'} · flat ${fmtUSD(CONFIG.SHIP_FEE)} (demo)</div>
      <div class="row2"><button class="cta ghost" id="shClose">Close</button><button class="cta ghost" id="shUnship">Cancel ship request</button></div>` :
    `<div class="row2"><button class="cta ghost" id="shClose">Keep</button><button class="cta cash" id="shSell">Sell back ${BBP()}<small>${fmt(sell)} cash</small></button></div>
    <button class="cta ghost ship-cta" id="shShip">📦 Ship to me<small>insured ${fmtUSD(CONFIG.SHIP_FEE)}</small></button>`}
    <p class="fine" style="text-align:center">Shipping the real card is always available. Optional buyback pays ${BBP()} of the current market price as withdrawable sell-back cash. Shipping is a demo: nothing is charged or shipped yet.</p>`);
  $('#sheetInsp').onclick = () => Inspect.open(c);
  $('#shFav').onclick = () => { const on = !(S.fav && S.fav.uid === uid); Stats.setFav(on ? { uid, id: x.id } : null); const b = $('#shFav'); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.textContent = on ? '★ Favorite card' : '☆ Set as favorite'; buzz(8); toast(on ? `★ ${c.name} pinned to your profile` : 'Favorite cleared'); };
  $('#shClose').onclick = closeSheet;
  const us = $('#shUnship'); if (us) us.onclick = () => { delete x.ship; save(); closeSheet(); renderCollection(); toast('Ship request cancelled'); };
  const ss = $('#shShip'); if (ss) ss.onclick = () => shipForm(() => { x.ship = Date.now(); S.stats.shipReq++; save(); closeSheet(); renderCollection(); toast(`📦 ${c.name}: ship request Requested (demo)`); buzz(12); });
  const sl = $('#shSell'); if (sl) sl.onclick = () => { sellBack(c, sell, uid); S.coll = S.coll.filter(q => q.uid !== uid); S.stats.sold++; save(); renderWallet(true); closeSheet(); renderCollection(); toast(`${c.name} sold back · +${fmt(sell)} cash`); buzz(15); };
}
function sheet(html) { $('#sheetBody').innerHTML = html; $('#sheet').classList.add('open'); }
function closeSheet() { $('#sheet').classList.remove('open', 'fx'); }
$('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') closeSheet(); });

/* ---------- wallet: add funds (demo) + activity ---------- */
function bestPackFor(a) { const ok = PACKS.filter(p => p.price <= a).sort((x, y) => y.price - x.price)[0]; return ok ? `${Math.floor(a / ok.price)}× ${CAT_BY[ok.cat].name} ${ok.name} pack` : `toward a ${PACKS[0].name} pack`; }
/* ================= v0.10.0 WALLET · ADD FUNDS (Coinflow-style checkout) · WITHDRAW · KYC (Footprint-style) =================
   Add Funds is a bottom sheet reachable in one tap from the balance chip on every screen. Layout mirrors Coinflow's prebuilt
   CoinflowPurchase checkout (amount header -> express wallets Apple Pay / Google Pay -> "or pay with card" -> saved cards ->
   card number · MM/YY · CVC · ZIP -> Subtotal / Processing fee / Total -> Pay button -> "Secured by Coinflow").
   PROD: replace CoinflowMock.mount() with the real embed in the same #cfMount node (iframe from @coinflowlabs/lib-common
   getCoinflowUrl({ route: '/purchase-v2', merchantId, env, sessionKey, jwtToken, subtotal }) or the React <CoinflowPurchase/>),
   and credit the wallet from the server webhook, not the client. */
const TESTMODE = () => window.RZ_CONFIG?.TEST_MODE !== false;
const tmTag = () => TESTMODE() ? '<span class="tm-tag">TEST MODE</span>' : '';
const CoinflowMock = {
  mount(el, { amount, onPaid }) {
    const fee = r2(amount * (RZ_CONFIG.CARD_FEE_PCT || 0)), tot = r2(amount + fee), saved = RZBackend.methods();
    el.innerHTML = `<div class="cf">
      <div class="cf-xp"><button class="cf-apple" data-xp="Apple Pay"><svg viewBox="0 0 17 20" width="16" height="19" fill="#fff"><path d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9C3.6 4.8 2 5.8 1.1 7.4c-1.8 3.2-.5 7.8 1.3 10.4.9 1.3 1.9 2.7 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.6 1-1.5 1.4-2.9 1.4-3-.1 0-2.7-1-2.7-4.2zM11.6 3c.7-.9 1.2-2 1-3.2-1 0-2.2.7-2.9 1.6-.6.7-1.2 1.9-1 3.1 1.1.1 2.2-.6 2.9-1.5z"/></svg>Pay</button><button class="cf-gpay" data-xp="Google Pay"><b>G</b> Pay</button></div>
      <div class="cf-or"><span>or pay with card</span></div>
      ${saved.length ? `<div class="cf-saved">${saved.map((m, i) => `<label class="cf-card"><input type="radio" name="cfpm" value="${m.id}" ${i ? '' : 'checked'}><i class="cf-brand ${m.brand.toLowerCase()}">${m.brand}</i><span>•••• ${m.last4}<small>Exp ${m.exp}</small></span></label>`).join('')}
        <label class="cf-card"><input type="radio" name="cfpm" value="new"><i class="cf-brand new">＋</i><span>Add new card</span></label></div>` : ''}
      <div class="cf-new" ${saved.length ? 'hidden' : ''}>
        <label class="cf-f"><span>Card number</span><input id="cfNum" inputmode="numeric" autocomplete="cc-number" placeholder="1234 1234 1234 1234" maxlength="19"></label>
        <div class="cf-row"><label class="cf-f"><span>Expiration</span><input id="cfExp" inputmode="numeric" autocomplete="cc-exp" placeholder="MM / YY" maxlength="7"></label>
        <label class="cf-f"><span>CVC</span><input id="cfCvc" inputmode="numeric" autocomplete="cc-csc" placeholder="CVC" maxlength="4"></label>
        <label class="cf-f"><span>ZIP</span><input id="cfZip" inputmode="numeric" autocomplete="postal-code" placeholder="12345" maxlength="5"></label></div>
        <label class="cf-save"><input type="checkbox" id="cfSave" checked> Save card for one-tap deposits</label>
        ${TESTMODE() ? '<small class="cf-test">Sandbox: use 4242 4242 4242 4242 · any future date · any CVC</small>' : ''}</div>
      <div class="cf-sum"><div><span>Subtotal</span><b>${fmtUSD(amount)}</b></div><div><span>Processing fee</span><b>${fee ? fmtUSD(fee) : 'Free'}</b></div><div class="t"><span>Total</span><b>${fmtUSD(tot)}</b></div></div>
      <small class="cf-err" id="cfErr"></small>
      <button class="cf-pay" id="cfPay">Pay ${fmtUSD(tot)}</button>
      <div class="cf-foot">🔒 Secured by <b>Coinflow</b> · PCI DSS · 3-D Secure</div></div>`;
    const err = t => { $('#cfErr', el).textContent = t; }, sel = () => $('input[name=cfpm]:checked', el)?.value;
    $$('input[name=cfpm]', el).forEach(r => r.onchange = () => { $('.cf-new', el).hidden = sel() !== 'new'; });
    const num = $('#cfNum', el); num.oninput = () => { num.value = num.value.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 '); };
    const ex = $('#cfExp', el); ex.oninput = () => { const d = ex.value.replace(/\D/g, '').slice(0, 4); ex.value = d.length > 2 ? d.slice(0, 2) + ' / ' + d.slice(2) : d; };
    const pay = (method) => { const b = $('#cfPay', el); b.disabled = true; b.innerHTML = '<span class="cf-spin"></span>Processing…';
      setTimeout(() => { const r = RZBackend.checkout({ amount, method }); if (!r.ok) { err(r.msg); b.disabled = false; b.textContent = `Pay ${fmtUSD(tot)}`; return; } onPaid(r.payment); }, 650); };
    $$('[data-xp]', el).forEach(b => b.onclick = () => pay({ label: b.dataset.xp }));
    $('#cfPay', el).onclick = () => { const s = sel();
      if (s && s !== 'new') { const m = saved.find(x => x.id === s); return pay({ label: `${m.brand} •••• ${m.last4}` }); }
      const n = num.value.replace(/\s/g, ''), e = ex.value.replace(/\D/g, ''), cvc = $('#cfCvc', el).value, zip = $('#cfZip', el).value;
      if (!/^\d{15,16}$/.test(n) || !luhn(n)) return err('Enter a valid card number'); if (!/^(0[1-9]|1[0-2])\d{2}$/.test(e)) return err('Enter the expiration as MM / YY');
      if (!/^\d{3,4}$/.test(cvc)) return err('Enter the CVC'); if (!/^\d{5}$/.test(zip)) return err('Enter your billing ZIP');
      const brand = /^4/.test(n) ? 'Visa' : /^5[1-5]|^2[2-7]/.test(n) ? 'Mastercard' : /^3[47]/.test(n) ? 'Amex' : 'Card';
      const m = { brand, last4: n.slice(-4), exp: e.slice(0, 2) + '/' + e.slice(2) }; if ($('#cfSave', el).checked) RZBackend.addMethod(m); // PROD: Coinflow tokenizes; we only keep brand/last4
      pay({ label: `${brand} •••• ${m.last4}` }); };
  },
};
function luhn(n) { let s = 0; for (let i = 0; i < n.length; i++) { let d = +n[n.length - 1 - i]; if (i % 2) { d *= 2; if (d > 9) d -= 9; } s += d; } return s % 10 === 0; }
const Funds = {
  PRESETS: [10, 25, 50, 100],
  open(o = {}) { if (RG.cooling()) return RG.blocked(); const need = o.need > 0 ? o.need : 0;
    const K = window.RZ_COMPLIANCE.DEPOSIT, min = Math.max(5, K.MIN || 5);
    let amt = need ? Math.max(min, Math.ceil(need)) : o.amount || 25; this.amt = amt; this.pack = o.pack || null;
    $('#sheet').classList.add('top', 'fx');
    sheet(`<div class="fs"><div class="fs-h"><h2>Add funds</h2>${tmTag()}<button class="fs-x" aria-label="Close">✕</button></div>
      ${need ? `<div class="fs-short">You need <b>${fmtUSD(need)}</b> more for the ${fmtPrice(o.pack.price)} ${xe(o.pack.name)} pack</div>` : ''}
      <div class="fs-amt"><span>$</span><input id="fsAmt" inputmode="decimal" value="${amt}" maxlength="7" aria-label="Amount"></div>
      <div class="fs-presets">${(need && !this.PRESETS.includes(amt) ? [amt, ...this.PRESETS] : this.PRESETS).map(a => `<button data-a="${a}" class="${a === amt ? 'on' : ''}">${fmtPrice(a)}</button>`).join('')}</div>
      <small class="fs-msg" id="fsMsg">Min ${fmtUSD(min)} · max ${fmtUSD(K.MAX)} · ${Offer.active() ? `<b class="gold">First deposit ${fmtUSD(CONFIG.OFFER.min)}+ gets a FREE Rare pack</b>` : 'instant · funds packs only'}</small>
      <div id="cfMount"></div>
      <p class="fs-fine">Deposits buy packs and can't be withdrawn. Sell-back cash is withdrawable. <a href="#" data-nav="terms">Terms</a></p></div>`);
    $('.fs-x').onclick = () => { closeSheet(); };
    const inp = $('#fsAmt'), mount = () => { const a = parseAmt(inp.value), m = $('#fsMsg');
      if (isNaN(a) || a < min || a > K.MAX) { m.textContent = isNaN(a) ? 'Enter an amount' : a < min ? `Minimum is ${fmtUSD(min)}` : `Maximum is ${fmtUSD(K.MAX)}`; m.classList.add('err'); $('#cfMount').classList.add('off'); return; }
      m.classList.remove('err'); $('#cfMount').classList.remove('off'); this.amt = a;
      CoinflowMock.mount($('#cfMount'), { amount: a, onPaid: pmt => this.paid(pmt) }); };
    inp.oninput = () => { inp.value = inp.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').replace(/(\.\d{2}).+/, '$1'); $$('.fs-presets button').forEach(b => b.classList.toggle('on', +b.dataset.a === parseAmt(inp.value))); mount(); };
    $$('.fs-presets button').forEach(b => b.onclick = () => { inp.value = b.dataset.a; inp.oninput(); buzz(6); });
    mount();
  },
  paid(pmt) { const a = pmt.amount; if (!RG.allowDeposit(a)) return; const deal = Offer.active() && a >= CONFIG.OFFER.min;
    S.bal = r2(S.bal + a); addTx('deposit', a, `Deposit · ${pmt.method}${TESTMODE() ? ' (test)' : ''}`); RG.deposited(a); if (deal) { grantPacks(CONFIG.OFFER.packs); S.offer.bought = true; } save(); renderWallet(true); renderPackInfo();
    const p = this.pack;
    sheet(`<div class="fs fs-ok"><div class="fs-check">✓</div><h2>${fmtUSD(a)} added</h2>${tmTag()}
      <div class="cf-sum rc"><div><span>Paid with</span><b>${xe(pmt.method)}</b></div><div><span>Amount</span><b>${fmtUSD(a)}</b></div><div><span>Fee</span><b>${pmt.fee ? fmtUSD(pmt.fee) : 'Free'}</b></div>${deal ? `<div><span>Welcome deal</span><b class="gold">+ ${packTxt(CONFIG.OFFER.packs)}</b></div>` : ''}<div><span>Receipt</span><b class="mono">${pmt.id.slice(-12)}</b></div><div class="t"><span>Balance</span><b>${fmtUSD(spendable())}</b></div></div>
      ${p && canAfford(p) ? `<button class="cta cash" id="fsRip">Rip ${fmtPrice(p.price)} ${xe(p.name)} now</button>` : ''}<button class="cta ghost" id="fsDone">Done</button></div>`);
    buzz([15, 30, 15]); $('#fsDone').onclick = closeSheet; const r = $('#fsRip'); if (r) r.onclick = () => { closeSheet(); setTimeout(() => startRip(p), 200); };
  },
};
const KYC = { // Footprint-style onboarding (ID + selfie + 18+). PROD: @onefootprint/footprint-js open({ kind: 'verify', publicKey: RZ_CONFIG.KYC.playbookKey, onComplete: validationToken => server /kyc/complete })
  ok() { return RZBackend.kyc().status === 'verified'; },
  need(why, then) { if (this.ok()) return then(); this.then = then; this.why = why; this.step(0); },
  frame(n, html) { $('#sheet').classList.add('top', 'fx'); sheet(`<div class="fs kyc"><div class="fs-h"><h2>Verify your identity</h2>${tmTag()}<button class="fs-x" aria-label="Close">✕</button></div>
    <div class="kyc-steps">${['Details', 'Photo ID', 'Selfie', 'Done'].map((t, i) => `<i class="${i < n ? 'd' : i === n ? 'on' : ''}">${t}</i>`).join('')}</div>${html}
    <div class="cf-foot">🛡️ Secured by <b>Footprint</b> · your ID is encrypted and never stored by RipZone</div></div>`); $('.fs-x').onclick = closeSheet; },
  step(n) { const g = Gate.v || {};
    if (n === 0) { this.frame(0, `<p class="fs-sub">Required ${xe(this.why || 'before shipping cards or withdrawing cash')}. Takes about 2 minutes.</p>
      <label class="cf-f"><span>Legal first and last name</span><input id="kName" autocomplete="name" placeholder="Jane Doe" value="${xe(S.addr?.name || '')}"></label>
      <label class="cf-f"><span>Date of birth</span><input id="kDob" type="date" value="${xe(g.dob || '')}"></label>
      <label class="cf-f"><span>SSN (last 4)</span><input id="kSsn" inputmode="numeric" maxlength="4" placeholder="1234"></label>
      <small class="cf-err" id="kErr"></small><button class="cf-pay" id="kGo">Continue</button>`);
      $('#kGo').onclick = () => { const nm = $('#kName').value.trim(), d = $('#kDob').value, ss = $('#kSsn').value;
        if (nm.split(/\s+/).length < 2) return $('#kErr').textContent = 'Enter your legal first and last name'; if (!d) return $('#kErr').textContent = 'Enter your date of birth';
        if (Gate.age(d) < (window.RZ_COMPLIANCE.MIN_AGE || 18)) return $('#kErr').textContent = 'You must be 18 or older'; if (!/^\d{4}$/.test(ss)) return $('#kErr').textContent = 'Enter the last 4 of your SSN';
        this.d = { name: nm, dob: d }; this.step(1); }; }
    if (n === 1) { this.frame(1, `<p class="fs-sub">Scan the front and back of a driver's license, state ID or passport.</p>
      <div class="kyc-cap"><button data-s="f"><b>🪪</b>Front of ID<small>Tap to scan</small></button><button data-s="b"><b>🔄</b>Back of ID<small>Tap to scan</small></button></div>
      <button class="cf-pay" id="kGo" disabled>Continue</button>`); const got = {};
      $$('.kyc-cap button').forEach(b => b.onclick = () => { b.classList.add('got'); b.querySelector('small').textContent = 'Captured ✓'; got[b.dataset.s] = 1; $('#kGo').disabled = !(got.f && got.b); buzz(8); });
      $('#kGo').onclick = () => this.step(2); }
    if (n === 2) { this.frame(2, `<p class="fs-sub">Take a quick selfie so we can match it to your ID (liveness check).</p><div class="kyc-face"><div></div></div><button class="cf-pay" id="kGo">Take selfie</button>`);
      $('#kGo').onclick = () => { $('#kGo').innerHTML = '<span class="cf-spin"></span>Checking…'; $('#kGo').disabled = true; setTimeout(() => this.step(3), 1100); }; }
    if (n === 3) { const r = RZBackend.kycComplete(this.d); this.frame(4, `<div class="fs-check">✓</div><h3 class="kyc-ok">You're verified</h3>
      <div class="cf-sum rc"><div><span>Name</span><b>${xe(r.name)}</b></div><div><span>Age check</span><b>18+ ✓</b></div><div><span>ID + selfie</span><b>Matched ✓</b></div><div><span>Reference</span><b class="mono">${r.fpId.slice(-10)}</b></div></div>
      <button class="cf-pay" id="kGo">Continue</button>`); $('#kGo').onclick = () => { closeSheet(); const t = this.then; this.then = null; t && setTimeout(t, 250); }; }
  },
};
const Withdraw = {
  today() { const d = dayKey(); if (!S.wd || S.wd.day !== d) S.wd = { day: d, total: 0 }; return S.wd; },
  open() { KYC.need('to withdraw your sell-back balance', () => this.show()); },
  show() { const W = RZ_CONFIG.WITHDRAW, cash = S.cash || 0, left = r2(W.DAILY_CAP - this.today().total), max = r2(Math.max(0, Math.min(cash, left)));
    $('#sheet').classList.add('top', 'fx');
    sheet(`<div class="fs"><div class="fs-h"><h2>Withdraw</h2>${tmTag()}<button class="fs-x" aria-label="Close">✕</button></div>
      <div class="wd-av"><small>Withdrawable sell-back balance</small><b>${fmtUSD(cash)}</b><em>Deposits and promo credit can't be withdrawn · today's limit left ${fmtUSD(left)}</em></div>
      <div class="fs-amt"><span>$</span><input id="wdAmt" inputmode="decimal" value="${max >= W.MIN ? max.toFixed(2) : ''}" placeholder="0.00" maxlength="8"></div>
      <div class="fs-presets">${max >= W.MIN ? `<button data-a="${max}">Max</button>` : ''}${[25, 50, 100].filter(a => a <= max).map(a => `<button data-a="${a}">${fmtPrice(a)}</button>`).join('')}</div>
      <div class="wd-sp"><label><input type="radio" name="wdsp" value="instant" checked><span><b>⚡ Instant to debit card</b><small>Within minutes · ${fmtUSD(W.INSTANT_FEE)} fee</small></span></label>
        <label><input type="radio" name="wdsp" value="standard"><span><b>🏦 Standard bank transfer</b><small>1–3 business days · Free</small></span></label></div>
      <div class="cf-sum" id="wdSum"></div><small class="cf-err" id="wdErr"></small>
      <button class="cf-pay" id="wdGo">Withdraw</button><div class="cf-foot">🔒 Paid out by <b>Coinflow</b> · min ${fmtUSD(W.MIN)} · ${fmtUSD(W.DAILY_CAP)}/day</div></div>`);
    $('.fs-x').onclick = closeSheet; const inp = $('#wdAmt');
    const upd = () => { const a = parseAmt(inp.value) || 0, sp = $('input[name=wdsp]:checked').value, fee = sp === 'instant' ? W.INSTANT_FEE : 0;
      const g = $('#wdGo'), why = a <= 0 ? (max < W.MIN ? `Sell a card back to withdraw · minimum ${fmtUSD(W.MIN)}` : 'Enter an amount') : a < W.MIN ? `Minimum withdrawal is ${fmtUSD(W.MIN)}` : a > max ? `You can withdraw up to ${fmtUSD(max)} today` : '';
      g.disabled = !!why; g.textContent = why || `Withdraw ${fmtUSD(Math.max(0, a - fee))}`;
      $('#wdSum').innerHTML = `<div><span>Amount</span><b>${fmtUSD(a)}</b></div><div><span>Fee</span><b>${fee ? fmtUSD(fee) : 'Free'}</b></div><div class="t"><span>You receive</span><b>${fmtUSD(Math.max(0, a - fee))}</b></div>`; };
    inp.oninput = upd; $$('input[name=wdsp]').forEach(r => r.onchange = upd); $$('.fs-presets button').forEach(b => b.onclick = () => { inp.value = (+b.dataset.a).toFixed(2); upd(); }); upd();
    $('#wdGo').onclick = () => { const a = parseAmt(inp.value), sp = $('input[name=wdsp]:checked').value; if (isNaN(a)) return $('#wdErr').textContent = 'Enter an amount';
      const r = RZBackend.withdraw({ amount: a, speed: sp, cash: S.cash || 0, todayTotal: this.today().total }); if (!r.ok) return $('#wdErr').textContent = r.msg;
      S.cash = r2(S.cash - a); this.today().total = r2(this.today().total + a); addTx('withdraw', -a, `Withdrawal · ${sp === 'instant' ? 'instant debit' : 'bank'}${TESTMODE() ? ' (test)' : ''}`); save(); renderWallet(true);
      const w = r.withdrawal; sheet(`<div class="fs fs-ok"><div class="fs-check">✓</div><h2>${fmtUSD(w.net)} on its way</h2>${tmTag()}<div class="cf-sum rc"><div><span>Speed</span><b>${sp === 'instant' ? 'Instant' : 'Standard'}</b></div><div><span>Arrives</span><b>${w.eta}</b></div><div><span>Fee</span><b>${w.fee ? fmtUSD(w.fee) : 'Free'}</b></div><div><span>Reference</span><b class="mono">${w.id.slice(-12)}</b></div></div><button class="cta ghost" id="fsDone">Done</button></div>`); $('#fsDone').onclick = closeSheet; };
  },
};
function renderWalletCard() {
  const v = collValue(), k = RZBackend.kyc();
  $('#walletBal').textContent = fmtUSD(spendable()); const wd = $('#walletDep'), wc = $('#walletCred'), wk = $('#walletCash'); if (wd) wd.textContent = fmtUSD(S.bal); if (wc) wc.textContent = fmtUSD(S.credit || 0); if (wk) wk.textContent = fmtUSD(S.cash || 0);
  $('#walletSub').textContent = `Vault: ${S.coll.length} card${S.coll.length === 1 ? '' : 's'} · ${fmtUSD(v.m)} market · ${fmtUSD(v.b)} sell-back value`;
  const kb = $('#kycRow'); if (kb) kb.innerHTML = k.status === 'verified' ? `<span class="ok">✓ Identity verified</span>` : `<button class="lnk" id="kycGo">Verify identity →</button><small>needed to ship or withdraw</small>`;
  const kg = $('#kycGo'); if (kg) kg.onclick = () => KYC.need('to ship cards and withdraw', renderWalletCard);
  $('#txList').innerHTML = S.tx.length ? S.tx.slice(0, 15).map(t => `<div class="tx ${t.amt >= 0 ? 'pos' : 'neg'}"><span><b>${xe(t.label)}</b><small>${new Date(t.t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></span><b>${t.amt >= 0 ? '+' : ''}${fmtUSD(t.amt)}</b></div>`).join('') : '<div class="muted small">No activity yet.</div>';
}
function renderStore() { $('#bundles').innerHTML = Offer.banner(); renderWalletCard(); }
function parseAmt(v) { v = String(v).trim().replace(/[$,\s]/g, ''); if (!/^\d+(\.\d{1,2})?$/.test(v)) return NaN; return r2(+v); }
$('#bundles').addEventListener('click', e => { if (e.target.closest('#ofBanner')) return Offer.show(); });
$('#addFundsBtn').addEventListener('click', () => Funds.open());
$('#balChip').addEventListener('click', () => { buzz(6); Funds.open(); });
$('#withdrawBtn').addEventListener('click', () => Withdraw.open());
function deposit(a, deal) { S.bal = r2(S.bal + a); addTx('deposit', a, 'Deposit'); RG.deposited(a); if (deal) { grantPacks(CONFIG.OFFER.packs); S.offer.bought = true; } save(); }
/* ---------- Ship to me: address form (demo; a fulfilment/shipping vendor plugs in here) ---------- */
const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
function shipForm(done) {
  if (!KYC.ok()) return KYC.need('before we ship your cards', () => shipForm(done));
  const a = S.addr || { name: '', line1: '', line2: '', city: '', state: Gate.state() || '', zip: '' };
  $('#sheet').classList.add('top');
  sheet(`<h2 style="text-align:center">📦 Ship to me</h2><p class="muted" style="text-align:center">Your real card ships from inventory. Flat ${fmtUSD(CONFIG.SHIP_FEE)} shipping per request (demo: not charged).</p>
    <div class="addr-form"><input id="adName" placeholder="Full name" autocomplete="name" value="${xe(a.name)}"><input id="adL1" placeholder="Street address" autocomplete="address-line1" value="${xe(a.line1)}"><input id="adL2" placeholder="Apt, suite (optional)" autocomplete="address-line2" value="${xe(a.line2)}">
      <div class="addr-row"><input id="adCity" placeholder="City" autocomplete="address-level2" value="${xe(a.city)}"><select id="adState">${['', ...US_STATES].map(s => `<option${s === a.state ? ' selected' : ''}>${s}</option>`).join('')}</select><input id="adZip" placeholder="ZIP" inputmode="numeric" maxlength="10" value="${xe(a.zip)}"></div></div>
    <small class="dep-msg" id="adMsg">Status after submitting: <b>Requested</b> → Packed → Shipped (fulfilment not connected in this demo)</small>
    <div class="row2"><button class="cta ghost" id="adNo">Cancel</button><button class="cta" id="adYes">Request shipping</button></div>`);
  $('#adNo').onclick = closeSheet;
  $('#adYes').onclick = () => { const v = id => $('#' + id).value.trim(), n = { name: v('adName'), line1: v('adL1'), line2: v('adL2'), city: v('adCity'), state: v('adState'), zip: v('adZip') };
    if (!n.name || !n.line1 || !n.city || !n.state || !/^\d{5}(-\d{4})?$/.test(n.zip)) { $('#adMsg').textContent = 'Please fill in name, street, city, state and a valid ZIP'; $('#adMsg').classList.add('err'); return; }
    S.addr = n; const ser = S.coll.filter(q => q.ship && q.serial && !q.shipped).map(q => q.serial); if (ser.length) { RZBackend.ship(ser, n); S.coll.forEach(q => { if (q.ship && q.serial) q.shipped = Date.now(); }); applyStock(); } save(); closeSheet(); done(); };
}
/* ---------- Onboarding gate: 18+ / DOB, state eligibility, ID verification placeholder (config: js/compliance-config.js) ---------- */
const dobPicker = () => { const y = new Date().getFullYear(), M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `<div class="dob-row"><select id="dobM" class="auth-in" aria-label="Month"><option value="">Month</option>${M.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('')}</select><select id="dobD" class="auth-in" aria-label="Day"><option value="">Day</option>${Array.from({ length: 31 }, (_, i) => `<option>${i + 1}</option>`).join('')}</select><select id="dobY" class="auth-in" aria-label="Year"><option value="">Year</option>${Array.from({ length: 100 }, (_, i) => `<option>${y - 13 - i}</option>`).join('')}</select></div>`; };
const dobVal = n => { const m = +$('#dobM', n).value, d = +$('#dobD', n).value, y = +$('#dobY', n).value; if (!m || !d || !y) return ''; const dt = new Date(y, m - 1, d); if (dt.getMonth() !== m - 1) return ''; return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; };
const Gate = {
  K: 'rz.gate.v1', get v() { try { return JSON.parse(localStorage.getItem(this.K)) || null; } catch (e) { return null; } },
  state() { return this.v?.state || ''; }, passed() { return !!this.v?.ok; },
  age(d) { const b = new Date(d + 'T00:00:00'), n = new Date(); let y = n.getFullYear() - b.getFullYear(); if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) y--; return y; },
  show() { if (this.passed() || /[?&]nogate/.test(location.search)) return; const g = document.createElement('div'); g.id = 'gate'; document.body.appendChild(g); this.g = g; this.step2(); }, // v0.11.1: DOB/18+ is asked once, on the Create-profile screen; the gate only asks location
  frame(html) { this.g.innerHTML = `<div class="gate-card"><img src="img/brand/logo-icon.webp" alt="" class="gate-logo">${html}<div class="gate-legal"><a href="#" data-doc="terms">Terms</a> · <a href="#" data-doc="privacy">Privacy</a> · <a href="#" data-doc="rg">Responsible Use</a> · <a href="#" data-doc="support">Support</a></div></div>`; },
  step1() { const C = window.RZ_COMPLIANCE;
    this.frame(`<h2>Welcome to RipZone</h2><p class="muted">You must be ${C.MIN_AGE}+ to open packs.</p><label class="gate-l" for="gDob">Date of birth</label><input type="date" id="gDob" class="gate-in" max="${new Date().toISOString().slice(0, 10)}">
      <label class="gate-chk"><input type="checkbox" id="g18"> I confirm I am ${C.MIN_AGE} or older and agree to the Terms</label><small class="dep-msg" id="gMsg"></small><button class="cta" id="gNext">Continue</button>`);
    $('#gNext').onclick = () => { const d = $('#gDob').value, m = $('#gMsg'); if (!d) { m.textContent = 'Enter your date of birth'; m.classList.add('err'); return; } if (this.age(d) < C.MIN_AGE) { this.frame(`<h2>Sorry</h2><p class="muted">RipZone is only for people ${C.MIN_AGE} and older.</p>`); return; } if (!$('#g18').checked) { m.textContent = `Please confirm you are ${C.MIN_AGE}+`; m.classList.add('err'); return; } this.dob = d; this.step2(); }; },
  step2() { const C = window.RZ_COMPLIANCE;
    this.frame(`<h2>Where are you located?</h2><p class="muted">Pack availability depends on your state. You'll confirm your age when you create your profile, and verify your ID before your first purchase.</p><select id="gState" class="gate-in"><option value="">Select your state</option>${US_STATES.map(s => `<option>${s}</option>`).join('')}</select><small class="dep-msg" id="gMsg"></small><button class="cta" id="gNext">Continue</button>`);
    $('#gState').onchange = e => { const s = e.target.value, m = $('#gMsg'); m.classList.remove('err'); m.textContent = C.REVIEW_STATES.includes(s) ? `${s}: available, under legal review (terms may change)` : ''; };
    $('#gNext').onclick = () => { const s = $('#gState').value; if (!s) return; if (C.BLOCKED_STATES.includes(s)) { this.frame(`<h2>Not available in ${s} yet</h2><p class="muted">RipZone pack openings aren't offered in your state. We'll let you know if that changes.</p><button class="cta ghost" id="gBack">Change state</button>`); $('#gBack').onclick = () => this.step2(); return; } this.st = s; this.done(); }; },
  step3() { const C = window.RZ_COMPLIANCE;
    this.frame(`<h2>Verify identity</h2><div class="kyc-ph"><b>🪪 ID verification</b><small>powered by Footprint</small></div><p class="muted">Before your first purchase you'll verify you're 18+ with a government ID and selfie (Footprint). In test mode the check is simulated.</p><button class="cta" id="gNext">Continue</button>`);
    $('#gNext').onclick = () => this.done(); },
  done() { { localStorage.setItem(this.K, JSON.stringify({ ok: true, dob: this.dob || '', state: this.st, at: Date.now(), kyc: 'pending-demo' })); anim(this.g, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).finished?.then(() => this.g.remove()); setTimeout(() => this.g && this.g.remove(), 400); }; },
};

function renderSound() { const t = $('#soundTxt'); if (t) t.textContent = `Sound: ${S.sound ? 'On' : 'Muted'}`; const m = $('#musicTxt'); if (m) m.textContent = `Music: ${S.music !== false ? 'On' : 'Off'}`; const f = $('#fxTxt'); if (f) f.textContent = `Sound effects: ${S.fx !== false ? 'On' : 'Off'}`; $$('#musicBtn,#fxBtn').forEach(b => b.classList.toggle('dim', !S.sound)); $$('[data-mute]').forEach(mu => { mu.textContent = S.sound ? '🔊' : '🔇'; mu.setAttribute('aria-label', S.sound ? 'Mute sound' : 'Unmute sound'); }); const k = $('#spinTxt'); if (k) k.textContent = `Pack picker: ${S.picker !== false ? 'On' : 'Off'}`; }
$('#spinBtn').addEventListener('click', () => { S.picker = S.picker === false; save(); renderSound(); buzz(6); });
$('#soundBtn').addEventListener('click', () => { S.sound = !S.sound; save(); renderSound(); SFX.setMuted(!S.sound); buzz(6); });
$('#musicBtn').addEventListener('click', () => { S.music = S.music === false; save(); renderSound(); if (S.music === false) SFX.suspenseStop && SFX.suspenseStop(); buzz(6); });
$('#fxBtn').addEventListener('click', () => { S.fx = S.fx === false; save(); renderSound(); buzz(6); });
document.addEventListener('click', e => { if (!e.target.closest('[data-mute]')) return; e.stopPropagation(); S.sound = !S.sound; save(); renderSound(); if (S.sound) SFX.unlock(); SFX.setMuted(!S.sound); buzz(6); });
document.addEventListener('pointerdown', () => SFX.unlock(), { once: true, passive: true, capture: true }); // unlock + decode on first tap
$('#resetBtn').addEventListener('click', () => { if (!confirm('Reset all demo data?')) return; S = freshState(); save(); RZBackend.resetAll && RZBackend.resetAll(); location.reload(); });

/* ---------- live big-pulls ticker (simulated community feed + your own Epic/Legendary pulls) ---------- */
const Ticker = (() => {
  const NAMES = ['KaiRips', 'Mewtwoo', 'NeonNate', 'PullQueen', 'HoloHank', 'Zapdos99', 'LunaTCG', 'SnorlaxSam', 'GoldenGus', 'RipCity', 'VaultVic', 'ChaseChloe', 'FoilFrank', 'Dex_Dana', 'ShinyShay'];
  const mask = n => n.slice(0, 3) + '***';
  const q = []; let timer = 0;
  function gen() {
    const cat = rnd() < .5 ? S.cat : CATS[Math.floor(rnd() * CATS.length)].id;
    const big = rnd() < .35 ? 'legendary' : 'epic', pool = CAT_TIER[cat][big].slice().sort((x, y) => y.value - x.value);
    const c = pool[Math.floor(Math.pow(rnd(), 1.6) * pool.length * .6)];
    const fit = ALL_PACKS.filter(q => q.cat === cat && q.price * 2 <= c.value && q.pool && packOk(q)), pk = fit.length ? fit[Math.floor(rnd() * fit.length)].name : ALL_PACKS.find(q => q.cat === cat).name; // a pack this pull would be a 2x+ hit in
    return { user: mask(NAMES[Math.floor(rnd() * NAMES.length)]), card: c, pack: pk, ago: 1 + Math.floor(rnd() * 40) };
  }
  function html(it) {
    const c = it.card;
    return `<div class="lp-item r-${c.tier}${it.me ? ' me' : ''}"><div class="lp-card${gcls(c)}"><img src="${c.img}" alt="" decoding="async"></div><div class="lp-txt"><span class="tk-val">${fmtUSDs(c.value)}</span><b class="lp-name">${c.name}</b><small><i class="tk-cat">${CAT_BY[c.cat].ico} ${CAT_BY[c.cat].name}</i> · ${it.pack}</small><small class="lp-user${it.me ? ' me' : ''}">${it.user}${it.me || !it.ago ? ' · just now' : ` · ${it.ago}m ago`}</small></div></div>`;
  }
  let items = [], track = null, pending = false, anim0 = null;
  function render() { // two identical copies -> seamless translate3d(-50%) marquee (compositor-only)
    const h = items.map(html).join(''); track.innerHTML = h + h;
    anim0?.cancel(); const dur = items.length * 3000;
    anim0 = reduceMotion ? null : track.animate([{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(-50%,0,0)' }], { duration: dur, iterations: Infinity, easing: 'linear' });
    if (anim0) anim0.onfinish = null;
    $('#pfCount').textContent = `${items.length + 1240 + (S.stats.opened || 0)} packs ripped today`;
  }
  function tick() { // every loop boundary, refresh the newest pulls (no visible jump: swap happens at offset 0)
    if (document.hidden || $('#stage').classList.contains('open') || !$('#view-shop').classList.contains('active')) return;
    if (!anim0) return; const t = anim0.currentTime % anim0.effect.getTiming().duration;
    if (pending || t < 400) { if (q.length || pending) { while (q.length) items.unshift(q.shift()); items = items.slice(0, 14); pending = false; render(); const f = track.firstElementChild; f && f.animate([{ opacity: 0, transform: 'translate3d(0,10px,0) scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.9,.3,1.3)' }); } }
  }
  return {
    start() { track = $('#pfTrack'); items = Array.from({ length: 12 }, gen).sort((a, b) => a.ago - b.ago); items.forEach(it => { const im = new Image(); im.src = it.card.img; }); render(); clearInterval(timer); timer = setInterval(() => { if (q.length < 3 && rnd() < .025) q.push(Object.assign(gen(), { ago: 0 })); tick(); }, 300); },
    push(it) { q.unshift(it); pending = true; },
    get items() { return items; },
  };
})();

/* ---------- referrals (mock: no backend). Rewards are modest USD credit or free packs. ---------- */
function renderRefer() {
  const r = S.ref, n = r.friends.length, next = REF.milestones.find(m => !r.milestones.includes(m.n)), need = REF.perFriend.afterPacks;
  const link = `https://ripzone.example/r/${r.code}`, msTxt = m => [m.usd ? '+' + fmtUSD(m.usd) + ' credit' : '', packTxt(m.packs)].filter(Boolean).join(' + ');
  $('#referBody').innerHTML = `
    <div class="ref-hero"><div class="muted small">YOUR INVITE CODE</div><div class="ref-code" id="refCode">${r.code}</div>
      <div class="ref-link">${link}</div>
      <div class="row2"><button class="cta ghost" id="refCopy">🔗 Copy link</button><button class="cta" id="refShare">↗ Share</button></div></div>
    <div class="ref-rewards">
      <div><b>You get</b><span class="big-usd">${fmtUSD(REF.perFriend.usd)}</span><small>credit per friend, once they open ${need} paid packs</small></div>
      <div><b>They get</b><span class="big-usd">${packTxt(REF.newUser.packs).replace(/^1 /, '')}</span><small>welcome gift when they use your code</small></div>
    </div>
    <div class="ref-stats"><div class="tot"><small>Friends</small><b>${n}</b></div><div class="tot cash"><small>Credit earned</small><b>${fmtUSD(r.earned)}</b></div><div class="tot"><small>Qualified</small><b>${r.friends.filter(f => f.paid).length}</b></div></div>
    <div class="ref-ms">${REF.milestones.map(m => { const done = r.milestones.includes(m.n);
      return `<div class="ms-row ${done ? 'done' : ''}"><span class="ms-n">${done ? '✓' : m.n}</span><span class="ms-t"><b>${m.n} friends</b><small>${msTxt(m)}</small></span>
        <span class="ms-bar"><i style="transform:scaleX(${Math.min(1, n / m.n)})"></i></span></div>`; }).join('')}</div>
    <div class="ref-enter"><div class="muted small">HAVE A FRIEND'S CODE?</div>
      ${r.usedCode ? `<div class="rp-meta">✅ Code ${r.usedCode} applied: ${packTxt(REF.newUser.packs)} added</div>` :
      `<div class="ref-input"><input id="refInput" placeholder="RIP-XXXXX" maxlength="9" autocapitalize="characters" autocomplete="off" value="${xe(new URLSearchParams(location.search).get('ref') || '')}"><button class="cta" id="refApply">Apply</button></div>`}</div>
    ${n ? `<div class="ref-list">${r.friends.slice().reverse().map(f => `<div><span>👤 ${f.name}</span><span class="fpk ${f.packs >= need ? 'ok' : ''}">${Math.min(f.packs, need)}/${need} packs</span><b>${f.paid ? '+' + fmtUSD(REF.perFriend.usd) : 'pending'}</b></div>`).join('')}</div>` : ''}
    <div class="row2"><button class="cta ghost" id="refSim">+ Simulate friend joining</button><button class="cta ghost" id="refAct" ${n ? '' : 'disabled'}>▶ Simulate friends playing</button></div>
    ${next ? '' : '<div class="ref-ms">🏆 All milestones unlocked</div>'}
    <p class="fine">Demo referral program: no backend, so friends are simulated on this device. Credit is paid only after a referred friend opens ${need} paid packs. One welcome code per account, and you can't use your own code. Multi-accounting voids rewards. Promotional-credit terms to be set by counsel.</p>`;
  $('#refCopy').onclick = async () => { try { await navigator.clipboard.writeText(link); toast('Invite link copied'); } catch { toast(link); } buzz(8); };
  $('#refShare').onclick = async () => { const d = { title: 'RipZone', text: `Rip real card packs with me on RipZone. Use my code ${r.code} for a free ${baseName(Object.keys(REF.newUser.packs)[0])} pack!`, url: link };
    if (navigator.share) { try { await navigator.share(d); } catch {} } else { try { await navigator.clipboard.writeText(d.text + ' ' + link); } catch {} toast('Share text copied'); } };
  const ap = $('#refApply'); if (ap) ap.onclick = () => applyRefCode($('#refInput').value);
  $('#refSim').onclick = simulateFriend; $('#refAct').onclick = simulateFriendActivity;
}
function applyRefCode(raw) {
  const code = (raw || '').trim().toUpperCase();
  if (!/^RIP-[A-Z0-9]{5}$/.test(code)) return toast('Codes look like RIP-7KQ2X');
  if (code === S.ref.code) return toast("You can't use your own code");
  if (S.ref.usedCode) return toast('A code was already applied');
  S.ref.usedCode = code; grantPacks(REF.newUser.packs); save(); claimFX($('#refApply'), 0); renderPackInfo();
  toast(`🎉 Welcome gift: ${packTxt(REF.newUser.packs)}`); setTimeout(renderRefer, 520);
}
function payMilestones() {
  const r = S.ref; let usd = 0;
  for (const m of REF.milestones) if (r.friends.length >= m.n && !r.milestones.includes(m.n)) { r.milestones.push(m.n); if (m.usd) usd += credit(m.usd, `Referral milestone · ${m.n} friends`, 'referral'); grantPacks(m.packs); toast(`🏆 ${m.n} friends! ${[m.usd ? '+' + fmtUSD(m.usd) : '', packTxt(m.packs)].filter(Boolean).join(' + ')}`); }
  return usd;
}
function simulateFriend() {
  const r = S.ref, nm = ['Alex', 'Sam', 'Jordan', 'Riley', 'Casey', 'Morgan', 'Taylor', 'Jamie', 'Drew', 'Quinn'][r.friends.length % 10] + ' ' + String.fromCharCode(65 + Math.floor(rnd() * 26)) + '.';
  r.friends.push({ name: nm, t: Date.now(), packs: 0, paid: false });
  const usd = payMilestones(); r.earned = r2(r.earned + usd); save(); claimFX($('#refSim'), usd); renderPackInfo();
  toast(`${nm} joined with your code · ${fmtUSD(REF.perFriend.usd)} unlocks after ${REF.perFriend.afterPacks} packs`); setTimeout(renderRefer, 520);
}
function simulateFriendActivity() { // each friend opens 1-3 packs; credit pays once a friend reaches the pack threshold
  const r = S.ref; let usd = 0;
  for (const f of r.friends) { f.packs += 1 + Math.floor(rnd() * 3); if (!f.paid && f.packs >= REF.perFriend.afterPacks) { f.paid = true; usd += credit(REF.perFriend.usd, `Referral · ${f.name}`, 'referral'); } }
  if (usd) { r.earned = r2(r.earned + usd); claimFX($('#refAct'), usd); toast(`+${fmtUSD(usd)} credit: friends reached ${REF.perFriend.afterPacks} packs`); }
  else toast('Friends opened more packs');
  save(); setTimeout(renderRefer, usd ? 520 : 0);
}

/* ---------- first-launch onboarding: 3 scripted PRACTICE rips (nothing charged or credited) + coach marks ---------- */
const TRIALS = [ // pack + the scripted showcase card (USD value range, picked from that category's cards)
  { pack: 'pkm-25', pick: [40, 120] },
  { pack: 'pkm-100', pick: [150, 500] },
  { pack: 'pkm-1000', pick: [1500, 5300] },
];
const Tut = {
  active: false, practice: true, trialN: 0, trialGC: 0, step: null, flags: {},
  get el() { return $('#coach'); },
  trialPending() { return this.active && this.trialN < 3 && this.step === 'shop'; },
  start(replay) {
    if (busy) return;
    this.active = true; this.practice = true; this.replay = !!replay; this.trialN = 0; this.trialGC = 0; this.flags = {};
    nav('shop');
    this.welcome();
  },
  modal(html, cls) {
    const m = $('#onb'); m.getAnimations().forEach(a => a.cancel()); m.className = 'onb on ' + (cls || ''); m.innerHTML = `<div class="onb-card">${html}</div>`;
    anim(m, [{ opacity: 0 }, { opacity: 1 }], { duration: 260 });
    anim($('.onb-card', m), [{ opacity: 0, transform: 'translate3d(0,40px,0) scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.9,.3,1.15)' });
    $$('.onb-stagger > *', m).forEach((e, i) => anim(e, [{ opacity: 0, transform: 'translate3d(0,14px,0)' }, { opacity: 1, transform: 'none' }], { duration: 360, delay: 160 + i * 70 }));
    return m;
  },
  closeModal() { const m = $('#onb'); return anim(m, [{ opacity: 1 }, { opacity: 0 }], { duration: 220 }).then(() => { m.className = 'onb'; m.innerHTML = ''; m.getAnimations().forEach(a => a.cancel()); }); },
  welcome() {
    const m = this.modal(`<div class="onb-coins"><i class="coin usd big"></i><i class="coin usd big"></i><i class="coin usd big"></i></div>
      <div class="onb-stagger"><div class="onb-kick">WELCOME TO</div><h1 class="onb-title">RIPZONE</h1>
      <div class="onb-gift"><div><b>USD</b><small>Every pack priced in dollars<br>every card at market value</small></div><div><b>📦</b><small>Keep, sell back ${BBP()}<br>or ship the real card</small></div></div>
      <p class="onb-p">${this.replay ? 'Replaying the tutorial: 3 practice rips and a quick tour.' : 'Start with <b>3 free practice rips</b>. They are scripted demos with bigger-than-usual hits: nothing is charged and nothing is credited.'}${!this.replay && CONFIG.DEMO_START_USD ? ` This pitch build also gives you a <b>${fmtUSD(CONFIG.DEMO_START_USD)} demo balance</b>.` : ''}</p>
      <button class="cta" id="onbGo">Start practice rips</button><button class="onb-skip" id="onbSkip">Skip tutorial</button>
      <div class="onb-legal">By continuing you confirm you are <b>18+</b> and agree to the <a href="#" data-doc="terms">Terms</a>, <a href="#" data-doc="rules">Pack Rules</a> and <a href="#" data-doc="privacy">Privacy Policy</a>. <a href="#" data-doc="how">How RipZone works</a> · <a href="#" data-doc="rg">Responsible Use</a></div></div>`, 'welcome');
    $$('.onb-coins .coin', m).forEach((c, i) => anim(c, [{ transform: 'translate3d(0,-60px,0) rotate(-30deg)', opacity: 0 }, { transform: `translate3d(${(i - 1) * 34}px,0,0) rotate(${(i - 1) * 12}deg)`, opacity: 1 }], { duration: 600, delay: 120 + i * 90, easing: 'cubic-bezier(.3,1.5,.5,1)' }));
    $('#onbGo').onclick = () => { this.closeModal(); buzz(10); this.toShop(); };
    $('#onbSkip').onclick = () => this.skip();
  },
  toShop() {
    if (S.cat !== 'pkm') setCat('pkm', true);
    const t = TRIALS[this.trialN], i = PACKS.findIndex(p => p.id === t.pack);
    this.step = 'shop'; this.epoch++; nav('shop'); $('#view-shop').scrollTop = 0;
    requestAnimationFrame(() => { measureRail(); snapTo(i); });
    this.later(() => { renderPackInfo(); this.coach('#buyBtn', this.trialN === 0 ? `<b>Practice rip 1 of 3</b>Swipe the carousel to browse packs. Each one shows its USD price, odds and value range. This practice $25 Rare pack is free.` : `<b>Practice rip ${this.trialN + 1} of 3</b>${this.trialN === 1 ? 'A $100 pack this time: bigger hits.' : 'Saving the best for last: a $1,000 Premium pack with a guaranteed floor.'}`); }, 700);
  },
  async startTrial() {
    const t = TRIALS[this.trialN], p = packById(t.pack); this.hide(); this.step = 'rip';
    const [lo, hi] = t.pick, a = CARDS.filter(c => c.cat === p.cat && c.value >= lo && c.value <= hi && !c.graded);
    const c = a[Math.floor(rnd() * a.length)] || rollPack(p, null, 'normal')[0];
    const pulls = [{ id: c.id, uid: S.uid++, decided: null, practice: true, band: bandOf(c, p, 'normal') }];
    busy = true; S.lastPack = p.id; S.pending = { pack: p.id, pulls }; save();
    await Promise.all(pulls.map(x => { const im = new Image(); im.src = BY_ID[x.id].img; return im.decode().catch(() => {}); }));
    openStage(p, pulls);
  },
  epoch: 0,
  later(fn, ms) { const e = this.epoch; setTimeout(() => { if (this.active && e === this.epoch) fn(); }, ms); },
  on(ev, arg) {
    if (!this.active) return;
    const n = this.trialN, f = this.flags;
    if (ev === 'torn' || ev === 'closed') { this.epoch++; this.hide(); }
    if (ev === 'stage') { /* v0.9.16: no coach on the rip step; the only hint is the idle 'Swipe to rip' text */ }
    else if (false) this.later(() => this.step === 'rip' && R && !R.done && this.coach('.rpack .rp-strip', n === 0 ? `<b>Swipe to rip</b>Drag your finger across the top strip to tear the pack open — or just tap the pack.` : `<b>Rip it!</b>Swipe the top strip or tap the pack.`, { place: 'below', below: $('.rpack').getBoundingClientRect().bottom + 18 }), 750);
    else if (ev === 'cards' && n === 0) this.later(() => this.coach('.rslide .flip', `<b>Tap to flip</b>Each pack holds one card. Its glow shows its value against the pack price: Grey, Green, Blue, Purple, Red, Gold.`, { place: 'below' }), 500);
    else if (ev === 'revealed' && !f['kv' + n]) { f['kv' + n] = 1; this.later(() => this.coach('.rp-actions', n === 0 ? `<b>Keep, sell or ship</b><span class="ck">🔐 Keep</span> puts the card in your Vault. <span class="ck">⚡ Sell back</span> pays ${BBP()} of its market price as store credit, instantly. <span class="ck">📦 Ship</span> requests the real card (in real rips).` : `<b>Your call</b>Keep it or sell it back at ${BBP()}.`), 250); }
    else if (ev === 'decided') this.later(() => this.coach('#doneBtn', arg ? `<b>${fmtUSD(arg)} buyback</b>Practice only, so nothing was added. In a real rip this goes straight to your USD balance.` : `<b>Nice!</b>${n < 2 ? 'On to the next practice rip.' : 'Last step: a quick tour.'}`), 350);
    else if (ev === 'closed') { this.hide(); this.trialN++; if (this.trialN < 3) this.toShop(); else this.tour(0); }
  },
  TOUR: [
    ['.wallet', `<b>Your USD balance</b>Packs are paid from this balance and sell-backs land here instantly. Tap it to add funds (demo: no payment is taken).`],
    ['#oddsLink', `<b>Odds before you buy</b>Every pack shows its USD price, odds, value range and floor. Expected card value is ${Math.round(CONFIG.RTP * 100)}% of the price at market value.`],
    ['.tabbar [data-nav="collection"]', `<b>Your Vault</b>Cards you keep live here at today's market price. Sell back any time at ${BBP()}, or request shipping of the real card.`],
    ['.tabbar [data-nav="rewards"]', `<b>Daily streak</b>Small daily credit and a free Starter pack on day 7. Miss a day and it resets.`],
    ['.tabbar [data-nav="more"]', `<b>Invite friends</b>${fmtUSD(REF.perFriend.usd)} credit per friend once they open ${REF.perFriend.afterPacks} packs. Limits, rules and this tutorial live under More.`],
  ],
  tour(i) {
    this.step = 'tour'; this.epoch++; if (i === 0) { nav('shop'); $('#view-shop').scrollTop = 0; }
    if (i >= this.TOUR.length) return this.finish();
    const [sel, html] = this.TOUR[i];
    this.coach(sel, html + `<div class="c-nav"><span class="c-dots">${this.TOUR.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</span><button class="c-next" id="cNext">${i < this.TOUR.length - 1 ? 'Next' : 'Finish'} →</button></div>`);
    $('#cNext').onclick = () => { buzz(6); this.tour(i + 1); };
  },
  finish() {
    this.hide();
    const m = this.modal(`<div class="onb-stagger"><div class="onb-trophy">🏆</div><h1 class="onb-title sm">You're all set!</h1>
      <p class="onb-p">Practice complete${this.trialGC ? ` (your practice sell-backs would have paid ${fmtUSD(this.trialGC)})` : ''}. Your balance was not changed.</p>
      <div class="onb-sum"><div class="otot"><span>USD balance${CONFIG.DEMO_START_USD ? ' (demo)' : ''}</span><b>${fmtUSD(S.bal)}</b></div></div>
      <button class="cta" id="onbDone">Start ripping</button></div>`, 'finish');
    setTimeout(() => { const r = $('.onb-trophy', m)?.getBoundingClientRect(); if (r) FX.burst(r.left + r.width / 2, r.top + r.height / 2, 120, ['#ffcc33', '#fff3a8', '#ff2bd6', '#00f0ff', '#39ff9f'], 1.2); buzz([20, 40, 20, 40, 60]); }, 380);
    $('#onbDone').onclick = () => { const rep = this.replay; this.end(); this.closeModal(); renderWallet(true); if (!rep && !S.offer) { Offer.start(); setTimeout(() => Offer.show(), 450); } };
  },
  skip() { this.hide(); if ($('#onb').classList.contains('on')) this.closeModal(); this.end(); toast('Tutorial skipped · replay it any time from More'); },
  end() { this.active = false; this.step = null; S.onboarded = true; save(); renderPackInfo(); },
  hide() { const c = this.el; if (!c.classList.contains('on')) return; c.classList.remove('on'); },
  coach(sel, html, o = {}) {
    if (!this.active) return; const t = $(sel); if (!t) return this.hide();
    const c = this.el, r = t.getBoundingClientRect(), pad = 6, H = innerHeight;
    const spot = $('.c-spot', c), tip = $('.c-tip', c);
    spot.style.cssText = `left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px`;
    $('.c-body', c).innerHTML = html;
    $('#cSkip').style.display = this.step === 'tour' ? 'none' : '';
    const below = o.place ? o.place === 'below' : r.top + r.height / 2 < H * .5;
    tip.style.top = ''; tip.style.bottom = '';
    if (below) tip.style.top = Math.min(H - 200, o.below ?? r.bottom + 14) + 'px'; else tip.style.bottom = (H - r.top + 14) + 'px';
    const tl = Math.max(14, (innerWidth - 420) / 2), ax = Math.max(tl + 18, Math.min(innerWidth - tl - 34, r.left + r.width / 2 - 8));
    tip.style.setProperty('--ax', (ax - tl) + 'px'); tip.classList.toggle('up', below); tip.classList.toggle('noarrow', o.below != null);
    c.getAnimations().forEach(a => a.cancel()); c.classList.add('on');
    anim(c, [{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
    anim(tip, [{ opacity: 0, transform: `translate3d(0,${below ? -10 : 10}px,0) scale(.96)` }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
    anim(spot, [{ transform: 'scale(1.2)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 360, easing: 'cubic-bezier(.2,.9,.3,1)' });
  },
};
$('#cSkip').onclick = () => Tut.skip();
$('#replayTut').onclick = () => { if (busy) return toast('Finish your pack first'); Tut.start(true); };

/* ---------- transparency: Odds & Rules sheet, policy docs ---------- */
function showDoc(v) { // open a policy page in a sheet (works above the welcome/auth screens too)
  if (v === 'odds') renderOddsAll(); if (v === 'rg') renderRG();
  const src = $('#view-' + v); if (!src) return;
  const html = src.innerHTML.replace(/<button class="back"[^>]*>.*?<\/button>/, '').replace(/ id="[^"]*"/g, '');
  $('#sheet').classList.add('top');
  sheet(`<div class="doc doc-sheet">${html}</div><button class="cta ghost" id="docClose">Close</button>`);
  $$('#sheetBody [data-nav]').forEach(a => { const t = a.dataset.nav; a.removeAttribute('data-nav'); a.onclick = e => { e.preventDefault(); showDoc(t); }; });
  $('#docClose').onclick = () => { closeSheet(); };
}
document.addEventListener('click', e => { const d = e.target.closest('[data-doc]'); if (d) { e.preventDefault(); showDoc(d.dataset.doc); } });
const _closeSheet0 = closeSheet;
closeSheet = function () { _closeSheet0(); setTimeout(() => $('#sheet').classList.remove('top'), 300); };
function showOdds(p) {
  const m = S.risk, o = oddsFor(p, m), ev = packEV(p, m), typ = typicalRange(p, m), P = poolFor(p, m), D = dist(p, m);
  const nGraded = new Set(D.cs.filter((c, i) => c.graded && D.pr[i] > 1e-12)).size;
  const pc = x => x <= 0 ? '0%' : x < .0001 ? (x * 100).toFixed(4) + '%' : (x * 100).toFixed(2) + '%';
  const rows = bandsFor(m).map(b => { const q = P[b], FR = b === 'gold' ? CONFIG.FIFTY.GOLD_RANGE : CONFIG.FIFTY.SILVER_RANGE, [lo, hi] = m === '5050' ? [FR[0] * p.price, FR[1] * p.price] : b === 'grey' ? [p.minCard, bandRange(b, p)[1]] : bandRange(b, p);
    return `<tr class="b-${b}"><td><b style="color:var(--rc)">${BAND_LABEL[b]}</b><small>${hi === Infinity ? `≥ ${fmtUSDs(lo)}` : lo ? `${fmtUSDs(lo)} – ${fmtUSDs(hi)}` : `under ${fmtUSDs(hi)}`}</small></td><td>${pc(o[b] || 0)}</td><td>${q ? `${fmtUSDs(q.min)}${q.max > q.min ? ' – ' + fmtUSDs(q.max) : ''}<small>avg ${fmtUSDs(q.ev)} · ${q.cs.length} card${q.cs.length > 1 ? 's' : ''}</small>` : '—'}</td></tr>`; }).join('');
  const mrows = RISK_IDS.map(k => { if (!modeOk(p, k)) return `<tr><td><b>${RISK[k].label}</b><small>Not available: ${dist(p, k).why}</small></td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>`; const t = typicalRange(p, k), e = packEV(p, k); return `<tr${k === m ? ' class="on"' : ''}><td><b>${RISK[k].label}</b><small>${RISK[k].desc}</small></td><td>${(e / p.price * 100).toFixed(1)}%</td><td>${rngTxt(t)}</td><td>${pc(atOrAbove(p, k))}</td><td>${pc(chaseP(p, k))}</td><td>${pc(oddsFor(p, k).gold || 0)}</td></tr>`; }).join('');
  const meta = CAT_BY[p.cat].meta, fl = packFloor(p, m);
  sheet(`<h2 style="text-align:center;margin-bottom:2px">${p.name} Pack · Odds &amp; Rules</h2>
    <div class="muted small" style="text-align:center">Category: ${CAT_BY[p.cat].long}${p.cat !== 'pkm' ? ' (beta)' : ''} · ${fmtUSD(p.price)} · one card · risk: ${RISK[m].label}</div>
    <table class="odds-table"><thead><tr><th>Band (vs price)</th><th>Chance</th><th>Card values</th></tr></thead><tbody>${rows}</tbody></table>
    <table class="odds-table risk-table"><thead><tr><th>Value spread</th><th>EV</th><th>Typical card</th><th>≥ price</th><th>${CHASE_X}×+</th><th>Gold</th></tr></thead><tbody>${mrows}</tbody></table>
    <div class="odds-facts">
      <div><span>Price</span><b>${fmtUSD(p.price)}</b></div>
      <div><span>Chance the card is worth the price or more</span><b>${pc(atOrAbove(p, m))}</b></div>
      <div><span>Expected card value (USD market)</span><b class="cashv">${fmtUSD(ev)} · ${(ev / p.price * 100).toFixed(1)}%</b></div>
      <div><span>Expected cash if you sell it back</span><b>${fmtUSD(ev * CONFIG.BUYBACK)} · ${(ev * CONFIG.BUYBACK / p.price * 100).toFixed(1)}%</b></div>
      <div><span>Guaranteed floor (card value, market)</span><b>${fl ? `${fmt(fl)} · ${Math.round(fl / p.price * 100)}%` : m === '5050' ? 'none in 50/50 mode' : 'none on this pack'}</b></div>
      <div><span>Card value range</span><b>${fmt(D.min)} – ${fmt(D.max)}</b></div>
      <div><span>Typical card (5th–95th pct)</span><b>${fmt(typ[0])} – ${fmt(typ[1])} · median ${fmt(typ[2])}</b></div>
      <div><span>Graded (PSA 10) entries possible</span><b>${nGraded}</b></div>
      <div><span>Instant buyback</span><b>${BBP()} of current market value</b></div>
      <div><span>Ship to me</span><b>flat ${fmtUSD(CONFIG.SHIP_FEE)} (demo)</b></div>
    </div>
    <div class="odds-notes">
      <p><b>How odds work.</b> Every pack contains exactly one card. The chances above are exact for the selected value spread. The colour band shows the card's value against the pack price: Grey ${CONFIG.MIN_CARD_X}–${CONFIG.BANDS[1]}× (in 50/50 only Silver and Gold), Green ${CONFIG.BANDS[1]}–${CONFIG.BANDS[2]}×, Blue ${CONFIG.BANDS[2]}–${CONFIG.BANDS[3]}×, Purple ${CONFIG.BANDS[3]}–${CONFIG.BANDS[4]}×, Red ${CONFIG.BANDS[4]}–${CONFIG.BANDS[5]}×, Gold ${CONFIG.BANDS[5]}× or more. In Normal, High and Max the card is always worth at least ${fmt(p.minCard)} (${Math.round(p.minCard / p.price * 100)}% of the price, the floor); the most any card in these modes can be worth is the Max Pull of ${fmt(p.maxVal)} (capped at ${CONFIG.PACK_MAX_X[p.price] ?? 20}× the price, ${fmt(p.maxPull)}); only cards inside this range are in the pack. In Max the lower-value card is also at least ${Math.round(CONFIG.MIN_CARD_X * 100)}% of the price. Normal, High and Max are each solved so the card's expected market value is exactly ${Math.round(CONFIG.RTP * 100)}% of the price. They change the spread, never the expected value. Normal and High use a fixed tier table (value as a multiple of the price): ${tierTxt(p, 'normal')} in Normal, and ${tierTxt(p, 'high')} in High. Within each tier cheaper cards are more likely, and one shared adjustment sets the exact payback. Normal lands about ${pct(atOrAbove(p, 'normal'))} of pulls at or above the price on this pack; High about ${pct(atOrAbove(p, 'high'))}. Max: a Gold top card (worth ${CONFIG.BANDS[5]}× the price or more, about ${CONFIG.MAX.GOLD_X}× on average) with ${dist(p, 'max').ok ? pct(dist(p, 'max').q) : 'a 10%'} chance, otherwise a lower-value card worth from the floor up to the price (about ${CONFIG.MAX.LOSS_X}× on average); payback is exactly ${Math.round(CONFIG.RTP * 100)}%. 50/50 has only two outcomes: GOLD, a real card worth ${CONFIG.FIFTY.GOLD_RANGE[0]}–${CONFIG.FIFTY.GOLD_RANGE[1]}× the price (about ${CONFIG.FIFTY.GOLD_X}×), or SILVER, a card worth ${CONFIG.FIFTY.SILVER_RANGE[0]}–${CONFIG.FIFTY.SILVER_RANGE[1]}× (about ${CONFIG.FIFTY.SILVER_X}×). The Gold chance (about ${pct(CONFIG.FIFTY.P_GOLD)}) is set from the actual card values so the expected return is exactly ${Math.round(FIFTY_RTP() * 100)}%, with no floor. Max and 50/50 draw from the whole category inventory.${CONFIG.OUTLIER_OK_PRICES.includes(p.price) ? ` This pack can also hold cards above ${fmtUSDs(CONFIG.MAX_CARD_USD)} (other packs exclude them).` : ''}${CONFIG.TEST_INVENTORY ? ' <b>TEST INVENTORY:</b> fillers are RipZone demo cards; cards from a public Collectr showcase (@aokiscardhouse) appear only in packs whose range they fit.' : ''}</p>
      <p><b>Values.</b> A card's value is its current US-dollar market price in its listed condition: raw near-mint (ungraded for sports cards), or the graded sold price for PSA slabs. Source: ${p.cat === 'pkm' ? 'TCGplayer market prices via the Pokémon TCG API; PSA 10 entries use PriceCharting PSA 10 prices' : `${xe(meta.source)}. Sets: ${xe(meta.sets.join(', '))}`}. Prices dated ${meta.fetched}. ${p.cat === 'nfl' || p.cat === 'mlb' ? 'Sports cards have no printed rarity, so rarity tiers are set by real ungraded price ($0.75 / $3 / $15 / $75 bands). ' : ''}Each card's own source and date are shown on its detail screen.</p>
      <p><b>Inventory.</b> Pulls are meant to be fulfilled from the operator's physical inventory. In this demo the pool is the bundled price catalog; live stock levels are not connected yet.</p>
      <p><b>When the result is decided.</b> Your card is determined the moment you purchase; animations do not affect the result. The pack picker, tear and sleeve only reveal the stored result, and the card is in your Vault from the moment of purchase.</p>
      <p><b>Practice rips.</b> The 3 tutorial rips are scripted showcases, are free, and never change your balance. They don't use these odds.</p>
    </div>
    <div class="legal-links"><a href="#" data-doc="how">How RipZone works</a> · <a href="#" data-doc="rules">Pack Rules</a> · <a href="#" data-doc="terms">Terms</a> · <a href="#" data-doc="rg">Responsible Use</a><br>18+ · Demo build: no payments, withdrawals or shipments</div>
    <button class="cta ghost" id="oddsClose" style="margin-top:10px">Close</button>`);
  $('#oddsClose').onclick = closeSheet;
}
$('#stageOdds').onclick = () => { const p = REV?.p || R?.p; if (p) showOdds(p); };

/* ---------- Responsible Use: self-set USD limits + cool-off (local mock) ---------- */
const sessionStart = Date.now();
const RG = {
  get s() { return S.rg; },
  today() { const r = this.s, d = dayKey(); if (r.day !== d) { r.day = d; r.spent = 0; r.deposited = 0; } if (r.pending && Date.now() >= r.pending.at) { r[r.pending.field] = r.pending.value; r.pending = null; save(); } return r; },
  cooling() { return this.s.coolUntil > Date.now(); },
  sessionMin() { return (Date.now() - sessionStart) / 60000; },
  blocked() { sheet(`<h2 style="text-align:center">Cool-off active</h2><p class="muted" style="text-align:center">You chose to take a break. Opening packs and adding funds are paused until <b>${new Date(this.s.coolUntil).toLocaleString()}</b>. A cool-off can't be shortened.</p><button class="cta ghost" id="rgOk">OK</button>`); $('#rgOk').onclick = closeSheet; },
  limitSheet(what, used, lim) { sheet(`<h2 style="text-align:center">Daily limit reached</h2><p class="muted" style="text-align:center">You've used ${fmtUSD(used)} of your ${fmtUSD(lim)} daily ${what} limit. It resets at midnight.</p><button class="cta ghost" id="rgOk">OK</button><button class="onb-skip" data-nav="rg" id="rgGo">Manage limits</button>`); $('#rgOk').onclick = closeSheet; $('#rgGo').onclick = closeSheet; },
  allow(price) {
    const r = this.today();
    if (this.cooling()) { this.blocked(); return false; }
    if (r.session && this.sessionMin() >= r.session) { sheet(`<h2 style="text-align:center">Session limit reached</h2><p class="muted" style="text-align:center">You set a ${r.session}-minute session limit. Time for a break: pack opening is paused for this session. Close and reopen the app later to start a new session.</p><button class="cta ghost" id="rgOk">OK</button>`); $('#rgOk').onclick = closeSheet; return false; }
    if (r.spend && r.spent + price > r.spend + 1e-9) { this.limitSheet('pack spending', r.spent, r.spend); return false; }
    return true;
  },
  allowDeposit(a) { const r = this.today(); if (this.cooling()) { this.blocked(); return false; } if (r.deposit && r.deposited + a > r.deposit + 1e-9) { this.limitSheet('deposit', r.deposited, r.deposit); return false; } return true; },
  spend(price) { const r = this.today(); r.spent = r2(r.spent + price); save(); },
  deposited(a) { const r = this.today(); r.deposited = r2(r.deposited + a); },
  set(field, value) { // lowering = immediate; raising/removing = 24h delay
    const r = this.today(), cur = r[field] || 0, v = Math.max(0, field === 'session' ? Math.round(+value || 0) : r2(+value || 0));
    const lower = v > 0 && (cur === 0 || v < cur);
    if (lower || v === cur) { r[field] = v; if (r.pending?.field === field) r.pending = null; toast('Limit updated'); }
    else { r.pending = { field, value: v, at: Date.now() + 864e5 }; toast('Raising or removing a limit takes effect in 24 hours'); }
    save(); renderRG();
  },
  cool(days) { this.s.coolUntil = Date.now() + days * 864e5; save(); renderRG(); renderPackInfo(); toast(`Cool-off started: ${days === 1 ? '24 hours' : days + ' days'}`); },
};
function renderRG() {
  const r = RG.today(), nm = { spend: 'Daily pack spending limit (USD)', deposit: 'Daily deposit limit (USD)', session: 'Session limit (minutes)' };
  const pv = (f, v) => f === 'session' ? v + ' min' : fmtUSD(v);
  const row = (f, used) => `<div class="rg-row"><label for="rg-${f}">${nm[f]}</label><div class="rg-in"><input id="rg-${f}" type="number" inputmode="decimal" min="0" step="${f === 'session' ? 1 : 0.01}" placeholder="No limit" value="${r[f] || ''}"><button class="cta ghost" data-rgset="${f}">Save</button></div>
    <small>${used}${r.pending?.field === f ? ` · change to ${r.pending.value ? pv(f, r.pending.value) : 'no limit'} pending until ${new Date(r.pending.at).toLocaleString()}` : ''}</small></div>`;
  $('#rgBody').innerHTML = `<div class="rg-card">
      ${row('spend', `Spent on packs today: ${fmtUSD(r.spent)}${r.spend ? ' of ' + fmtUSD(r.spend) : ''}`)}
      ${row('deposit', `Added today: ${fmtUSD(r.deposited)}${r.deposit ? ' of ' + fmtUSD(r.deposit) : ''}`)}
      ${row('session', `This session: ${Math.floor(RG.sessionMin())} min`)}
    </div>
    <div class="rg-card"><b>Take a break (cool-off)</b><p class="muted small">Pauses opening packs and adding funds on this device. A cool-off can't be cancelled or shortened.</p>
      ${RG.cooling() ? `<div class="rg-cool">⏸ Cool-off active until <b>${new Date(r.coolUntil).toLocaleString()}</b></div>` : `<div class="rg-cools"><button class="cta ghost" data-cool="1">24 hours</button><button class="cta ghost" data-cool="7">7 days</button><button class="cta ghost" data-cool="30">30 days</button></div>`}</div>
    <div class="rg-card"><b>Permanent self-exclusion</b><p class="muted small">Permanently locks buying packs and adding funds on this account. It can never be undone. You can still ship cards and withdraw your sell-back balance.</p>${RZC.excluded() ? `<div class="rg-cool">🔒 Locked permanently since ${new Date(RZC.excluded().at).toLocaleDateString()}</div>` : `<button class="cta danger" id="selfExBtn">Lock my account permanently</button>`}</div>
    <div class="rg-card">${RZC.help()}</div>`;
  const sx = $('#selfExBtn'); if (sx) sx.onclick = () => RZC.selfExclude();
  $$('[data-rgset]').forEach(b => b.onclick = () => RG.set(b.dataset.rgset, $('#rg-' + b.dataset.rgset).value));
  $$('[data-cool]').forEach(b => b.onclick = () => { const d = +b.dataset.cool; sheet(`<h2 style="text-align:center">Start a ${d === 1 ? '24-hour' : d + '-day'} cool-off?</h2><p class="muted" style="text-align:center">You won't be able to open packs or add funds until ${new Date(Date.now() + d * 864e5).toLocaleString()}. This can't be undone.</p><div class="row2"><button class="cta ghost" id="cNo">Cancel</button><button class="cta" id="cYes">Start cool-off</button></div>`); $('#cNo').onclick = closeSheet; $('#cYes').onclick = () => { closeSheet(); RG.cool(d); }; });
}
setInterval(() => { const r = S.rg; if (r && r.session && !RG.warned && RG.sessionMin() >= r.session) { RG.warned = true; toast(`⏰ You've reached your ${r.session}-minute session limit. Time for a break.`); } }, 30000);

const DIAL = {"AC":"247","AD":"376","AE":"971","AF":"93","AG":"1","AI":"1","AL":"355","AM":"374","AO":"244","AR":"54","AS":"1","AT":"43","AU":"61","AW":"297","AX":"358","AZ":"994","BA":"387","BB":"1","BD":"880","BE":"32","BF":"226","BG":"359","BH":"973","BI":"257","BJ":"229","BL":"590","BM":"1","BN":"673","BO":"591","BQ":"599","BR":"55","BS":"1","BT":"975","BW":"267","BY":"375","BZ":"501","CA":"1","CC":"61","CD":"243","CF":"236","CG":"242","CH":"41","CI":"225","CK":"682","CL":"56","CM":"237","CN":"86","CO":"57","CR":"506","CU":"53","CV":"238","CW":"599","CX":"61","CY":"357","CZ":"420","DE":"49","DJ":"253","DK":"45","DM":"1","DO":"1","DZ":"213","EC":"593","EE":"372","EG":"20","EH":"212","ER":"291","ES":"34","ET":"251","FI":"358","FJ":"679","FK":"500","FM":"691","FO":"298","FR":"33","GA":"241","GB":"44","GD":"1","GE":"995","GF":"594","GG":"44","GH":"233","GI":"350","GL":"299","GM":"220","GN":"224","GP":"590","GQ":"240","GR":"30","GT":"502","GU":"1","GW":"245","GY":"592","HK":"852","HN":"504","HR":"385","HT":"509","HU":"36","ID":"62","IE":"353","IL":"972","IM":"44","IN":"91","IO":"246","IQ":"964","IR":"98","IS":"354","IT":"39","JE":"44","JM":"1","JO":"962","JP":"81","KE":"254","KG":"996","KH":"855","KI":"686","KM":"269","KN":"1","KP":"850","KR":"82","KW":"965","KY":"1","KZ":"7","LA":"856","LB":"961","LC":"1","LI":"423","LK":"94","LR":"231","LS":"266","LT":"370","LU":"352","LV":"371","LY":"218","MA":"212","MC":"377","MD":"373","ME":"382","MF":"590","MG":"261","MH":"692","MK":"389","ML":"223","MM":"95","MN":"976","MO":"853","MP":"1","MQ":"596","MR":"222","MS":"1","MT":"356","MU":"230","MV":"960","MW":"265","MX":"52","MY":"60","MZ":"258","NA":"264","NC":"687","NE":"227","NF":"672","NG":"234","NI":"505","NL":"31","NO":"47","NP":"977","NR":"674","NU":"683","NZ":"64","OM":"968","PA":"507","PE":"51","PF":"689","PG":"675","PH":"63","PK":"92","PL":"48","PM":"508","PR":"1","PS":"970","PT":"351","PW":"680","PY":"595","QA":"974","RE":"262","RO":"40","RS":"381","RU":"7","RW":"250","SA":"966","SB":"677","SC":"248","SD":"249","SE":"46","SG":"65","SH":"290","SI":"386","SJ":"47","SK":"421","SL":"232","SM":"378","SN":"221","SO":"252","SR":"597","SS":"211","ST":"239","SV":"503","SX":"1","SY":"963","SZ":"268","TA":"290","TC":"1","TD":"235","TG":"228","TH":"66","TJ":"992","TK":"690","TL":"670","TM":"993","TN":"216","TO":"676","TR":"90","TT":"1","TV":"688","TW":"886","TZ":"255","UA":"380","UG":"256","US":"1","UY":"598","UZ":"998","VA":"39","VC":"1","VE":"58","VG":"1","VI":"1","VN":"84","VU":"678","WF":"681","WS":"685","XK":"383","YE":"967","YT":"262","ZA":"27","ZM":"260","ZW":"263"}; // ISO 3166 -> country calling code (all 245 regions, from libphonenumber metadata)


/* ---------- Auth providers ----------
   Interface: sendCode(e164, ctx) -> Promise<{ verificationId, demoCode? }>;  verifyCode(verificationId, code) -> Promise<{ ok, providerUid? }>
   - 'firebase-native': Capacitor app + @capacitor-firebase/authentication (needs android/app/google-services.json and RIPZONE_FIREBASE.native = true)
   - 'firebase-web':    browser/PWA + Firebase JS SDK (modular, loaded from gstatic only when configured) + invisible reCAPTCHA
   - 'mock':            automatic fallback when firebase-config.js is still the PLACEHOLDER: any 6-digit code works, demo code shown on screen
   Twilio Verify could be added the same way (backend: POST /verify/start {to}, POST /verify/check {to, code}). */
const FB = window.RIPZONE_FIREBASE || {};
const fbWebReady = () => !!(FB.web && FB.web.apiKey && !/PLACEHOLDER/i.test(FB.web.apiKey));
const isNative = () => !!window.Capacitor?.isNativePlatform?.();
const AuthProvider = {
  mock: {
    name: 'mock',
    async sendCode(e164) { await wait(450); return { verificationId: 'mock|' + e164 + '|' + Date.now(), demoCode: TEST_PHONES[e164] || '123456' }; },
    async verifyCode(id, code) { await wait(350); const t = TEST_PHONES[id.split('|')[1]]; return { ok: t ? code === t : /^\d{6}$/.test(code), providerUid: null }; }, // test numbers need their fixed code, like Firebase
  },
  'firebase-native': {
    name: 'firebase-native',
    plugin() { return window.Capacitor.registerPlugin('FirebaseAuthentication'); },
    sendCode(e164) {
      const P = this.plugin();
      return new Promise(async (res, rej) => {
        const hs = []; const done = () => hs.forEach(h => h.remove?.());
        hs.push(await P.addListener('phoneCodeSent', e => { done(); res({ verificationId: e.verificationId }); }));
        hs.push(await P.addListener('phoneVerificationCompleted', e => { done(); res({ verificationId: 'auto', autoUser: e.user }); })); // Android instant verification
        hs.push(await P.addListener('phoneVerificationFailed', e => { done(); rej(new Error(e.message)); }));
        P.signInWithPhoneNumber({ phoneNumber: e164 }).catch(err => { done(); rej(err); });
      });
    },
    async verifyCode(id, code) {
      if (id === 'auto') return { ok: true };
      try { const r = await this.plugin().confirmVerificationCode({ verificationId: id, verificationCode: code }); return { ok: true, providerUid: r.user?.uid }; } catch { return { ok: false }; }
    },
  },
  'firebase-web': {
    name: 'firebase-web', v: '11.10.0',
    async sdk() {
      if (this._m) return this._m;
      const base = `https://www.gstatic.com/firebasejs/${this.v}/`;
      const [app, auth] = await Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-auth.js')]);
      const a = auth.getAuth(app.initializeApp(FB.web)); a.useDeviceLanguage();
      return this._m = { auth, a };
    },
    async sendCode(e164, ctx) {
      const { auth, a } = await this.sdk();
      this._rv ||= new auth.RecaptchaVerifier(a, ctx?.recaptchaEl || 'sendBtn', { size: 'invisible' });
      this._conf = await auth.signInWithPhoneNumber(a, e164, this._rv);
      return { verificationId: this._conf.verificationId };
    },
    async verifyCode(id, code) { try { const r = await this._conf.confirm(code); return { ok: true, providerUid: r.user.uid }; } catch { return { ok: false }; } },
  },
};
function authProvider() {
  if (CONFIG.AUTH_PROVIDER !== 'auto') return AuthProvider[CONFIG.AUTH_PROVIDER] || AuthProvider.mock;
  if (isNative() && FB.native === true) return AuthProvider['firebase-native'];
  if (!isNative() && fbWebReady()) return AuthProvider['firebase-web'];
  return AuthProvider.mock;
}
/* UserService interface: createUser, login, getProfile, markFoundingMember, syncToServer (stub). Backed by localStorage; swap for Firebase/Supabase. */
const UserService = {
  KEY: 'ripzone.users', SEQ: 'ripzone.founderSeq',
  _all() { try { return JSON.parse(localStorage.getItem(this.KEY)) || {}; } catch { return {}; } },
  _put(p) { const a = this._all(); a[p.phone] = p; localStorage.setItem(this.KEY, JSON.stringify(a)); this.syncToServer(p); return p; },
  getProfile(phone = S.user?.phone) { const p = this._all()[phone]; if (p && S.user?.phone === phone) p.balanceUSD = S.bal; return p || null; },
  createUser({ phone, username, dob, providerUid }) {
    const now = Date.now(), p = { uid: providerUid || 'u_' + now.toString(36) + Math.floor(rnd() * 1e6).toString(36), phone, username, dob, createdAt: now, lastLogin: now, loginCount: 1, termsAcceptedAt: now, founding: false, founderNo: null, balanceUSD: 0, authProvider: authProvider().name };
    if (CONFIG.FOUNDING_MEMBERS) this.markFoundingMember(p);
    return this._put(p);
  },
  login(phone) { const p = this._all()[phone]; if (!p) return null; p.lastLogin = Date.now(); p.loginCount = (p.loginCount || 0) + 1; return this._put(p); },
  markFoundingMember(p) { if (p.founding) return p; const n = (+localStorage.getItem(this.SEQ) || 0) + 1; localStorage.setItem(this.SEQ, n); p.founding = true; p.founderNo = n; return p; },
  saveBalance() { const p = this.getProfile(); if (p) { p.balanceUSD = S.bal; delete p.eaSC; this._put(p); } },
  syncToServer(p) { /* stub: Firebase setDoc(doc(db,'users',p.uid), p) · Supabase from('users').upsert(p). Real money: balances must live server-side (ledger), never trusted from the device. */ return Promise.resolve({ ok: true, mocked: true }); },
};
const founderTag = p => p?.founding ? `<span class="founder-badge">★ Founding Member #${String(p.founderNo).padStart(4, '0')}</span>` : '';

const Auth = {
  mode: 'signup', iso: 'US', e164: '', vid: null, timer: 0, providerUid: null,
  el: () => $('#auth'),
  show(mode) {
    this.mode = mode || 'signup'; this.el().classList.add('on');
    try { const reg = (navigator.language || 'en-US').split('-')[1]; if (reg && DIAL[reg.toUpperCase()]) this.iso = reg.toUpperCase(); } catch {}
    this.phoneScreen(true);
  },
  flag(iso) { return iso.replace(/./g, ch => String.fromCodePoint(127397 + ch.charCodeAt(0))); },
  cname(iso) { try { return (this._dn ||= new Intl.DisplayNames(['en'], { type: 'region' })).of(iso); } catch { return iso; } },
  screen(html, back) {
    const a = this.el(), old = $('.auth-scr', a), n = document.createElement('div'); n.className = 'auth-scr'; n.innerHTML = html; a.appendChild(n);
    const dx = back ? -40 : 40;
    if (old) anim(old, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translate3d(${-dx}px,0,0)` }], { duration: 240 }).then(() => old.remove());
    anim(n, [{ opacity: 0, transform: `translate3d(${dx}px,0,0)` }, { opacity: 1, transform: 'none' }], { duration: 340, easing: 'cubic-bezier(.2,.9,.3,1)' });
    return n;
  },
  legal: () => `<div class="onb-legal"><a href="#" data-doc="terms">Terms</a> · <a href="#" data-doc="rules">Pack Rules</a> · <a href="#" data-doc="privacy">Privacy</a> · <a href="#" data-doc="rg">Responsible Use</a> · <a href="#" data-doc="how">How it works</a><br>18+ only · Demo build: no payments, withdrawals or shipments</div>`,
  phoneScreen(first, back) {
    const signup = this.mode === 'signup', prov = authProvider().name;
    const n = this.screen(`<div class="auth-logo">⚡ RIPZONE</div>
      <h1 class="auth-h">${signup ? 'Sign up with your phone number' : 'Log in with your phone number'}</h1>
      <p class="auth-p">We'll text you a 6-digit code. No email or password needed.</p>
      <div class="phone-row"><button class="cc-btn" id="ccBtn"><span class="fl">${this.flag(this.iso)}</span>+${DIAL[this.iso]}<i>▾</i></button>
        <input id="phoneIn" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="Phone number" maxlength="18"></div>
      <div class="auth-err" id="phErr"></div>
      <button class="cta" id="sendBtn">Send code</button><div id="recap"></div>
      <button class="auth-switch" id="authSwitch">${signup ? 'Already have an account? <b>Log in</b>' : 'New here? <b>Sign up</b>'}</button>
      ${prov === 'mock' ? '<div class="demo-code small">Test mode: no text message is sent. Any 6-digit code works.</div>' : ''}
      ${this.legal()}`, back && !first);
    const inp = $('#phoneIn', n); setTimeout(() => inp.focus(), 350);
    $('#ccBtn', n).onclick = () => this.picker();
    $('#authSwitch', n).onclick = () => { this.mode = signup ? 'login' : 'signup'; this.phoneScreen(false, true); };
    const go = async () => {
      const nat = inp.value.replace(/\D/g, '').replace(/^0+/, ''), e164 = '+' + DIAL[this.iso] + nat;
      if (nat.length < 4 || e164.length > 16) { $('#phErr', n).textContent = 'Enter a valid phone number'; anim(inp, [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 240, fill: 'none' }); return; }
      const b = $('#sendBtn', n); b.disabled = true; b.textContent = 'Sending…'; this.e164 = e164;
      try { const r = await authProvider().sendCode(e164, { recaptchaEl: 'recap' }); this.vid = r.verificationId; this.demo = r.demoCode; this.codeScreen(); }
      catch (e) { b.disabled = false; b.textContent = 'Send code'; $('#phErr', n).textContent = 'Could not send the code: ' + (e.message || e) + '. Check the number and try again.'; }
    };
    $('#sendBtn', n).onclick = go; inp.onkeydown = e => { if (e.key === 'Enter') go(); };
  },
  picker() {
    const list = Object.keys(DIAL).map(iso => ({ iso, name: this.cname(iso), dial: DIAL[iso] })).sort((a, b) => a.name.localeCompare(b.name));
    $('#sheet').classList.add('top');
    sheet(`<h2 style="text-align:center">Country / region</h2><input id="ccSearch" class="cc-search" placeholder="Search country or code" autocomplete="off"><div class="cc-list" id="ccList"></div>`);
    const draw = q => { q = (q || '').toLowerCase().replace('+', ''); $('#ccList').innerHTML = list.filter(c => !q || c.name.toLowerCase().includes(q) || c.dial.startsWith(q) || c.iso.toLowerCase() === q).map(c => `<button data-iso="${c.iso}" class="${c.iso === this.iso ? 'on' : ''}"><span class="fl">${this.flag(c.iso)}</span><span class="nm">${c.name}</span><span class="dc">+${c.dial}</span></button>`).join(''); };
    draw(''); $('#ccSearch').oninput = e => draw(e.target.value);
    $('#ccList').onclick = e => { const b = e.target.closest('[data-iso]'); if (!b) return; this.iso = b.dataset.iso; closeSheet(); const cb = $('#ccBtn'); if (cb) cb.innerHTML = `<span class="fl">${this.flag(this.iso)}</span>+${DIAL[this.iso]}<i>▾</i>`; $('#phoneIn')?.focus(); };
  },
  codeScreen() {
    const n = this.screen(`<button class="auth-back" id="codeBack">‹ Change number</button>
      <h1 class="auth-h">Enter the 6-digit code</h1><p class="auth-p">Sent to <b>${this.e164}</b></p>
      <div class="otp" id="otp">${Array.from({ length: 6 }, (_, i) => `<input inputmode="numeric" pattern="[0-9]*" maxlength="1" ${i === 0 ? 'autocomplete="one-time-code"' : ''} aria-label="Digit ${i + 1}">`).join('')}</div>
      <div class="auth-err" id="otpErr"></div>
      ${this.demo ? `<div class="demo-code">${TEST_PHONES[this.e164] ? `Test number: use its fixed code <b>${this.demo}</b>` : `Demo mode: no SMS is sent. Use <b>${this.demo}</b> (any 6 digits work)`}</div>` : (TEST_PHONES[this.e164] ? `<div class="demo-code small">Firebase test number: no SMS is sent. Use its fixed code.</div>` : '')}
      <button class="auth-switch" id="resendBtn" disabled></button>`);
    const boxes = $$('#otp input', n); setTimeout(() => boxes[0].focus(), 360);
    const code = () => boxes.map(b => b.value).join('');
    const fill = (str, from = 0) => { str.replace(/\D/g, '').slice(0, 6 - from).split('').forEach((d, k) => boxes[from + k].value = d); const nx = boxes.findIndex(b => !b.value); (boxes[nx] || boxes[5]).focus(); if (code().length === 6) this.verify(code(), boxes); };
    boxes.forEach((b, i) => {
      b.oninput = () => { const v = b.value.replace(/\D/g, ''); if (v.length > 1) { b.value = ''; return fill(v, i); } b.value = v; if (v) { anim(b, [{ transform: 'scale(1.15)' }, { transform: 'none' }], { duration: 160, fill: 'none' }); if (i < 5) boxes[i + 1].focus(); else if (code().length === 6) this.verify(code(), boxes); } };
      b.onkeydown = e => { if (e.key === 'Backspace' && !b.value && i > 0) { boxes[i - 1].value = ''; boxes[i - 1].focus(); e.preventDefault(); } };
      b.onpaste = e => { e.preventDefault(); fill((e.clipboardData || window.clipboardData).getData('text'), 0); };
    });
    $('#codeBack', n).onclick = () => { clearInterval(this.timer); this.phoneScreen(false, true); };
    const rb = $('#resendBtn', n); let left = 30; clearInterval(this.timer);
    const tick = () => { if (left > 0) { rb.disabled = true; rb.innerHTML = `Resend code in <b>0:${String(left).padStart(2, '0')}</b>`; left--; } else { rb.disabled = false; rb.innerHTML = '<b>Resend code</b>'; clearInterval(this.timer); } };
    tick(); this.timer = setInterval(tick, 1000);
    rb.onclick = async () => { try { const r = await authProvider().sendCode(this.e164, { recaptchaEl: 'resendBtn' }); this.vid = r.verificationId; toast('New code sent' + (r.demoCode ? ' (demo: ' + r.demoCode + ')' : '')); } catch (e) { toast('Could not resend: ' + (e.message || e)); } left = 30; tick(); this.timer = setInterval(tick, 1000); };
    if (this.vid === 'auto') this.verify('000000', boxes); // Android auto-verification
  },
  async verify(code, boxes) {
    if (this._busy) return; this._busy = true;
    const r = await authProvider().verifyCode(this.vid, code); this._busy = false;
    if (!r.ok) { $('#otpErr').textContent = 'That code is not valid. Try again.'; boxes.forEach(b => b.value = ''); boxes[0].focus(); return; }
    this.providerUid = r.providerUid || null;
    clearInterval(this.timer); boxes.forEach((b, i) => anim(b, [{ transform: 'none' }, { transform: 'scale(1.12)', borderColor: '#39ff9f' }, { transform: 'none' }], { duration: 300, delay: i * 40, fill: 'none' }));
    await wait(420);
    const existing = UserService.login(this.e164);
    if (existing) return this.finish(existing, false);
    if (this.mode === 'login') toast("No account for this number yet. Let's create one.");
    this.profileScreen();
  },
  profileScreen() {
    const n = this.screen(`<h1 class="auth-h">Create your profile</h1><p class="auth-p">Phone verified: <b>${this.e164}</b> ✓</p>
      <label class="auth-lbl" for="unIn">Username</label><input id="unIn" class="auth-in" maxlength="20" autocomplete="nickname" placeholder="e.g. HoloHunter">
      <label class="auth-lbl" for="dobM">Date of birth</label>${dobPicker()}
      <label class="auth-check"><input type="checkbox" id="tosIn"><span>I'm 18 or older and I agree to the <a href="#" data-doc="terms">Terms</a>, <a href="#" data-doc="rules">Pack Rules</a> and <a href="#" data-doc="privacy">Privacy Policy</a>.</span></label>
      <div class="auth-err" id="pfErr"></div>
      <button class="cta" id="pfGo">Create account</button>
      ${CONFIG.FOUNDING_MEMBERS ? `<div class="auth-founder">★ Sign up early to become a <b>Founding Member</b>.</div>` : ''}`);
    setTimeout(() => $('#unIn', n).focus(), 350);
    $('#pfGo', n).onclick = () => {
      const un = $('#unIn', n).value.trim(), dob = dobVal(n), err = $('#pfErr', n);
      if (!/^[A-Za-z0-9_]{3,20}$/.test(un)) return err.textContent = 'Username: 3–20 letters, numbers or _';
      if (!dob) return err.textContent = 'Enter your date of birth';
      const d = new Date(dob + 'T00:00'), now = new Date(); let age = now.getFullYear() - d.getFullYear(); if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) age--;
      if (age < 18) { this.screen(`<div class="auth-logo">⚡ RIPZONE</div><h1 class="auth-h">Sorry, you must be 18 or older</h1><p class="auth-p">RipZone is only available to adults. Your details were not saved.</p>${this.legal()}`); return; }
      if (!$('#tosIn', n).checked) return err.textContent = 'Please accept the Terms to continue';
      try { const gv = Gate.v; if (gv) { gv.dob = dob; localStorage.setItem(Gate.K, JSON.stringify(gv)); } } catch (_) {}
      this.finish(UserService.createUser({ phone: this.e164, username: un, dob, providerUid: this.providerUid }), true);
    };
  },
  finish(p, isNew) {
    if ((S.user && S.user.uid !== p.uid) || (!S.user && !isNew && localStorage.getItem('ripzone.cash.acct.' + p.uid))) { // switching accounts on this device: swap the stored game state
      if (S.user) localStorage.setItem('ripzone.cash.acct.' + S.user.uid, JSON.stringify(S));
      const st = JSON.parse(localStorage.getItem('ripzone.cash.acct.' + p.uid) || 'null') || freshState(); st.user = { uid: p.uid, phone: p.phone };
      localStorage.setItem(KEY, JSON.stringify(st)); location.reload(); return;
    }
    S.user = { uid: p.uid, phone: p.phone }; save(); UserService.saveBalance(); try { h2Avatar(); } catch (_) {}
    const a = this.el(); anim(a, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).then(() => { a.classList.remove('on'); a.innerHTML = ''; a.getAnimations().forEach(x => x.cancel()); });
    toast(isNew ? `Welcome, ${p.username}!${p.founding ? ` You're Founding Member #${String(p.founderNo).padStart(4, '0')}` : ''}` : `Welcome back, ${p.username}`);
    renderWallet(true); renderProfileEntry();
    if (!S.onboarded) setTimeout(() => Tut.start(false), 500);
  },
  logout() { if (busy) return toast('Finish your pack first'); localStorage.setItem('ripzone.cash.acct.' + S.user.uid, JSON.stringify(S)); localStorage.setItem(KEY, JSON.stringify(freshState())); location.reload(); },
  demoLogin() { const phone = '+15555550100'; const p = UserService.login(phone) || UserService.createUser({ phone, username: 'qa_tester', dob: '1990-01-01' }); S.user = { uid: p.uid, phone }; save(); try { h2Avatar(); } catch (_) {} }, // automated tests only
};

/* ---------- Welcome deal: one-time first-deposit offer (demo: no payment). ---------- */
const OFFER = { hours: CONFIG.OFFER_HOURS };
const Offer = {
  active() { const o = S.offer; return !!(o && o.start && !o.bought && Date.now() < o.start + OFFER.hours * 36e5); },
  start() { if (!S.offer?.start) { S.offer = { start: Date.now(), bought: false }; save(); } },
  left() { return Math.max(0, S.offer.start + OFFER.hours * 36e5 - Date.now()); },
  clock(ms) { const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`; },
  show() {
    if (!this.active()) return; const el = $('#offer'), min = CONFIG.OFFER.min, rare = PACKS.find(q => freeKey(q) === Object.keys(CONFIG.OFFER.packs)[0]);
    el.innerHTML = `<div class="of-card" role="dialog" aria-label="Welcome deal"><button class="of-x" id="ofX" aria-label="Close">✕</button>
      <div class="of-badge">WELCOME DEAL</div><div class="of-kick">ONE-TIME FIRST DEPOSIT BONUS</div>
      <div class="of-coins"><i class="coin usd big"></i><i class="coin usd big"></i><i class="coin usd big"></i></div>
      <div class="of-amt"><b>${fmtUSD(min)}</b><span class="of-x2">+ FREE ${rare.name.toUpperCase()} PACK</span></div>
      <ul class="of-list"><li><i class="coin usd"></i><span><b>${fmtUSD(min)}</b> added to your balance, all of it playable</span></li>
        <li>💠<span><b>${packTxt(CONFIG.OFFER.packs).replace(/^1 f/, 'F')}</b> (${fmtUSD(rare.price)} in Pokémon, usable in any category)</span></li></ul>
      <button class="cta cash of-buy" id="ofBuy">Add ${fmtUSD(min)}<small>card · Apple Pay · Google Pay</small></button>
      <div class="of-timer">Offer ends in <b id="ofT">${this.clock(this.left())}</b></div>
      <p class="of-fine">Applies to your first deposit of ${fmtUSD(min)} or more. One per account. <a href="#" data-doc="rules">Pack Rules</a> · <a href="#" data-doc="terms">Terms</a></p>
      <button class="onb-skip" id="ofLater">No thanks</button></div>`;
    el.classList.add('on'); el.getAnimations().forEach(a => a.cancel());
    anim(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 240 });
    anim($('.of-card', el), [{ opacity: 0, transform: 'translate3d(0,60px,0) scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 480, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
    $$('.of-coins .coin', el).forEach((c, i) => anim(c, [{ transform: 'translate3d(0,-50px,0) rotate(-40deg)', opacity: 0 }, { transform: `translate3d(${(i - 1) * 30}px,0,0) rotate(${(i - 1) * 14}deg)`, opacity: 1 }], { duration: 620, delay: 160 + i * 90, easing: 'cubic-bezier(.3,1.5,.5,1)' }));
    clearInterval(this.t); this.t = setInterval(() => { const t = $('#ofT'); if (!t || !this.active()) return clearInterval(this.t); t.textContent = this.clock(this.left()); }, 1000);
    $('#ofX').onclick = $('#ofLater').onclick = () => this.close();
    el.onclick = e => { if (e.target === el) this.close(); };
    $('#ofBuy').onclick = () => this.buy();
  },
  close() { const el = $('#offer'); clearInterval(this.t); return anim(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 }).then(() => { el.classList.remove('on'); el.innerHTML = ''; el.getAnimations().forEach(a => a.cancel()); renderStore(); }); },
  buy() {
    this.close(); setTimeout(() => Funds.open({ amount: CONFIG.OFFER.min }), 220);
  },
  banner() {
    if (!this.active()) return '';
    return `<button class="of-banner" id="ofBanner"><span class="ob-badge">WELCOME</span><span class="ob-t"><b>First deposit ${fmtUSD(CONFIG.OFFER.min)}+ · FREE Rare pack</b><small>One-time welcome deal · demo, no payment taken</small></span><span class="ob-clock" id="obClock">${this.clock(this.left())}</span></button>`;
  },
};
setInterval(() => { const c = $('#obClock'); if (c) { if (Offer.active()) c.textContent = Offer.clock(Offer.left()); else renderStore(); } }, 1000);

/* ---------- Profile screen ---------- */
function maskPhone(p) { return p ? p.slice(0, Math.min(5, p.length - 4)) + ' ••• ' + p.slice(-4) : ''; }
function renderProfileEntry() { const b = $('#profileBtn'), p = UserService.getProfile(); h2Avatar(); if (b) b.innerHTML = `${b.querySelector('span.icn') ? b.querySelector('span.icn').outerHTML : '<span>👤</span>'}${p ? `Profile · ${p.username}${p.founding ? ' <em class="fm-mini">★ #' + String(p.founderNo).padStart(4, '0') + '</em>' : ''}` : 'Profile'}`; }
function renderProfile() {
  const p = UserService.getProfile(), d = t => t ? new Date(t).toLocaleString() : '—';
  if (!p) { $('#profileBody').innerHTML = `<p class="muted">Not signed in.</p><button class="cta" id="pfLogin">Sign up / log in</button>`; $('#pfLogin').onclick = () => Auth.show('signup'); return; }
  $('#profileBody').innerHTML = `<div class="pf-card"><div class="pf-av">${p.username[0].toUpperCase()}</div><div><div class="pf-name">${p.username}</div>${founderTag(p)}</div></div>
    ${Stats.html()}
    <h3 class="st-h">Account</h3><div class="pf-rows"><div><span>Phone</span><b>${maskPhone(p.phone)}</b></div><div><span>Signed up</span><b>${d(p.createdAt)}</b></div><div><span>Last login</span><b>${d(p.lastLogin)}</b></div><div><span>Logins</span><b>${p.loginCount}</b></div>
      <div><span>Founding Member</span><b>${p.founding ? 'Yes · #' + String(p.founderNo).padStart(4, '0') : 'No'}</b></div><div><span>USD balance</span><b>${fmtUSD(S.bal)}</b></div><div><span>Verification</span><b>${p.authProvider === 'mock' ? 'Demo code (mock)' : 'SMS (Firebase)'}</b></div></div>
    ${p.founding ? `<div class="fm-card"><div class="fm-h">★ Founding Member</div><p>You signed up early. Your badge and number are permanent.</p><small>Any Founding Member perks are TBD.</small></div>` : ''}
    <button class="cta ghost" id="pfLogout">Log out</button>
    <p class="fine">Stored on this device in this demo. Never sold. See <a href="#" data-doc="privacy">Privacy</a>.</p>`;
  $('#pfLogout').onclick = () => Auth.logout();
  $$('#profileBody [data-insp]').forEach(b => b.onclick = () => { const c = BY_ID[b.dataset.insp]; c && Inspect.open(c); });
  const pv = $('#pfPickFav'); if (pv) pv.onclick = () => { nav('collection'); toast('Open a card and tap ☆ to pin it'); };
}
/* v0.11.1 profile stats: packs opened, largest pull, favorite card (pinned via ☆ on a Vault card; defaults to largest pull).
   Saved in local state and mirrored to the server profile (RZBackend.saveStats -> PUT /v1/me/stats). */
const Stats = {
  real() { return (S.history || []).filter(h => !h.qa && h.result && BY_ID[h.result.card]); },
  largest() { let b = null; for (const h of this.real()) if (!b || h.result.value > b.result.value) b = h; return b; },
  calc() { const L = this.largest(); return { packsOpened: S.stats.opened || 0, largestPull: L ? { cardId: L.result.card, name: L.result.name, value: L.result.value, at: L.t, purchaseId: L.id } : null, favorite: S.fav || null }; },
  sync() { try { RZBackend.saveStats && RZBackend.saveStats(this.calc()); } catch (e) {} },
  setFav(f) { S.fav = f ? { ...f, at: Date.now() } : null; save(); this.sync(); if ($('#view-profile.active')) renderProfile(); },
  card(c, label, sub, extra = '') { return `<button class="st-card" data-insp="${c.id}" aria-label="${label}: ${xe(c.name)}"><div class="st-img${gcls(c)}"><img src="${c.img}" alt="" loading="lazy" decoding="async"></div>
      <div class="st-body"><small>${label}</small><b>${xe(c.name)}</b><div class="st-val"><i class="coin usd"></i>${fmtUSD(c.value)}<span class="mkt-tag">MARKET</span></div><em>${sub}</em>${extra}</div></button>`; },
  html() { const st = this.calc(), L = st.largestPull && BY_ID[st.largestPull.cardId];
    const fx = st.favorite && S.coll.find(q => q.uid === st.favorite.uid), F = fx ? BY_ID[fx.id] : null;
    const dt = t => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    return `<h3 class="st-h">Your stats</h3><div class="st-grid">
      <div class="st-tile"><small>Packs opened</small><b>${st.packsOpened.toLocaleString()}</b></div>
      <div class="st-tile"><small>Largest pull</small><b>${L ? fmtUSD(L.value) : '—'}</b></div></div>
      ${L ? this.card(L, 'Largest pull', `Pulled ${dt(st.largestPull.at)}`) : '<div class="st-empty">Open a pack to start tracking your biggest pull.</div>'}
      ${F ? this.card(F, '★ Favorite card', `Pinned ${dt(st.favorite.at)}`) : L ? this.card(L, '★ Favorite card', 'Showing your largest pull', '<span class="st-hint" id="pfPickFav">Pin a different card ›</span>') : ''}`; }
};

/* ---------- boot ---------- */
async function boot() {
  if (!S.user && (localStorage.getItem('ripzone.skipAuth') === '1' || localStorage.getItem('ripzone.skipTut') === '1')) Auth.demoLogin(); // automated tests
  renderCatBar(); buildRail(); renderSound(); renderWallet(); renderDaily(); // v0.9.18: paint the real balance + reward dot at launch (pill showed $0.00 until the first wallet change)
  PACK3D_READY.then(() => { if (!Object.keys(PACK3D).length || busy) return; const idx = Math.max(0, centerIdx); buildRail(); requestAnimationFrame(() => { measureRail(); rail.scrollLeft = slideCenters[idx] - railHalf; centerIdx = -1; updateRail(); renderPackInfo(); }); }); // swap in packs-v2 art renderWallet(); renderDaily(); renderStore(); renderProfileEntry();
  await (window.RZ_SPLASH || Promise.resolve()); // keep the main thread free while the splash plays
  await loadData();
  window.HIDDEN_PACKS = ALL_PACKS.filter(p => !packOk(p)).map(p => ({ id: p.id, why: dist(p, 'normal').why }));
  if (PACKS.some(p => !packOk(p))) { PACKS = catPacks(S.cat); buildRail(); }
  markRail(); renderHero();
  $('#srcNote').innerHTML = `Card values are current US-dollar market prices for each card in its listed condition (raw near-mint / ungraded; PSA slabs use the graded price). Pokémon: ${META.source}, fetched ${META.fetched}. ${CATS.slice(1).map(c => `${c.long} (beta): ${c.meta.source}, ${c.meta.fetched}`).join('. ')}. ${CARDS.length} cards total. Card photos from optcgapi.com, Scryfall, the Pokémon TCG API and PriceCharting/SportsCardsPro are prototype use only (© their respective owners; licensing needed before launch).`;
  renderPackInfo();
  $$('[data-cfg=rtp]').forEach(e => e.textContent = Math.round(CONFIG.RTP * 100) + '%'); $$('[data-cfg=bb]').forEach(e => e.textContent = BBP()); $$('[data-cfg=ship]').forEach(e => e.textContent = fmtUSD(CONFIG.SHIP_FEE)); $$('[data-cfg=fifty]').forEach(e => e.textContent = Math.round(FIFTY_RTP() * 100) + '%'); $$('[data-cfg=fwin]').forEach(e => e.textContent = CONFIG.FIFTY.WIN_X + '×'); $$('[data-cfg=floss]').forEach(e => e.textContent = Math.round(CONFIG.FIFTY.LOSS_X * 100) + '%');
  Ticker.start(); warmTypical();
  if (new URLSearchParams(location.search).get('ref')) nav('refer');
  else if (!S.user && localStorage.getItem('ripzone.skipAuth') !== '1' && localStorage.getItem('ripzone.skipTut') !== '1') Auth.show('signup');
  else if (!S.onboarded && !S.pending && localStorage.getItem('ripzone.skipTut') !== '1') setTimeout(() => Tut.start(false), 450);
  // land the carousel on the Rare pack for a nicer first view
  requestAnimationFrame(() => { measureRail(); rail.scrollLeft = slideCenters[1] - railHalf; centerIdx = -1; updateRail(); });
  // resume an interrupted pack (cards already rolled)
  if (S.pending && S.pending.pulls.some(x => x.owned)) { const n = S.pending.pulls.length; delete S.pending; save(); setTimeout(() => toast(`Your last pull${n > 1 ? 's are' : ' is'} in your Vault`), 600); }
  if (S.pending) { const p = packById(S.pending.pack); const pulls = S.pending.pulls.filter(x => !x.decided && BY_ID[x.id]);
    if (p && pulls.length) { busy = true; await Promise.all(pulls.map(x => { const im = new Image(); im.src = BY_ID[x.id].img; return im.decode().catch(() => {}); })); openStage(p, pulls); } else { delete S.pending; save(); } }
  if ('serviceWorker' in navigator && !window.Capacitor?.isNativePlatform?.() && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
}
if (QA) window.__ripzone = { closeSheet, openCard, Funds, KYC, Withdraw, applyStock, startRip, get BY_ID() { return BY_ID; }, get OUTLIERS() { return OUTLIERS; }, setCat, CATS, ALL_PACKS, get cat() { return S.cat; }, Tut, RG, showOdds, Auth, UserService, Offer, CONFIG, TEST_PHONES, authProvider, get state() { return S; }, typicalRange, get PACKS() { return PACKS; }, rollCard, rollPack, packRange, oddsFor, rtpFor, packFloor, packSD, topCardP, chaseP, dist, bandOf, BAND_IDS, RISK, RISK_IDS, poolFor, Ticker, TIERS, packEV: (p, m) => packEV(p, m), sellPrice, autoTear: () => autoTear(), get REV() { return REV; }, renderWallet, renderPackInfo };
if (QA) Object.assign(window.__ripzone, { showDoc, purchaseRoll, atOrAbove, startRip, packById, closeStage, SFX }); // QA/preview hooks
/* Official Odds: every pack x risk option, generated from the same dist() the pulls use */
function renderOddsAll() { const el = $('#oddsAll'); if (!el || !CARDS.length) return; const pc = x => (x * 100).toFixed(2) + '%';
  el.innerHTML = CATS.map(cat => `<h3>${cat.ico} ${cat.long}</h3><div class="oa-wrap"><table class="odds-table oa"><thead><tr><th>Pack</th><th>Mode</th><th>Payback</th><th>Bands / chances</th></tr></thead><tbody>${ALL_PACKS.filter(p => p.cat === cat.id).map(p => RISK_IDS.map((m, k) => { const D = dist(p, m);
    if (!D.ok) return `<tr><td>${k ? '' : fmtUSD(p.price)}</td><td>${RISK[m].label}</td><td colspan="2">n/a · ${D.why}</td></tr>`;
    const o = oddsFor(p, m); return `<tr><td>${k ? '' : fmtUSD(p.price)}</td><td>${RISK[m].label}</td><td>${(D.ev / p.price * 100).toFixed(0)}%</td><td>${bandsFor(m).filter(b => o[b] > 0).map(b => `<span class="b-${b} oa-b">${BAND_LABEL[b]} ${pc(o[b])}</span>`).join(' ')}</td></tr>`; }).join('')).join('')}</tbody></table></div>`).join('');
}
/* v0.9.7 Android hardware back: reveal -> vault card + close to shop; else close sheet/modal; else go to shop; else default (exit) */
function hwBack(exit) { // v0.11.1: shared by Android back, Escape (web/PWA) and QA
    if (typeof Inspect !== 'undefined' && Inspect.close()) return;
    if (document.documentElement.classList.contains('drawer-open')) { drawer(false); return; }
    if (typeof HOME2 !== 'undefined' && HOME2 && closeOS()) return;
    if (PackPicker.cancel) { PackPicker.cancel(); return; } // card is already in the Vault
    if (REV && $('#reveal').classList.contains('on')) { if (REV.running) return; if (REV.pulls[0].practice) return; REV.autoKeep(); closeStage(); return; }
    if (stage.classList.contains('open')) return; // mid-rip: ignore
    if ($('#sheet').classList.contains('open')) { closeSheet(); return; }
    const ov = document.querySelector('.offer.on'); if (ov) { ov.classList.remove('on'); return; }
    if (document.getElementById('gate')) return;
    const v = document.querySelector('.view.active'); if (v && v.id !== 'view-shop') { nav(v.querySelector('.back[data-nav]')?.dataset.nav || 'shop'); return; }
    exit && exit();
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') hwBack(); });
if (QA) window.__ripzone.back = () => hwBack();
(function () { const Cap = window.Capacitor; if (!Cap?.isNativePlatform?.() || !Cap.registerPlugin) return; const App = Cap.registerPlugin('App');
  App.addListener('backButton', () => hwBack(() => App.exitApp())); })();
/* v0.9.7 Vault hold limit: unshipped cards auto-sell at the standard buyback (Store Credit) after RZ_COMPLIANCE.VAULT_HOLD_DAYS.
   Debug: ?vaultff=<hours> fast-forwards the vault clock (testing only). */
const VAULT_DAYS = () => window.RZ_COMPLIANCE.VAULT_HOLD_DAYS || 5;
const VAULT_FF = (+new URLSearchParams(location.search).get('vaultff') || 0) * 36e5;
function vNow() { return Date.now() + VAULT_FF; }
function vaultLeft(x) { return (x.pulledAt || x.t) + VAULT_DAYS() * 864e5 - vNow(); }
function leftTxt(ms) { const h = Math.max(0, Math.floor(ms / 36e5)), d = Math.floor(h / 24); return d ? `${d}d ${h % 24}h left` : h ? `${h}h ${Math.floor(ms / 6e4) % 60}m left` : `${Math.max(1, Math.floor(ms / 6e4))}m left`; }
function vaultBadge(x) { const ms = vaultLeft(x); return `<i class="vexp${ms < 6 * 36e5 ? ' red' : ms < 864e5 ? ' amber' : ''}">${leftTxt(ms)}</i>`; }
function vaultWarn() { const n = S.coll.filter(x => !x.ship && BY_ID[x.id] && vaultLeft(x) < 864e5).length;
  return n ? `<div class="vault-warn">⏳ <span><b>${n} card${n === 1 ? '' : 's'} auto-sell${n === 1 ? 's' : ''} within 24h</b><small>Ship ${n === 1 ? 'it' : 'them'} to keep ${n === 1 ? 'it' : 'them'}, or it sells at ${BBP()} buyback as Store Credit</small></span></div>` : ''; }
function vaultSweep() {
  if (!CARDS.length || !S.coll) return; const gone = S.coll.filter(x => !x.ship && BY_ID[x.id] && vaultLeft(x) <= 0); if (!gone.length) return;
  let tot = 0; for (const x of gone) { const v = sellPrice(BY_ID[x.id]); tot = r2(tot + v); sellBack(BY_ID[x.id], v, x.uid); }
  S.stats.sold += gone.length; const ids = new Set(gone.map(x => x.uid)); S.coll = S.coll.filter(x => !ids.has(x.uid)); save(); renderWallet(true); renderCollection();
  if (stage.classList.contains('open')) { toast(`${gone.length} vault card${gone.length === 1 ? '' : 's'} auto-sold for ${fmtUSD(tot)} cash`); return; }
  sheet(`<h2 style="text-align:center">⏳ Vault auto-sell</h2><p class="muted" style="text-align:center"><b>${gone.length} card${gone.length === 1 ? '' : 's'} auto-sold for ${fmtUSD(tot)} sell-back cash</b><br>Cards are held for ${VAULT_DAYS()} days. Unshipped cards then sell at the ${BBP()} buyback.</p>
    <div class="ship-list">${gone.slice(0, 6).map(x => { const c = BY_ID[x.id]; return `<div class="ship-row"><img src="${c.img}" alt=""><span><b>${c.name}</b><small>${fmtUSD(sellPrice(c))} credit</small></span></div>`; }).join('')}${gone.length > 6 ? `<div class="muted small">+${gone.length - 6} more</div>` : ''}</div>
    <button class="cta" id="vsOk">OK</button>`); $('#vsOk').onclick = closeSheet;
}
setInterval(() => { vaultSweep(); if (document.querySelector('#view-collection.active')) renderCollection(); }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) vaultSweep(); });
(window.RZ_SPLASH || Promise.resolve()).then(() => setTimeout(vaultSweep, 1500));
window.__rzi = { BAND_HEX, BAND_LABEL, Funds, Gate, KYC, QA, RG, RISK, bandsFor, closeSheet, dist, fmtUSD, fmtUSDs, oddsFor, packFloor, poolFor, renderPackInfo, renderRG, sheet, tmTag, toast, xe, $, get S() { return S; }, get BY_ID() { return BY_ID; } }; // v0.11.0 bridge for js/compliance.js
boot();
(window.RZ_SPLASH || Promise.resolve()).then(() => setTimeout(() => Gate.show(), 450));
})();

/* v0.11.1 one consistent line-icon set (replaces mixed emoji in tab bar + menu) */
(() => {
  const P = {
    shop: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M12 11l1.5 3h-3z"/>',
    collection: '<rect x="3" y="5" width="18" height="15" rx="2"/><circle cx="12" cy="12.5" r="3"/><path d="M12 9.5V8M7 5V3.5M17 5V3.5"/>',
    rewards: '<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13M12 8c-2-4-6-4-6-1.5S12 8 12 8zm0 0c2-4 6-4 6-1.5S12 8 12 8z"/>',
    store: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 15h2"/>',
    more: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/>',
    refer: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.5-5 6.5-5s5.7 1.5 6.5 5M18 8v6M15 11h6"/>',
    how: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    rules: '<path d="M7 4h7l4 4v12H7z"/><path d="M14 4v4h4M10 12h5M10 16h5"/>',
    terms: '<path d="M12 3v18M5 7h14M7 7l-3 7h6zM17 7l-3 7h6z"/>',
    privacy: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    rg: '<path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    odds: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    kyc: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.5"/><path d="M5.5 17c.6-2 2-3 3.5-3s2.9 1 3.5 3M15 10h3M15 13h3"/>',
    support: '<path d="M4 5h16v11H9l-5 4z"/>',
    musicBtn: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    fxBtn: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
    soundBtn: '<path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
    pushBtn: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0"/>',
    spinBtn: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16"/>',
    replayTut: '<path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4"/>',
    resetBtn: '<path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4"/>'
  };
  const svg = d => `<svg class="ico" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const run = () => document.querySelectorAll('.tabbar button, .menu button').forEach(b => {
    const k = b.dataset.nav || b.id, sp = b.querySelector(':scope > span'); if (P[k] && sp) { sp.innerHTML = svg(P[k]); sp.classList.add('icn'); }
  });
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', run); else run();
})();
