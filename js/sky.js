/* v0.9.16 Sky: one shared, always-on canvas behind the whole UI (home, tabs, sheets, rip stage, reveal).
   Matte starfield + soft shooting stars + big-win rockets. One rAF loop, never restarted between screens;
   paused when the page is hidden; static stars only under prefers-reduced-motion. */
(function () {
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cv = document.createElement('canvas'); cv.id = 'sky'; cv.setAttribute('aria-hidden', 'true');
  document.body.prepend(cv); const ctx = cv.getContext('2d', { alpha: true });
  let W = 0, H = 0, dpr = 1, stars = [], shots = [], rockets = [], parts = [], raf = 0, last = 0, nextShot = 0, frames = [];
  const MAX_PARTS = 360;
  const dot = (() => { const k = document.createElement('canvas'); k.width = k.height = 32; const g = k.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.45, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return k; })();
  const tint = {}; function tinted(c) { if (tint[c]) return tint[c]; const k = document.createElement('canvas'); k.width = k.height = 32; const g = k.getContext('2d'); g.drawImage(dot, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = c; g.fillRect(0, 0, 32, 32); return tint[c] = k; }
  function size() { dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(W * H / 2600); stars = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() < .12 ? 1.4 : .5 + Math.random() * .7, a: .25 + Math.random() * .5, t: Math.random() * 6.28, s: .4 + Math.random() * 1.2 }));
    if (RM) draw(0); }
  function shoot(now) { const fromL = Math.random() < .5, ang = (fromL ? 1 : -1) * (.32 + Math.random() * .3), sp = W * (.9 + Math.random() * .6);
    shots.push({ x: fromL ? Math.random() * W * .5 : W * .5 + Math.random() * W * .5, y: Math.random() * H * .45, vx: Math.cos(ang) * sp * (fromL ? 1 : 1), vy: Math.abs(Math.sin(ang)) * sp, life: 0, dur: .7 + Math.random() * .5, len: 60 + Math.random() * 70 });
    nextShot = now + 1600 + Math.random() * 2600; }
  function draw(dt) {
    ctx.clearRect(0, 0, W, H);
    for (const s of stars) { s.t += dt * s.s; const a = RM ? s.a : s.a * (.75 + .25 * Math.sin(s.t)); ctx.globalAlpha = a; ctx.fillStyle = '#dfe3ff'; ctx.fillRect(s.x, s.y, s.r, s.r); }
    for (let i = shots.length - 1; i >= 0; i--) { const s = shots[i]; s.life += dt; const k = s.life / s.dur; if (k >= 1) { shots.splice(i, 1); continue; }
      s.x += s.vx * dt; s.y += s.vy * dt; const m = Math.hypot(s.vx, s.vy), ux = s.vx / m, uy = s.vy / m, fade = Math.sin(Math.PI * k);
      const g = ctx.createLinearGradient(s.x, s.y, s.x - ux * s.len, s.y - uy * s.len); g.addColorStop(0, `rgba(220,228,255,${.7 * fade})`); g.addColorStop(1, 'rgba(220,228,255,0)');
      ctx.globalAlpha = 1; ctx.strokeStyle = g; ctx.lineWidth = 1.3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - ux * s.len, s.y - uy * s.len); ctx.stroke(); }
    for (let i = rockets.length - 1; i >= 0; i--) { const r = rockets[i]; r.t += dt; const k = Math.min(1, r.t / r.dur), e = 1 - Math.pow(1 - k, 3); // ease-out rise
      const y = r.y0 + (r.y1 - r.y0) * e, x = r.x0 + (r.x1 - r.x0) * e; ctx.globalAlpha = .55 * (1 - k * .4); ctx.drawImage(tinted(r.c), x - 4, y - 4, 8, 8);
      ctx.globalAlpha = .18; ctx.drawImage(tinted(r.c), x - 3, y + 6, 6, 14);
      if (k >= 1) { rockets.splice(i, 1); burst(x, y, r.c, r.n); } }
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.t += dt; const k = p.t / p.dur; if (k >= 1) { parts.splice(i, 1); continue; }
      const drag = Math.pow(.2, dt); p.vx *= drag; p.vy = p.vy * drag + 60 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      ctx.globalAlpha = Math.pow(1 - k, 1.3); const z = p.z * (1 - k * .35); ctx.drawImage(tinted(p.c), p.x - z / 2, p.y - z / 2, z, z); }
    ctx.globalAlpha = 1;
  }
  function burst(x, y, c, n) { const pal = [c, '#f3efe6', c, '#ffe7b0']; n = Math.min(n, MAX_PARTS - parts.length); for (let i = 0; i < n; i++) { const a = i / n * 6.283 + Math.random() * .2, sp = 110 + Math.random() * 120;
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, dur: 1.1 + Math.random() * .7, z: 11 + Math.random() * 7, c: pal[i % 3] }); } }
  function loop(now) { raf = requestAnimationFrame(loop); const dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
    if (now > nextShot) shoot(now); draw(dt); frames.push(now); if (frames.length > 240) frames.shift(); }
  function start() { if (RM || raf) return; last = 0; raf = requestAnimationFrame(loop); }
  function stop() { cancelAnimationFrame(raf); raf = 0; }
  addEventListener('resize', size); document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
  // layer: behind the app normally; just under the pack picker (z 70) or the rip stage (z 40) while they are up, with the app bg colour so the shop never shows through
  function layer() { const pp = document.querySelector('.pp'), st = document.getElementById('stage'), z = document.querySelector('#insp.open') ? 79 : pp ? 69 : st?.classList.contains('open') ? 39 : 0;
    if (cv.style.zIndex !== String(z)) { cv.style.zIndex = z; cv.classList.toggle('lift', z > 0); } }
  new MutationObserver(layer).observe(document.body, { childList: true, subtree: false }); window.SkyLayer = layer;
  addEventListener('DOMContentLoaded', () => { const st = document.getElementById('stage'); if (st) new MutationObserver(layer).observe(st, { attributes: true, attributeFilter: ['class'] }); layer(); });
  size(); nextShot = performance.now() + 900; start();
  window.Sky = {
    /* big-win rockets (Blue band and up): rise from the bottom, burst behind the card */
    rockets(lvl, col) { if (RM) return; const cols = lvl >= 4 ? ['#ffcc33', '#ff6fa8', '#5fe3ff', '#7dffb2', '#ffcc33'] : [col, '#9fb4ff', col, '#ffd27a'];
      const count = [0, 0, 3, 4, 6][lvl] || 3; for (let i = 0; i < count; i++) setTimeout(() => { const side = i % 2 ? 1 : -1, x0 = W * (.5 + side * (.2 + Math.random() * .25));
        rockets.push({ x0, y0: H + 10, x1: x0 + (Math.random() - .5) * 60, y1: H * (.1 + Math.random() * .45), t: 0, dur: .9 + Math.random() * .35, c: cols[i % cols.length], n: lvl >= 4 ? 70 : 50 }); }, i * 260 + Math.random() * 120); },
    fps() { if (frames.length < 2) return 0; return Math.round((frames.length - 1) * 1000 / (frames[frames.length - 1] - frames[0])); },
    stats: () => ({ parts: parts.length, rockets: rockets.length, shots: shots.length, stars: stars.length })
  };
})();
