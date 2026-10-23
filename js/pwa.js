/* RipZone v0.11.1 web app (PWA) layer: iPhone install hint + Web Push (TEST MODE, mock server).
   Only the VAPID *public* key lives here; the private key stays in ~/tools/secrets/ripzone-vapid.json (scripts/send_push.mjs). */
(() => {
  const VAPID_PUBLIC = 'BJ8o-Fo3d4vTEvRbNEkJ_dRhBOOR_AYxzn1apPw_nbTiJdiPf7yCE666hrSzpUPANPIPXuMhPcuMdmKSsOgA9aI';
  const native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  if (native) return;
  const ua = navigator.userAgent, iOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const safari = iOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|GSA\//.test(ua);
  const installed = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  const $ = s => document.querySelector(s);
  const b64 = s => { const p = '='.repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, c => c.charCodeAt(0)); };
  const toast = m => (window.__rzi && window.__rzi.toast) ? window.__rzi.toast(m) : alert(m);

  /* ---- install hint: Safari on iPhone, not yet installed ---- */
  function hint(force) {
    if (!(safari && !installed)) return false;
    if (!force && localStorage.getItem('rz.iosHint') === 'x') return true;
    if ($('#iosHint')) return true;
    const d = document.createElement('div'); d.id = 'iosHint'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Install RipZone');
    d.innerHTML = `<div class="ih-card"><img src="icons/apple-touch-icon-180.png" alt="" class="ih-ico"><h3>Install RipZone on your iPhone</h3>
      <ol><li>Tap <b>Share</b> <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg> in Safari's toolbar</li>
      <li>Scroll down and tap <b>Add to Home Screen</b> <span class="ih-plus">＋</span></li><li>Open RipZone from your Home Screen to turn on notifications</li></ol>
      <button class="cta" id="ihOk">Got it</button></div><div class="ih-arrow">▼</div>`;
    document.body.append(d); $('#ihOk').onclick = () => { localStorage.setItem('rz.iosHint', 'x'); d.remove(); };
    return true;
  }

  /* ---- Web Push (test mode) ---- */
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  async function enable() {
    if (iOS && !installed) return hint(true);
    if (!supported) return toast('Notifications aren\'t supported in this browser');
    const perm = await Notification.requestPermission(); if (perm !== 'granted') { render(); return toast('Notifications are blocked. Turn them on in Settings › Notifications › RipZone'); }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    try { if (!sub) sub = await Promise.race([reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID_PUBLIC) }), new Promise((_, r) => setTimeout(() => r(new Error('push service timeout')), 8000))]); } catch (e) { console.warn('push subscribe', e); }
    // mock server: keep the subscription locally (production: POST /v1/me/push-subscriptions)
    if (sub) localStorage.setItem('rz.push.sub', JSON.stringify(sub.toJSON ? sub.toJSON() : sub));
    await reg.showNotification('RipZone notifications are on', { body: 'Test notification: you\'ll hear about new drops and shipped cards here.', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'rz-test', data: { url: './' } });
    render(); toast('🔔 Notifications on · test notification sent');
  }
  async function test() { const reg = await navigator.serviceWorker.ready; reg.showNotification('RipZone test', { body: 'This is a test notification (test mode).', icon: 'icons/icon-192.png', tag: 'rz-test', data: { url: './' } }); }
  function render() {
    const b = $('#pushBtn'), t = $('#pushTxt'); if (!b) return; b.hidden = false;
    const on = supported && Notification.permission === 'granted';
    t.textContent = on ? 'Send a test notification' : (iOS && !installed) ? 'Enable notifications (install first)' : 'Enable notifications';
    b.onclick = () => on ? test() : enable();
  }
  const go = () => { render(); if (safari && !installed) setTimeout(() => hint(false), 2500); };
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', go) : go();
  window.RZPush = { enable, test, hint };
})();
