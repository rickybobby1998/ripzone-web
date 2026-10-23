/* v0.9.17 Card inspector: full-screen, drag to spin (Y 1:1, slight X tilt), inertia + spring to the nearest face,
   double-tap / pinch zoom, close with ✕, swipe down or back. Transform-only; matte (no glare layers).
   Data model (all optional, per card): imageFront, imageBack (raw photos) · slabFront, slabBack (graded slab photos).
   Missing backs fall back to RipZone's own matte generic back per category. */
const Inspect = (() => {
  const $ = (q, r = document) => r.querySelector(q);
  const BACKS = { pkm: ['#1b3f9c', '#0d1f55', '#f2b632'] };
  const front = c => (c.graded && c.slabFront) || c.imageFront || c.img;
  const back = c => (c.graded && c.slabBack) || c.imageBack || null;
  function genericBack(c) { const [a, b, k] = BACKS[c.cat] || BACKS.pkm;
    return `<div class="ib-gen" style="--a:${a};--b:${b};--k:${k}"><div class="ib-frame"><div class="ib-rings"></div><div class="ib-emb"><img src="img/brand/logo-icon.webp" alt=""></div><div class="ib-word">RIPZONE</div><div class="ib-cat">${({ pkm: 'Pokémon' })[c.cat] || ''}</div></div></div>`; }
  let el, card, c, st = null;
  function build() {
    el = document.createElement('div'); el.id = 'insp'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Card inspector');
    el.innerHTML = `<button class="insp-back" aria-label="Back">‹ Back</button><button class="insp-x" aria-label="Close">✕</button><div class="insp-stage"><div class="insp-zoom"><div class="insp-card"><div class="insp-f front"></div><div class="insp-f back"></div></div></div></div><div class="insp-cap"></div><div class="insp-help">Drag to turn · double-tap to zoom · swipe down to close</div>`;
    document.body.append(el); card = $('.insp-card', el);
    $('.insp-x', el).onclick = () => close(); $('.insp-back', el).onclick = () => close();
    const stg = $('.insp-stage', el); stg.addEventListener('pointerdown', down); stg.addEventListener('pointermove', move); stg.addEventListener('pointerup', up); stg.addEventListener('pointercancel', up);
  }
  // state: ry/rx angles, vy velocity (deg/s), zoom, swipe-down offset
  let ry = 0, rx = 0, vy = 0, zoom = 1, dy = 0, raf = 0, ptrs = new Map(), drag = null, lastTap = 0, pinch0 = 0, zoom0 = 1, mode = '';
  const W = () => card.offsetWidth || 300;
  function apply() { card.style.transform = `translate3d(0,${dy}px,0) rotateX(${rx}deg) rotateY(${ry}deg)`; $('.insp-zoom', el).style.transform = `scale(${zoom})`; el.style.setProperty('--dim', String(Math.max(0, 1 - Math.abs(dy) / 400))); }
  function down(e) { e.preventDefault(); $('.insp-stage', el).setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); cancelAnimationFrame(raf); raf = 0;
    if (ptrs.size === 2) { const [p, q] = [...ptrs.values()]; pinch0 = Math.hypot(p.x - q.x, p.y - q.y); zoom0 = zoom; mode = 'pinch'; return; }
    drag = { x: e.clientX, y: e.clientY, t: performance.now(), t0: performance.now(), ry0: ry, sx: e.clientX, sy: e.clientY }; mode = ''; vy = 0; }
  function move(e) { if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (mode === 'pinch' && ptrs.size === 2) { const [p, q] = [...ptrs.values()]; zoom = Math.max(1, Math.min(3, zoom0 * Math.hypot(p.x - q.x, p.y - q.y) / pinch0)); apply(); return; }
    if (!drag) return; const ddx = e.clientX - drag.sx, ddy = e.clientY - drag.sy;
    if (!mode && Math.hypot(ddx, ddy) > 6) mode = ddy > 0 && Math.abs(ddy) > Math.abs(ddx) * 1.4 && zoom === 1 ? 'swipe' : 'spin';
    const now = performance.now(), dt = Math.max(1, now - drag.t);
    if (mode === 'spin') { const d = (e.clientX - drag.x) / W() * 180; ry += d; vy = vy * .6 + (d / dt * 1000) * .4; rx = Math.max(-14, Math.min(14, -ddy * .08)); }
    else if (mode === 'swipe') dy = Math.max(0, ddy);
    drag.x = e.clientX; drag.y = e.clientY; drag.t = now; apply(); }
  function up(e) { ptrs.delete(e.pointerId); if (mode === 'pinch') { if (ptrs.size < 2) { mode = ''; drag = null; if (zoom < 1.05) zoom = 1; apply(); } return; }
    const idle = drag ? performance.now() - drag.t : 0, tap = drag && !mode && performance.now() - drag.t0 < 300; drag = null;
    if (tap) { const n = performance.now(); if (n - lastTap < 300) { lastTap = 0; zoomTo(zoom > 1 ? 1 : 2); return; } lastTap = n; }
    if (mode === 'swipe') { if (dy > 110) return close(); }
    if (idle > 80) vy = 0; // finger rested before lifting: no fling
    mode = ''; settle(); }
  function zoomTo(z) { const z0 = zoom, t0 = performance.now(); cancelAnimationFrame(raf); (function f(n) { const k = Math.min(1, (n - t0) / 260), e = 1 - Math.pow(1 - k, 3); zoom = z0 + (z - z0) * e; apply(); if (k < 1) raf = requestAnimationFrame(f); else raf = 0; })(t0); }
  function settle() { let last = performance.now(), vx = 0, vd = 0; // inertia (exponential decay), then a critically-damped spring to the nearest face; tilt + swipe offset spring back
    const step = n => { const dt = Math.min(.033, (n - last) / 1000); last = n;
      if (Math.abs(vy) > 40) { ry += vy * dt; vy *= Math.pow(.04, dt); }
      else { vy = 0; const tgt = Math.round(ry / 180) * 180, k = 120, d = 2 * Math.sqrt(k); vx += (-(ry - tgt) * k - vx * d) * dt; ry += vx * dt; if (Math.abs(ry - tgt) < .05 && Math.abs(vx) < .5) ry = tgt; }
      rx += -rx * Math.min(1, dt * 10); vd += (-dy * 220 - vd * 2 * Math.sqrt(220)) * dt; dy = Math.max(0, dy + vd * dt);
      apply(); const done = !vy && ry === Math.round(ry / 180) * 180 && Math.abs(rx) < .05 && dy < .3;
      if (done) { rx = 0; dy = 0; apply(); raf = 0; } else raf = requestAnimationFrame(step); };
    cancelAnimationFrame(raf); raf = requestAnimationFrame(step); }
  function open(cc) { if (!cc) return; if (!el) build(); c = cc; ry = 0; rx = 0; vy = 0; zoom = 1; dy = 0;
    const g = c.graded ? ' graded' : '', fb = back(c);
    $('.insp-f.front', el).innerHTML = `<img src="${front(c)}" alt="${c.name} (front)" draggable="false">${c.graded && !c.slabFront && typeof slabTop === 'function' ? slabTop(c) : ''}`;
    $('.insp-f.front', el).className = 'insp-f front' + g; $('.insp-f.back', el).innerHTML = fb ? `<img src="${fb}" alt="${c.name} (back)" draggable="false">` : genericBack(c);
    $('.insp-cap', el).innerHTML = `<b>${c.name}</b><span>${c.set} · #${c.number}${c.graded ? ' · ' + c.graded.label : ''}</span>`;
    apply(); el.classList.add('open'); window.SkyLayer?.(); history.pushState({ rzInsp: 1 }, '');
    card.animate([{ transform: 'translate3d(0,40px,0) scale(.86) rotateY(-24deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.2,.9,.25,1)' }); }
  function close(fromPop) { if (!el?.classList.contains('open')) return false; cancelAnimationFrame(raf); raf = 0; el.classList.remove('open'); window.SkyLayer?.(); if (!fromPop && history.state?.rzInsp) history.back(); return true; }
  addEventListener('popstate', () => close(true));
  return { open, close, isOpen: () => !!el?.classList.contains('open'), _state: () => ({ ry, rx, zoom, dy }) };
})();
