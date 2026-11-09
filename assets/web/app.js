/* Stream+ for Google TV — web UI (an unofficial client for Twitch).
 * Data: Twitch Helix API (official). Playback: Twitch's official embed player (one per stream,
 * each with its own volume). Native side (window.Native): HTTP without CORS, QR codes, the
 * floating PiP window, synthesized taps. */
'use strict';

// ======================================================================= utilities
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HAS_NATIVE = !!window.Native;
const APP = HAS_NATIVE && Native.appName ? Native.appName() : 'Stream+';

function fmtN(n) {
  n = +n || 0;
  const f = (x, u) => (x >= 100 ? Math.round(x) : x.toFixed(1).replace(/\.0$/, '')).toString().replace('.', ',') + ' ' + u;
  if (n >= 1e6) return f(n / 1e6, 'M');
  if (n >= 1e3) return f(n / 1e3, 'k');
  return String(n);
}
function dur(s) { // "3h2m1s" → "3:02:01"
  const m = /(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/.exec(s || '') || [];
  const H = +m[1] || 0, M = +m[2] || 0, S = +m[3] || 0;
  return (H ? H + ':' + String(M).padStart(2, '0') : M) + ':' + String(S).padStart(2, '0');
}
function secs(t) { t = Math.max(0, Math.floor(t || 0)); const H = Math.floor(t / 3600), M = Math.floor(t % 3600 / 60), S = t % 60;
  return (H ? H + ':' + String(M).padStart(2, '0') : M) + ':' + String(S).padStart(2, '0'); }
function toTime(t) { t = Math.max(0, Math.floor(t || 0)); return Math.floor(t / 3600) + 'h' + Math.floor(t % 3600 / 60) + 'm' + (t % 60) + 's'; }
const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
function ago(iso) {
  const d = (Date.parse(iso) - Date.now()) / 1000, a = Math.abs(d);
  if (a < 3600) return rtf.format(Math.round(d / 60), 'minute');
  if (a < 86400) return rtf.format(Math.round(d / 3600), 'hour');
  if (a < 86400 * 30) return rtf.format(Math.round(d / 86400), 'day');
  if (a < 86400 * 365) return rtf.format(Math.round(d / 86400 / 30), 'month');
  return rtf.format(Math.round(d / 86400 / 365), 'year');
}
function uptime(iso) { const m = Math.floor((Date.now() - Date.parse(iso)) / 60000); return Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0'); }
const bust = () => Math.floor(Date.now() / 120000);
const sThumb = (s, w = 640, h = 360) => (s.thumbnail_url || '').replace('{width}', w).replace('{height}', h) + '?t=' + bust();
const vThumb = (v, w = 640, h = 360) => { const u = v.thumbnail_url || ''; return !u || u.includes('404_processing') ? '' : u.replace('%{width}', w).replace('%{height}', h).replace('{width}', w).replace('{height}', h); };
const gBox = (g, w = 285, h = 380) => (g.box_art_url || '').replace('{width}', w).replace('{height}', h).replace('-52x72', `-${w}x${h}`);
const BLANK = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="9" fill="#1d1a26"/></svg>');

const I = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  browse: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  multi: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
  pin: '<path d="M9 3h6l-1 6 4 4H6l4-4z"/><path d="M12 13v8"/>',
  pinf: '<path fill="currentColor" d="M9 3h6l-1 6 4 4H6l4-4z"/><path d="M12 13v8"/>',
  pip: '<rect x="2.5" y="4" width="19" height="16" rx="2.5"/><rect x="12" y="11.5" width="7" height="6" rx="1.2" fill="currentColor"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  play: '<path fill="currentColor" d="M7 4.5v15l13-7.5z"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>',
  vol: '<path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  mute: '<path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z"/><path d="m17 9 5 6M22 9l-5 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  tap: '<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V12m0-1a1.5 1.5 0 0 1 3 0v4a6 6 0 0 1-6 6h-.5a6 6 0 0 1-5-2.7L4.6 15a1.5 1.5 0 0 1 2.4-1.8L9 15"/>',
  back10: '<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v4h4"/><text x="12" y="15.5" font-size="7" text-anchor="middle" fill="currentColor" stroke="none" font-family="Inter" font-weight="700">10</text>',
  fwd10: '<path d="M20 12a8 8 0 1 1-2.5-5.8"/><path d="M20 4v4h-4"/><text x="12" y="15.5" font-size="7" text-anchor="middle" fill="currentColor" stroke="none" font-family="Inter" font-weight="700">10</text>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  solo: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5" fill="currentColor"/><rect x="17" y="14" width="4" height="6" rx="1.5" fill="currentColor"/>',
  chat: '<path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1z"/><path d="M8 10h8M8 13h5"/>',
  logout: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l-5-5 5-5M5 12h11"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  heartf: '<path fill="currentColor" d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
};
const ic = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${I[n]}</svg>`;

function toast(msg, ms = 2600) {
  const top = layers[layers.length - 1];
  if (top && top.say) return top.say(msg);
  if (top && isVideoLayer(top)) return console.log('toast: ' + msg);
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), ms);
}

// ======================================================================= native bridge
const pending = {}; let seq = 0;
window.__nativeCb = (id, status, b64) => {
  const p = pending[id]; delete pending[id]; if (!p) return;
  const bin = atob(b64), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  p({ status, text: new TextDecoder().decode(bytes) });
};
function http(method, url, headers = {}, body = '') {
  if (!HAS_NATIVE) return fetch(url, { method, headers, body: body || undefined })
    .then(async r => ({ status: r.status, text: await r.text() })).catch(e => ({ status: 0, text: String(e) }));
  return new Promise(res => { const id = ++seq; pending[id] = res; Native.http(id, method, url, JSON.stringify(headers), body || ''); });
}
const form = o => Object.entries(o).filter(([, v]) => v != null && v !== '').map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');

// ======================================================================= storage & config
// Secrets (each profile's Twitch token and twitch.tv session, the Client Secret) are stored encrypted
// with a key of the Android Keystore that never leaves the TV (Native.seal / Native.unseal).
const SEALED = k => k === 'global' || /\.(auth|psess)$/.test(k);
const canSeal = HAS_NATIVE && !!Native.seal;
const raw = {
  get(k, d) {
    try {
      const s = localStorage.getItem('tp.' + k); if (s == null) return d;
      let v = JSON.parse(s);
      if (typeof v === 'string' && v.startsWith('sp1:')) { const o = canSeal ? Native.unseal(v) : null; return o == null ? d : JSON.parse(o); }
      if (SEALED(k) && canSeal && v != null) raw.set(k, v);  // stored in clear by an earlier version: encrypt it now
      return v;
    } catch (e) { return d; }
  },
  set(k, v) {
    try {
      if (v === undefined) return localStorage.removeItem('tp.' + k);
      let out = v;
      if (SEALED(k) && canSeal && v != null) { const e = Native.seal(JSON.stringify(v)); if (e) out = e; }
      localStorage.setItem('tp.' + k, JSON.stringify(out));
    } catch (e) { }
  },
};
// Secrets still in clear (earlier versions) are encrypted at start.
if (canSeal) try { Object.keys(localStorage).forEach(k => { if (k.startsWith('tp.') && SEALED(k.slice(3))) raw.get(k.slice(3)); }); } catch (e) { }

// ---------- Profiles: each one has its own Twitch account, pins, multistream, settings and
// twitch.tv player session. The app opens on the last profile used.
const PER_PROFILE = ['auth', 'pins', 'multi', 'cfg', 'psess', 'vpos', 'tpos'];
let profiles = raw.get('profiles', null);
let profileId = raw.get('profile', null);
if (!profiles) {
  // First run of this version: today's data becomes the first profile.
  const a = raw.get('auth', null);
  profiles = [{ id: 'p1', name: (a && a.name) || 'Profil 1', avatar: (a && a.avatar) || '' }];
  profileId = 'p1';
  PER_PROFILE.forEach(k => { const v = raw.get(k, undefined); if (v !== undefined) { raw.set('p1.' + k, v); } });
  const c = raw.get('cfg', {});
  raw.set('global', { clientId: c.clientId || '', clientSecret: c.clientSecret || '' });
  raw.set('profiles', profiles); raw.set('profile', profileId);
}
if (!profiles.some(p => p.id === profileId)) profileId = profiles[0].id;
// Copies from before profiles existed (already moved into the first profile): never left in clear.
['auth', 'psess'].forEach(k => { try { localStorage.removeItem('tp.' + k); } catch (e) { } });
const profile = () => profiles.find(p => p.id === profileId);
const store = {
  get(k, d) { return raw.get(PER_PROFILE.includes(k) ? profileId + '.' + k : k, d); },
  set(k, v) { raw.set(PER_PROFILE.includes(k) ? profileId + '.' + k : k, v); },
};
let gcfg = raw.get('global', { clientId: '', clientSecret: '' });
let cfg = Object.assign({ lang: 'fr', mq: '480', autoPip: true, vol: 1, chat: true, mchat: true, chatMode: 'fast', quality: 'source', lowLat: true }, store.get('cfg', {}), { clientId: gcfg.clientId, clientSecret: gcfg.clientSecret });
const saveCfg = () => {
  const { clientId, clientSecret, ...mine } = cfg;
  gcfg = { clientId, clientSecret }; raw.set('global', gcfg);
  store.set('cfg', mine);
};
function saveProfiles() { raw.set('profiles', profiles); raw.set('profile', profileId); }
/** Keeps the profile's name and picture in sync with its Twitch account. */
function syncProfile() {
  const p = profile(); if (!p || !auth) return;
  if (p.name !== auth.name || p.avatar !== auth.avatar) { p.name = auth.name; p.avatar = auth.avatar; saveProfiles(); }
}
/** Switches profile: saves this one's twitch.tv session, restores the other's, reloads the app. */
function switchProfile(id) {
  if (HAS_NATIVE) { store.set('psess', Native.playerSession()); }
  profileId = id; saveProfiles();
  if (HAS_NATIVE) Native.setPlayerSession(store.get('psess', '{}'));
  if (HAS_NATIVE) Native.keepOn(false);
  setTimeout(() => location.reload(), 250);
}
function addProfile() {
  const id = 'p' + Date.now().toString(36);
  profiles.push({ id, name: 'Profil ' + (profiles.length + 1), avatar: '' });
  saveProfiles(); switchProfile(id);
}
function deleteProfile(id) {
  if (profiles.length < 2) return toast('Il faut garder au moins un profil');
  profiles = profiles.filter(p => p.id !== id);
  PER_PROFILE.forEach(k => raw.set(id + '.' + k, undefined));
  if (id === profileId) switchProfile(profiles[0].id); else { saveProfiles(); renderSide(); }
}
/** "Qui regarde ?": pick, add or remove profiles. */
function profilePanel() {
  const l = modal(`<h2>Qui regarde ?</h2><p class="sub">Chaque profil a son compte Twitch, ses épinglés, son multistream et ses réglages. Menu sur un profil pour le supprimer.</p><div class="profs"></div>`, { cls: 'sm' });
  const box = $('.profs', l.el);
  profiles.forEach(p => {
    const t = h(`<div class="prof f ${p.id === profileId ? 'cur' : ''}" tabindex="-1"><div class="pa">${p.avatar ? `<img src="${esc(p.avatar)}">` : `<span>${esc((p.name || '?')[0].toUpperCase())}</span>`}</div><b>${esc(p.name)}</b><small>${p.id === profileId ? 'Profil actuel' : ''}</small></div>`);
    t.onclick = () => { l.close(); if (p.id !== profileId) switchProfile(p.id); };
    t._ctx = null;
    t.addEventListener('keydown', e => { if (e.key === 'ContextMenu') deleteAsk(p); });
    t._menu = () => deleteAsk(p);
    box.appendChild(t);
  });
  const add = h(`<div class="prof add f" tabindex="-1"><div class="pa">${ic('plus')}</div><b>Ajouter</b><small>un compte Twitch</small></div>`);
  add.onclick = () => { l.close(); addProfile(); };
  box.appendChild(add);
  const deleteAsk = p => choose(`Supprimer « ${p.name} » ?`, [{ label: 'Supprimer', icon: 'x', run: () => { l.close(); deleteProfile(p.id); } }, { label: 'Annuler', run: () => { } }], 'Ses épinglés, son multistream et sa connexion seront effacés de cette TV.');
  setFocus($('.prof.cur', box) || box.firstElementChild);
}
let auth = store.get('auth', null);      // {token, refresh, userId, login, name, avatar}
let appTok = store.get('apptok', null);  // {token, exp}
let pins = store.get('pins', []);        // [{id, login, name, avatar}]
let multi = store.get('multi', []);      // [{channel, id, name, avatar, vol, muted}]
const LANGS = [['fr', 'Français'], ['', 'Toutes les langues'], ['en', 'English'], ['es', 'Español'], ['de', 'Deutsch'], ['it', 'Italiano'], ['pt', 'Português']];
const langName = c => (LANGS.find(l => l[0] === c) || LANGS[1])[1];

async function loadFileConfig() {
  try {
    const r = await fetch('config.json', { cache: 'no-store' });
    const j = await r.json();
    if (j.clientId && !cfg.clientId) cfg.clientId = j.clientId;
    if (j.clientSecret && !cfg.clientSecret) cfg.clientSecret = j.clientSecret;
    saveCfg();
  } catch (e) { }
}

// ======================================================================= Twitch API (Helix)
class NeedAuth extends Error {}
const ready = () => !!cfg.clientId && !!(auth || cfg.clientSecret);

async function token() {
  if (auth && auth.token) return auth.token;
  if (cfg.clientSecret) {
    if (appTok && appTok.exp > Date.now() + 60000) return appTok.token;
    const r = await http('POST', 'https://id.twitch.tv/oauth2/token', { 'Content-Type': 'application/x-www-form-urlencoded' },
      form({ client_id: cfg.clientId, client_secret: cfg.clientSecret, grant_type: 'client_credentials' }));
    if (r.status !== 200) throw new Error('Client Secret refusé par Twitch (' + r.status + ')');
    const j = JSON.parse(r.text);
    appTok = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 }; store.set('apptok', appTok);
    return appTok.token;
  }
  throw new NeedAuth('login');
}
async function refreshUser() {
  if (!auth || !auth.refresh) { auth = null; store.set('auth', null); return false; }
  const r = await http('POST', 'https://id.twitch.tv/oauth2/token', { 'Content-Type': 'application/x-www-form-urlencoded' },
    form({ client_id: cfg.clientId, client_secret: cfg.clientSecret || null, grant_type: 'refresh_token', refresh_token: auth.refresh }));
  if (r.status === 200) {
    const j = JSON.parse(r.text); auth.token = j.access_token; auth.refresh = j.refresh_token || auth.refresh; store.set('auth', auth); return true;
  }
  if (r.status >= 400) { auth = null; store.set('auth', null); renderSide(); }
  return false;
}
function qs(p) {
  const parts = [];
  for (const [k, v] of Object.entries(p || {})) {
    if (v == null || v === '') continue;
    (Array.isArray(v) ? v : [v]).forEach(x => parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(x)));
  }
  return parts.length ? '?' + parts.join('&') : '';
}
async function helix(path, params) {
  if (!cfg.clientId) throw new NeedAuth('client');
  const url = 'https://api.twitch.tv/helix/' + path + qs(params);
  for (let attempt = 0; attempt < 2; attempt++) {
    const tok = await token();
    const r = await http('GET', url, { 'Client-Id': cfg.clientId, Authorization: 'Bearer ' + tok });
    if (r.status === 401 && attempt === 0) { if (auth) await refreshUser(); else { appTok = null; store.set('apptok', null); } continue; }
    if (r.status === 0) throw new Error('Pas de connexion réseau');
    if (r.status >= 400) { let m = r.text; try { m = JSON.parse(r.text).message; } catch (e) { } throw new Error('Twitch ' + r.status + ' : ' + m); }
    return JSON.parse(r.text);
  }
  throw new NeedAuth('login');
}
const userCache = {};
async function users({ ids = [], logins = [] }) {
  const needId = ids.filter(i => i && !userCache['#' + i]), needLogin = logins.filter(l => l && !userCache[l.toLowerCase()]);
  const jobs = [];
  for (let i = 0; i < needId.length; i += 100) jobs.push(helix('users', { id: needId.slice(i, i + 100) }));
  for (let i = 0; i < needLogin.length; i += 100) jobs.push(helix('users', { login: needLogin.slice(i, i + 100) }));
  (await Promise.all(jobs)).forEach(r => r.data.forEach(u => { userCache['#' + u.id] = u; userCache[u.login] = u; }));
  return { byId: id => userCache['#' + id], byLogin: l => userCache[(l || '').toLowerCase()] };
}
async function withAvatars(streams) { const u = await users({ ids: streams.map(s => s.user_id) }); streams.forEach(s => { s._u = u.byId(s.user_id); }); return streams; }
const topStreams = (p = {}) => helix('streams', Object.assign({ first: 24, language: cfg.lang || null }, p));
async function followedLive() { if (!auth) return []; return (await helix('streams/followed', { user_id: auth.userId, first: 100 })).data; }

// ======================================================================= pins (épingles)
let pinLive = {}; // user_id → stream
const isPinned = id => pins.some(p => p.id === id);
function togglePin(u) {
  if (isPinned(u.id)) { pins = pins.filter(p => p.id !== u.id); toast('Chaîne désépinglée'); }
  else { pins.push({ id: u.id, login: u.login, name: u.display_name || u.name || u.login, avatar: u.profile_image_url || u.avatar || '' }); toast('📌 ' + (u.display_name || u.login) + ' épinglée'); }
  store.set('pins', pins); renderSide(); refreshPins();
  return isPinned(u.id);
}
async function refreshPins() {
  if (!ready() || !pins.length) { pinLive = {}; renderPins(); return; }
  try {
    const live = {};
    for (let i = 0; i < pins.length; i += 100) (await helix('streams', { user_id: pins.slice(i, i + 100).map(p => p.id), first: 100 })).data.forEach(s => { live[s.user_id] = s; });
    pinLive = live;
    const u = await users({ ids: pins.map(p => p.id) });
    pins.forEach(p => { const x = u.byId(p.id); if (x) { p.avatar = x.profile_image_url; p.name = x.display_name; p.login = x.login; } });
    store.set('pins', pins);
  } catch (e) { console.warn(e); }
  renderPins();
}
const pinsSorted = () => [...pins].sort((a, b) => (pinLive[b.id] ? pinLive[b.id].viewer_count + 1e9 : 0) - (pinLive[a.id] ? pinLive[a.id].viewer_count + 1e9 : 0) || a.name.localeCompare(b.name));

// ======================================================================= focus engine (D-pad)
let layers = [];          // stack of {el, onKey, close, prev}
let lastMain = null, lastFocus = null;
const scopeEl = () => layers.length ? layers[layers.length - 1].el : document.body;
const visible = e => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
const focusables = scope => $$('.f', scope).filter(visible);
function setFocus(el, noScroll) {
  if (!el) return;
  el.focus({ preventScroll: true });
  if (!noScroll) reveal(el);
}
function focusFirst(scope = scopeEl()) {
  const zone = scope === document.body ? ($('#main .f') ? $('#main') : $('#side')) : scope;
  // data-late: reachable, but never the element focused first (e.g. the home's refresh button)
  const pick = l => l.find(e => !e.hasAttribute('data-late')) || l[0];
  const el = pick(focusables(zone)) || pick(focusables(scope));
  if (el) setFocus(el);
}
function reveal(el) {
  const rail = el.closest('.rail');
  if (rail) {
    const r = el.getBoundingClientRect(), rr = rail.getBoundingClientRect();
    if (r.left < rr.left + 30) rail.scrollLeft -= (rr.left + 30 - r.left);
    else if (r.right > rr.right - 140) rail.scrollLeft += (r.right - (rr.right - 140));
  }
  const sc = el.closest('#main, .sheet');
  if (sc) {
    const r = el.getBoundingClientRect(), sr = sc.getBoundingClientRect();
    if (r.top < sr.top + 120 || r.bottom > sr.bottom - 60) sc.scrollTop += (r.top + r.height / 2) - (sr.top + sr.height * 0.48);
  }
}
function nearest(cur, dir, list) {
  // Up/down go one line at a time: the closest line in that direction, then the closest element on it.
  if (dir === 'up' || dir === 'down') {
    const a = cur.getBoundingClientRect(), acy = a.top + a.height / 2;
    const c = [];
    for (const e of list) {
      if (e === cur) continue;
      const b = e.getBoundingClientRect(); if (!b.width) continue;
      const bcy = b.top + b.height / 2;
      if (dir === 'down' ? bcy <= acy + 2 : bcy >= acy - 2) continue;
      c.push({ e, b, cy: bcy, p: dir === 'down' ? Math.max(0, b.top - a.bottom) : Math.max(0, a.top - b.bottom) });
    }
    if (!c.length) return null;
    const first = c.reduce((m, x) => x.p < m.p ? x : m);
    const line = c.filter(x => x.cy > first.b.top && x.cy < first.b.bottom);
    return nearestX(a, line.length ? line : [first]);
  }
  return nearest0(cur, dir, list);
}
function nearestX(a, items) {
  const acx = a.left + a.width / 2;
  let best = null, bs = Infinity;
  for (const { e, b } of items) {
    const s = (b.right > a.left && b.left < a.right) ? 0 : Math.min(Math.abs(b.left - a.right), Math.abs(a.left - b.right));
    const score = s + Math.abs(b.left + b.width / 2 - acx) * 0.05;
    if (score < bs) { bs = score; best = e; }
  }
  return best;
}
function nearest0(cur, dir, list) {
  const a = cur.getBoundingClientRect(), acx = a.left + a.width / 2, acy = a.top + a.height / 2;
  let best = null, bs = Infinity;
  for (const e of list) {
    if (e === cur) continue;
    const b = e.getBoundingClientRect(); if (!b.width) continue;
    const bcx = b.left + b.width / 2, bcy = b.top + b.height / 2;
    let p, s, t;
    if (dir === 'right' || dir === 'left') {
      if (dir === 'right' ? bcx <= acx + 2 : bcx >= acx - 2) continue;
      p = dir === 'right' ? Math.max(0, b.left - a.right) : Math.max(0, a.left - b.right);
      s = (b.bottom > a.top && b.top < a.bottom) ? 0 : Math.min(Math.abs(b.top - a.bottom), Math.abs(a.top - b.bottom));
      t = Math.abs(bcy - acy);
    } else {
      if (dir === 'down' ? bcy <= acy + 2 : bcy >= acy - 2) continue;
      p = dir === 'down' ? Math.max(0, b.top - a.bottom) : Math.max(0, a.top - b.bottom);
      s = (b.right > a.left && b.left < a.right) ? 0 : Math.min(Math.abs(b.left - a.right), Math.abs(a.left - b.right));
      t = Math.abs(bcx - acx);
    }
    const score = p + s * 5 + t * 0.08;
    if (score < bs) { bs = score; best = e; }
  }
  return best;
}
function move(dir) {
  const cur = document.activeElement, scope = scopeEl();
  if (!cur || !cur.classList || !cur.classList.contains('f') || !scope.contains(cur)) return focusFirst(scope);
  const zone = cur.closest('[data-zone]') || scope;
  if (dir === 'right' && zone.id === 'side' && lastMain && document.contains(lastMain) && visible(lastMain)) return setFocus(lastMain);
  let list = focusables(zone);
  if (dir === 'left' || dir === 'right') {
    // Left/right stay on the same line (a rail, a button bar); only past its end do we leave it.
    const a = cur.getBoundingClientRect(), mid = (a.top + a.bottom) / 2;
    const row = list.filter(e => { const b = e.getBoundingClientRect(); return b.top < mid && b.bottom > mid; });
    const inRow = nearest(cur, dir, row);
    if (inRow) return setFocus(inRow);
    if (zone.id === 'main' || zone.id === 'side') list = [];  // main ⇄ sidebar handled below
  }
  let best = list.length ? nearest(cur, dir, list) : null;
  if (!best && zone !== scope) {
    if (dir === 'left' && zone.id === 'main') best = $('#side .nv.cur') || $('#side .nv');
    else if (dir === 'right' && zone.id === 'side') best = focusables($('#main'))[0];
  }
  if (best) setFocus(best);
}
// Tells Android whether OK should be measured for a long press (cards only).
let okModeOn = false;
function syncOkMode() {
  const a = document.activeElement, on = !!(a && a._ctx && a.tagName !== 'INPUT');
  if (on !== okModeOn && HAS_NATIVE) { okModeOn = on; Native.setOkMode(on); }
}
document.addEventListener('focusout', () => setTimeout(syncOkMode, 0));
document.addEventListener('focusin', e => {
  syncOkMode();
  const t = e.target; if (!t.classList || !t.classList.contains('f')) return;
  lastFocus = t;
  if (t.closest('#main')) lastMain = t;
  const inSide = !!t.closest('#side');
  $('#side').classList.toggle('open', inSide);
  if (t.closest('.slot')) $$('.slot').forEach(s => s.classList.toggle('sel', s.contains(t)));
});
// An embed must never keep the remote's focus.
window.addEventListener('blur', () => setTimeout(() => {
  const a = document.activeElement;
  if (a && a.tagName === 'IFRAME') reclaim();
}, 60));

function reclaim() {
  const top = layers[layers.length - 1], sink = top && $('.sink', top.el);
  if (lastFocus && document.contains(lastFocus) && visible(lastFocus) && !(top && top.el.classList.contains('noui'))) lastFocus.focus({ preventScroll: true });
  else if (sink) sink.focus({ preventScroll: true });
  else focusFirst();
}
// Sliders: focusable volume bars; ◀ ▶ change them, and pass focus on at either end.
function slider(val, muted, onChange, cls = '') {
  const el = h(`<div class="slider f glass ${cls}" tabindex="-1"><div class="tr"><i></i></div><em></em></div>`);
  el._v = val; el._m = muted;
  el.paint = () => { $('i', el).style.width = (el._v * 100) + '%'; $('em', el).textContent = el._m ? 'Muet' : Math.round(el._v * 100) + ' %'; el.classList.toggle('muted', !!el._m); };
  el.set = (v, m = el._m, user = true) => { el._v = Math.max(0, Math.min(1, Math.round(v * 20) / 20)); el._m = m; el.paint(); if (user) onChange(el._v, el._m); };
  // OK toggles adjust mode: only then do left/right change the volume.
  el.onclick = () => el.adjust(!el._adj);
  el.adjust = on => { el._adj = on; el.classList.toggle('adj', on); };
  el.addEventListener('blur', () => el.adjust(false));
  el.paint();
  return el;
}

const RATES = [1, 1.25, 1.5, 1.75, 2, 2.5, 3, 0.75];
const rateLabel = r => String(r).replace('.', ',') + '×';
const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'ok', MediaPlayPause: 'playpause', ' ': 'ok', ContextMenu: 'menu' };
document.addEventListener('keydown', e => {
  lastKeyAt = Date.now();
  const cur = document.activeElement;
  if (e.key === 'Escape' || (e.key === 'Backspace' && !(cur && cur.tagName === 'INPUT'))) { e.preventDefault(); if (!app.back()) { } return; }
  const k = KEYS[e.key]; if (!k) return;
  if (k === 'ok' && cur && cur._ctx && cur.tagName !== 'INPUT') {
    e.preventDefault();
    if (okHold) {  // key held: Android repeats it → long press right away
      // (the WebView reports repeats as plain keydowns: any second keydown before keyup = held)
      if (!okHold.fired) { okHold.fired = true; clearTimeout(okHold.t); cardMenu(okHold.el._ctx); }
      return;
    }
    okHold = { el: cur, fired: false, t: setTimeout(() => { if (okHold && !okHold.fired) { okHold.fired = true; cardMenu(okHold.el._ctx); } }, 500) };
    return;
  }
  if (cur && cur.tagName === 'INPUT') {
    if (k === 'up' || k === 'down') { e.preventDefault(); cur.blur(); lastFocus = cur.closest('.f') || cur; move(k); }
    else if (k === 'ok' && cur._submit) { cur._submit(); }
    return;
  }
  e.preventDefault();
  key(k);
}, true);

let okHold = null;
document.addEventListener('keyup', e => {
  if (!okHold || (e.key !== 'Enter' && e.key !== ' ')) return;
  e.preventDefault();
  const h = okHold; okHold = null; clearTimeout(h.t);
  if (!h.fired && document.activeElement === h.el) key('ok');
}, true);

function key(k) {
  const top = layers[layers.length - 1];
  if (top && top.onKey && top.onKey(k)) return;
  const cur = document.activeElement;
  if (cur && cur.classList.contains('slider') && cur._adj) {
    if (k === 'left' || k === 'right') { cur.set(cur._v + (k === 'left' ? -0.05 : 0.05), false); return; }
    if (k === 'ok') { cur.adjust(false); return; }
    cur.adjust(false);  // up/down: leave adjust mode and move on
  }
  if (k === 'up' || k === 'down' || k === 'left' || k === 'right') return move(k);
  if (k === 'ok') {
    if (!cur || cur === document.body || !cur.classList.contains('f')) return focusFirst();
    if (cur.classList.contains('field')) { const i = $('input', cur); i.focus(); i.click(); return; }
    cur.click(); return;
  }
  if (k === 'menu' && cur && cur._menu) return cur._menu();
  if (k === 'menu' && cur && cur._ctx) return cardMenu(cur._ctx);
}

// ======================================================================= layers & modals
function pushLayer(l) {
  l.prev = document.activeElement;
  layers.push(l);
  $('#layers').appendChild(l.el);
  return l;
}
function popLayer(l) {
  const i = layers.indexOf(l); if (i < 0) return;
  layers.splice(i, 1); l.el.remove();
  const under = layers[layers.length - 1];
  if (under && under.resume && l.kind === 'modal') under.resume();
  if (l.prev && document.contains(l.prev) && visible(l.prev)) setFocus(l.prev, true); else focusFirst();
}
function modal(inner, opts = {}) {
  const el = h(`<div class="modal"><div class="sheet glass dark ${opts.cls || ''}">${inner}</div></div>`);
  const l = { el, kind: 'modal', onKey: opts.onKey, close() { if (opts.onClose) opts.onClose(); popLayer(l); } };
  pushLayer(l);
  return l;
}
function choose(title, items, sub = '') {
  // items: [{label, icon, run}]
  const l = modal(`<h2>${esc(title)}</h2>${sub ? `<p class="sub">${esc(sub)}</p>` : '<div style="height:20px"></div>'}<div class="btns"></div>`, { cls: 'sm' });
  const box = $('.btns', l.el);
  items.forEach(it => { const b = h(`<div class="btn glass f" tabindex="-1">${it.icon ? ic(it.icon) : ''}<span>${esc(it.label)}</span></div>`); b.onclick = () => { l.close(); it.run(); }; box.appendChild(b); });
  setFocus(box.firstElementChild);
  return l;
}
function inputModal(title, sub, value, onOk) {
  const l = modal(`<h2>${esc(title)}</h2><p class="sub">${esc(sub)}</p><div class="btns"><div class="field glass f" tabindex="-1"><input type="text" autocomplete="off" spellcheck="false"></div><div class="btn pri f" tabindex="-1">Valider</div></div>`, { cls: 'sm' });
  const inp = $('input', l.el); inp.value = value || '';
  const ok = () => { l.close(); onOk(inp.value.trim()); };
  inp._submit = ok; $('.btn', l.el).onclick = ok;
  setFocus($('.field', l.el));
  return l;
}

// ======================================================================= background
// The backdrop: the artwork drawn into a tiny canvas (48x27) with the shade baked in, then
// stretched to full screen; bilinear upscaling is the blur. Debounced so fast D-pad moves
// cost nothing; two canvases crossfade.
let bgUrl = '', bgT = null, bgFlip = false;
const BG_W = 48, BG_H = 27;
function setBg(url) {
  if (!url || url === bgUrl) return;
  bgUrl = url; clearTimeout(bgT);
  bgT = setTimeout(() => {
    const img = new Image();
    img.onload = () => {
      if (bgUrl !== url) return;
      const box = $('#bg');
      let cs = $$('canvas', box);
      if (cs.length < 2) { box.innerHTML = '<canvas></canvas><canvas></canvas>'; cs = $$('canvas', box); cs.forEach(c => { c.width = BG_W; c.height = BG_H; }); }
      bgFlip = !bgFlip;
      const c = cs[bgFlip ? 0 : 1], o = cs[bgFlip ? 1 : 0], x = c.getContext('2d');
      x.filter = 'saturate(1.7) brightness(.62)';
      x.drawImage(img, 0, 0, BG_W, BG_H);
      x.filter = 'none';
      let g = x.createRadialGradient(BG_W * .9, -2, 0, BG_W * .9, -2, BG_W * .7);
      g.addColorStop(0, 'rgba(145,70,255,.35)'); g.addColorStop(1, 'rgba(145,70,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, BG_W, BG_H);
      g = x.createLinearGradient(0, 0, 0, BG_H);
      g.addColorStop(0, 'rgba(11,10,16,.2)'); g.addColorStop(.7, 'rgba(11,10,16,.8)'); g.addColorStop(1, 'rgba(11,10,16,.88)');
      x.fillStyle = g; x.fillRect(0, 0, BG_W, BG_H);
      c.classList.add('on'); o.classList.remove('on');
    };
    img.src = url;
  }, 450);
}

// ======================================================================= sidebar
const NAV = [['home', 'Accueil', 'home'], ['browse', 'Parcourir', 'browse'], ['search', 'Rechercher', 'search'], ['multi', 'Multistream', 'multi'], ['pins', 'Épinglés', 'pin']];
let pipState = null;
function renderSide() {
  const s = $('#side'); s.dataset.zone = '';
  s.id = 'side';
  const pr = profile() || {};
  s.innerHTML = `<div class="logo"><div class="mk">${ic('play')}</div><b>${esc(APP)}</b></div>`
    + `<div class="nv prof-nv f" tabindex="-1" data-nav="profile"><div class="pa">${pr.avatar ? `<img src="${esc(pr.avatar)}">` : `<span>${esc((pr.name || '?')[0].toUpperCase())}</span>`}</div><span>${esc(pr.name || 'Profil')}${profiles.length > 1 ? ' · changer' : ''}</span></div>`
    + NAV.map(([k, l, i]) => `<div class="nv f" tabindex="-1" data-nav="${k}">${ic(i)}<span>${l}${k === 'multi' && multi.length ? ' · ' + multi.length : ''}</span></div>`).join('')
    + (pipState ? `<div class="nv pipnv f" tabindex="-1" data-nav="pip">${ic('pip')}<span>PiP · ${esc(pipState.name || pipState.channel || '')}</span></div>` : '')
    + `<div class="sep"></div><div class="sh">Chaînes épinglées</div><div id="pins"></div><div class="sep"></div>`
    + `<div class="nv f" tabindex="-1" data-nav="settings">${ic('gear')}<span>Paramètres</span></div>`;
  $$('.nv', s).forEach(n => n.onclick = () => {
    const k = n.dataset.nav;
    if (k === 'multi') return openMulti();
    if (k === 'pip') return pipPanel();
    if (k === 'profile') return profilePanel();
    go(k, {}, { root: true });
  });
  markNav();
  renderPins();
}
function markNav() { const top = stack[stack.length - 1]; $$('#side .nv').forEach(n => n.classList.toggle('cur', !!top && n.dataset.nav === top.name)); }
function renderPins() {
  const box = $('#pins'); if (!box) return;
  const had = document.activeElement && document.activeElement.closest && document.activeElement.closest('#pins') ? document.activeElement.dataset.id : null;
  box.innerHTML = '';
  if (!pins.length) { box.appendChild(h(`<div class="sh" style="text-transform:none;letter-spacing:0;font-weight:500;line-height:1.4;white-space:normal">Épingle tes streamers depuis leur chaîne ou le lecteur.</div>`)); return; }
  pinsSorted().forEach(p => {
    const s = pinLive[p.id];
    const el = h(`<div class="pn f ${s ? '' : 'off'}" tabindex="-1" data-id="${p.id}"><div class="av"><img src="${esc(p.avatar || BLANK)}"><i></i></div>
      <div class="tx"><b>${esc(p.name)}</b><small>${s ? esc(s.game_name || 'En direct') : 'Hors ligne'}</small></div><div class="vw">${s ? fmtN(s.viewer_count) : ''}</div></div>`);
    el.onclick = () => s ? play(srcFromStream(s, p)) : go('channel', { login: p.login });
    el._ctx = { kind: 'channel', login: p.login, id: p.id, name: p.name, avatar: p.avatar, stream: s };
    box.appendChild(el);
    if (had === p.id) setFocus(el, true);
  });
}

// ======================================================================= router
const stack = [];
let curCtx = null;
async function go(name, params = {}, opts = {}) {
  const top = stack[stack.length - 1];
  if (top && !opts.replace) { top.scroll = $('#main').scrollTop; top.focusKey = lastMain && lastMain.dataset ? lastMain.dataset.k : null; }
  if (opts.root) stack.length = 0; else if (opts.replace) stack.pop();
  stack.push({ name, params });
  await render(false, opts.keepFocus);
}
async function render(restore, keepFocus) {
  const top = stack[stack.length - 1];
  if (curCtx) { curCtx.alive = false; if (curCtx.destroy) curCtx.destroy(); }
  const main = $('#main');
  main.style.scrollBehavior = 'auto'; main.scrollTop = 0; main.innerHTML = '';
  const ctx = curCtx = { el: main, params: top.params, alive: true };
  markNav();
  const inSide = document.activeElement && document.activeElement.closest && document.activeElement.closest('#side');
  try { await VIEWS[top.name](ctx); }
  catch (e) { if (ctx.alive) showError(ctx, e); }
  if (!ctx.alive) return;
  if (restore) {
    const el = top.focusKey && $(`#main [data-k="${CSS.escape(top.focusKey)}"]`);
    main.scrollTop = top.scroll || 0;
    if (el) setFocus(el, true); else focusFirst();
  } else if (!(keepFocus && inSide)) {
    if (!layers.length) focusFirst($('#main'));
  }
  requestAnimationFrame(() => { main.style.scrollBehavior = ''; });
}
function showError(ctx, e) {
  if (e instanceof NeedAuth) { VIEWS.setup(ctx); return; }
  ctx.el.appendChild(h(`<div class="setup glass"><div><h2>Oups</h2><p class="sub" style="font-size:22px;color:var(--dim)">${esc(e.message || e)}</p><div class="btns"><div class="btn pri f" tabindex="-1" data-k="retry">${ic('refresh')}Réessayer</div></div></div></div>`));
  $('[data-k=retry]', ctx.el).onclick = () => render();
}
/** Home refreshed in place: the new page is built aside, then swapped in with the same scroll
 * positions and the same card focused (or its neighbour if that live ended). */
let homeAt = 0, homeBusy = false, lastKeyAt = 0;
async function refreshHome(manual) {
  const top = stack[stack.length - 1];
  if (homeBusy || !top || top.name !== 'home' || !ready()) return;
  homeBusy = true;
  const main = $('#main');
  const old = curCtx;
  const ctx = { el: document.createElement('div'), params: top.params, alive: true };
  if (manual) toast('Actualisation…', 1500);
  try { await VIEWS.home(ctx); } catch (e) { homeBusy = false; if (manual) toast('Échec de l\'actualisation'); return; }
  homeBusy = false;
  // the user left home (or opened something) meanwhile: drop it
  if (curCtx !== old || stack[stack.length - 1] !== top || !ctx.alive) return;
  const a = document.activeElement, inMain = a && main.contains(a);
  const key = inMain && a.dataset ? a.dataset.k : null;
  const sec = inMain && a.closest('.sec'), secs = $$('.sec', main);
  const secI = sec ? secs.indexOf(sec) : -1, rail = inMain && a.closest('.rail');
  const posI = rail ? [...rail.children].indexOf(a) : -1;
  const rails = $$('.rail', main).map(r => r.scrollLeft), scroll = main.scrollTop;
  main.style.scrollBehavior = 'auto';
  main.replaceChildren(...ctx.el.childNodes);
  ctx.el = main; curCtx = ctx; if (old) old.alive = false;
  $$('.rail', main).forEach((r, i) => { r.style.scrollBehavior = 'auto'; r.scrollLeft = rails[i] || 0; r.style.scrollBehavior = ''; });
  main.scrollTop = scroll;
  if (inMain) {
    let el = key && $(`#main [data-k="${CSS.escape(key)}"]`);
    if (!el && secI >= 0) { const r = $$('.sec', main)[secI]; const kids = r ? [...(r.querySelector('.rail, .grid') || r).children] : []; el = kids[Math.min(Math.max(posI, 0), kids.length - 1)]; }
    if (el) {
      setFocus(el, true);
      // only if the card is now out of view (its live moved in the row)
      const r = el.getBoundingClientRect(), rr = (el.closest('.rail') || main).getBoundingClientRect();
      if (r.right < rr.left || r.left > rr.right || r.bottom < 0 || r.top > innerHeight) reveal(el);
    } else focusFirst($('#main'));
  }
  requestAnimationFrame(() => { main.style.scrollBehavior = ''; });
  if (manual) toast('Accueil actualisé');
}
// Every 5 min on the home page (not while a video, a menu or a key press is going on).
setInterval(() => {
  const top = stack[stack.length - 1];
  if (document.hidden || !top || top.name !== 'home' || layers.length || playerLayer || multiLayer) return;
  if (Date.now() - homeAt < 5 * 60000 || Date.now() - lastKeyAt < 3000) return;
  refreshHome(false);
}, 20000);

// After an async section loads: put focus somewhere sensible if it was lost.
function settle() { const a = document.activeElement; if (!layers.length && (!a || a === document.body || !document.contains(a))) focusFirst(); }

// ======================================================================= cards
function srcFromStream(s, u) {
  u = u || s._u || {};
  return { channel: s.user_login, id: s.user_id, name: s.user_name, avatar: u.profile_image_url || u.avatar || '', title: s.title, game: s.game_name, viewers: s.viewer_count, started: s.started_at, thumb: sThumb(s, 640, 360) };
}
function streamCard(s, k) {
  const u = s._u || {};
  const el = h(`<div class="card f" tabindex="-1" data-k="${esc(k || 's:' + s.user_id)}">
    <div class="thumb"><img loading="lazy" decoding="async" src="${esc(sThumb(s))}" onerror="this.src='${BLANK}'"><span class="badge live">LIVE</span>
      <span class="chip bl">${fmtN(s.viewer_count)} spectateurs</span>${isPinned(s.user_id) ? `<span class="pin-dot">${ic('pinf')}</span>` : ''}</div>
    <div class="meta">${u.profile_image_url ? `<img class="av" loading="lazy" decoding="async" src="${esc(u.profile_image_url)}">` : ''}<div class="t"><b>${esc(s.user_name)}</b><span>${esc(s.title)}</span><span>${esc(s.game_name || '')}</span></div></div></div>`);
  el.onclick = () => play(srcFromStream(s));
  el._ctx = { kind: 'stream', stream: s, login: s.user_login, id: s.user_id, name: s.user_name, avatar: u.profile_image_url };
  el.addEventListener('focus', () => setBg(sThumb(s, 320, 180)));
  return el;
}
// ---------- Where each VOD was left (per profile, like Twitch's red bar on replays)
const vsecs = d => { const m = /(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/.exec(d || ''); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; };
let vpos = null;
function getPos(id) { if (!vpos) vpos = store.get('vpos', {}); return vpos[id] || null; }
function savePos(id, t, d) {
  if (!id || !(t > 0)) return; getPos(id);
  vpos[id] = [Math.floor(t), Math.floor(d || (vpos[id] && vpos[id][1]) || 0), Date.now()];
  const ks = Object.keys(vpos); if (ks.length > 400) ks.sort((a, b) => vpos[a][2] - vpos[b][2]).slice(0, ks.length - 400).forEach(k => delete vpos[k]);
  store.set('vpos', vpos);
}
// Watch progress given by a plugin (StreamPlus.progress): {id: [percent, when it changed]}
let tpos = null;
function getT(id) { if (!tpos) tpos = store.get('tpos', {}); return tpos[id] || null; }
/** Where a VOD was left: the most recent of the app's own record and twitch.tv's. -> {sec, pct} or null */
function progress(id, D) {
  const a = getPos(id), t = getT(id);
  D = D || (a && a[1]) || 0;
  if (t && (!a || t[1] > a[2])) return { pct: t[0], sec: D ? t[0] / 100 * D : 0 };
  if (a) return { sec: a[0], pct: D ? a[0] / D * 100 : 0 };
  return null;
}
/** Saved position to restart from, unless the VOD was (almost) finished. */
function resumeAt(id, d) { const r = progress(id, d); if (!r || !r.sec) return 0; return (d && r.sec > d - 60) || r.pct > 98 ? 0 : Math.floor(r.sec); }
const progBar = pct => `<div class="vprog"><i style="width:${Math.min(100, Math.max(2, pct)).toFixed(1)}%"></i></div>`;
/** Twitch's bars arrive a few cards at a time; they are drawn on idle frames, a few per frame. */
const tposQueue = [];
function drawTpos() {
  const idle = window.requestIdleCallback || (f => setTimeout(f, 16));
  idle(() => {
    let n = 0;
    while (tposQueue.length && n++ < 6) {
      const id = tposQueue.shift();
      $$(`.card[data-k="v:${id}"] .thumb`).forEach(th => {
        const r = progress(id, +th.dataset.d || 0); if (!r || !r.pct) return;
        const ex = $('.vprog i', th);
        if (ex) ex.style.width = Math.min(100, Math.max(2, r.pct)).toFixed(1) + '%'; else th.insertAdjacentHTML('beforeend', progBar(r.pct));
      });
    }
    if (tposQueue.length) drawTpos();
  });
}
// ---------- Plugins (plugins/ folder at build time): they listen to the app's events.
//   StreamPlus.on('ready', ({login}) => …)            once the app has started (login: first pinned channel or the account)
//   StreamPlus.on('channel-videos', (login, tab) => …)  a channel's VODs are shown (tab: archive | highlight)
//   StreamPlus.on('channel-open', login => …)          a channel's page or options menu opens
//   StreamPlus.progress(json)                          {videoId: percent watched} → drawn on the VOD cards
//   StreamPlus.followHandler = async (login, 'follow' | 'unfollow') => …   does the follow (else: QR code to Twitch)
const StreamPlus = window.StreamPlus = {
  _h: {}, _sticky: {},
  on(ev, fn) { (this._h[ev] = this._h[ev] || []).push(fn); if (ev in this._sticky) this._call(fn, this._sticky[ev]); },
  emit(ev, ...a) { (this._h[ev] || []).forEach(f => this._call(f, a)); },
  sticky(ev, ...a) { this._sticky[ev] = a; this.emit(ev, ...a); },
  _call(f, a) { try { f(...a); } catch (e) { console.log('plugin: ' + e); } },
  progress(json) {
    let o; try { o = typeof json === 'string' ? JSON.parse(json) : json; } catch (e) { return; }
    getT('');
    const now = Date.now(); let changed = false;
    for (const id in o) {
      const v = +o[id]; if (!(v >= 0)) continue;
      if (tpos[id] && tpos[id][0] === v) continue;
      tpos[id] = [v, now]; changed = true; tposQueue.push(id);
    }
    if (!changed) return;
    const ks = Object.keys(tpos);
    if (ks.length > 600) { const keep = {}; ks.sort((a, b) => tpos[b][1] - tpos[a][1]).slice(0, 600).forEach(k => keep[k] = tpos[k]); tpos = keep; }
    store.set('tpos', tpos);
    drawTpos();
  },
};
function askHistory(login, tab) { if (login) StreamPlus.emit('channel-videos', login, tab); }
// Every VOD player on screen (single, multistream) records its position every 5 s.
const vodPlayers = new Set();
setInterval(() => vodPlayers.forEach(x => {
  if (!x.el.isConnected) { vodPlayers.delete(x); return; }
  try { const t = x.p.getCurrentTime(); if (t > 5) savePos(x.id, t, x.p.getDuration()); } catch (e) { }
}), 5000);
function trackPip(st) { if (st && st.video && st.time > 5) savePos(String(st.video), st.time); }

function videoCard(v, chan) {
  const t = vThumb(v);
  const D = vsecs(v.duration), pr = progress(v.id, D), pct = pr ? pr.pct : 0;
  const el = h(`<div class="card f" tabindex="-1" data-k="v:${v.id}">
    <div class="thumb" data-d="${D}"><img loading="lazy" decoding="async" src="${esc(t || BLANK)}" onerror="this.src='${BLANK}'"><span class="chip br">${dur(v.duration)}</span>
      <span class="chip bl">${fmtN(v.view_count)} vues</span><span class="chip tr">${ago(v.created_at)}</span>${pct ? progBar(pct) : ''}</div>
    <div class="meta"><div class="t"><b>${esc(v.title || 'Sans titre')}</b><span>${new Date(v.created_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</span></div></div></div>`);
  el.onclick = () => play({ video: v.id, channel: v.user_login, id: v.user_id, name: v.user_name, avatar: chan && chan.profile_image_url, title: v.title, date: v.created_at, length: v.duration });
  el._ctx = { kind: 'video', video: v, login: v.user_login, id: v.user_id, name: v.user_name, avatar: chan && chan.profile_image_url };
  if (t) el.addEventListener('focus', () => setBg(vThumb(v, 320, 180)));
  return el;
}
function clipCard(c) {
  const el = h(`<div class="card f" tabindex="-1" data-k="c:${c.id}">
    <div class="thumb"><img loading="lazy" decoding="async" src="${esc(c.thumbnail_url)}" onerror="this.src='${BLANK}'"><span class="chip br">${Math.round(c.duration)} s</span>
      <span class="chip bl">${fmtN(c.view_count)} vues</span><span class="chip tr">${ago(c.created_at)}</span></div>
    <div class="meta"><div class="t"><b>${esc(c.title)}</b><span>Clippé par ${esc(c.creator_name)}</span></div></div></div>`);
  el.onclick = () => playClip(c);
  return el;
}
function catCard(g) {
  const el = h(`<div class="cat f" tabindex="-1" data-k="g:${g.id}"><div class="box"><img loading="lazy" decoding="async" src="${esc(gBox(g))}" onerror="this.src='${BLANK}'"></div><b>${esc(g.name)}</b></div>`);
  el.onclick = () => go('category', { id: g.id, name: g.name, box: g.box_art_url });
  return el;
}
function chanCard(c) { // c: {id, login, name, avatar, live, sub}
  const el = h(`<div class="chan f ${c.live ? 'live' : ''}" tabindex="-1" data-k="u:${c.id}"><img loading="lazy" decoding="async" src="${esc(c.avatar || BLANK)}"><b>${esc(c.name)}</b><span>${esc(c.sub || (c.live ? 'En direct' : 'Hors ligne'))}</span></div>`);
  el.onclick = () => go('channel', { login: c.login });
  el._ctx = { kind: 'channel', login: c.login, id: c.id, name: c.name, avatar: c.avatar };
  return el;
}
function section(title, sub, items, build, cls = 'rail') {
  const el = h(`<section class="sec"><div class="sec-h"><h2>${esc(title)}</h2>${sub ? `<small>${esc(sub)}</small>` : ''}</div><div class="${cls}"></div></section>`);
  const rail = el.lastElementChild; items.forEach(i => rail.appendChild(build(i)));
  return el;
}
/** Grid that keeps loading pages as focus approaches the end: no limit. */
function pager(ctx, grid, fetchPage, build, cols = 4) {
  let cursor = null, loading = false, done = false;
  const more = async () => {
    if (loading || done) return; loading = true;
    const tail = h('<div class="loading" style="grid-column:1/-1">Chargement…</div>'); grid.appendChild(tail);
    try {
      const r = await fetchPage(cursor);
      if (!ctx.alive) return;
      tail.remove();
      r.items.forEach(i => grid.appendChild(build(i)));
      cursor = r.cursor; done = !cursor || !r.items.length;
      if (!grid.children.length) grid.appendChild(h('<div class="empty" style="grid-column:1/-1">Rien à afficher ici.</div>'));
      settle();
    } catch (e) { tail.textContent = 'Erreur : ' + e.message; }
    loading = false;
  };
  grid.addEventListener('focusin', e => {
    const kids = [...grid.children], i = kids.indexOf(e.target);
    if (i >= kids.length - cols * 2) more();
  });
  return more();
}
/** Options of a card (long press OK, or the Menu key): everything about that stream/channel. */
function cardMenu(c) {
  const s = c.stream, v = c.video;
  const items = [];
  const src = s ? srcFromStream(s, { avatar: c.avatar }) : null;
  if (s) {
    items.push({ label: 'Regarder', icon: 'play', run: () => play(src) });
    items.push({ label: 'PiP', icon: 'pip', run: () => toPip(src, cfg.vol, false, true) });
    items.push({ label: 'Multistream', icon: 'multi', run: () => multiFrom(src) });
  }
  if (v) {
    const vs = { video: v.id, channel: c.login, id: c.id, name: c.name, title: v.title, avatar: c.avatar };
    items.push({ label: 'Regarder', icon: 'play', run: () => play(vs) });
    items.push({ label: 'Multistream', icon: 'multi', run: () => addToMulti(vs, true) });
    items.push({ label: 'PiP', icon: 'pip', run: () => toPip(vs, cfg.vol, false, true) });
  }
  items.push({ label: 'Voir la chaîne', icon: 'user', run: () => go('channel', { login: c.login }) });
  items.push({ label: 'Rediffusions', icon: 'play', run: () => go('channel', { login: c.login, tab: 'archive' }) });
  items.push({ label: 'Clips', icon: 'expand', run: () => go('channel', { login: c.login, tab: 'clips' }) });
  if (s && s.game_id) items.push({ label: s.game_name, icon: 'browse', run: () => go('category', { id: s.game_id, name: s.game_name }) });
  items.push({ label: isPinned(c.id) ? 'Désépingler' : 'Épingler', icon: isPinned(c.id) ? 'pinf' : 'pin', run: () => togglePin({ id: c.id, login: c.login, display_name: c.name, profile_image_url: c.avatar }) });
  const fol = { label: 'Suivre', icon: 'heart', run: () => follow(c, fol.following) };
  items.push(fol);
  if (c.login) setTimeout(() => StreamPlus.emit('channel-open', c.login), 400);  // after the menu has drawn
  const l = optionsSheet(c, items);
  // Follow state (Twitch's API can read it, not change it).
  if (auth && c.id) helix('channels/followed', { user_id: auth.userId, broadcaster_id: c.id }).then(r => {
    const b = l.el.querySelector('[data-follow]'); if (!b) return;
    const on = r.data && r.data.length;
    fol.following = !!on;
    b.querySelector('span').textContent = on ? 'Suivi ✓' : 'Suivre';
    b.classList.toggle('on', !!on);
  }).catch(() => { });
}
/** Follow / unfollow. Twitch's API doesn't let apps do it: a plugin may (StreamPlus.followHandler),
 * otherwise a QR code opens the channel on Twitch, to follow it from a phone. */
function follow(c, following, done) {
  if (!HAS_NATIVE) return;
  if (!StreamPlus.followHandler) return followQr(c, following, done);
  if (!Native.playerSignedIn()) {
    return choose('Connexion twitch.tv nécessaire', [{ label: 'Connecter le lecteur', icon: 'user', run: () => Native.playerSignIn() }, { label: 'Annuler', run: () => { } }],
      'Pour suivre une chaîne, connecte-toi une fois sur twitch.tv (Paramètres → Connecter le lecteur).');
  }
  const go = async unf => {
    toast((unf ? 'Arrêt du suivi de ' : 'Suivi de ') + c.name + '…', 30000);
    try { await StreamPlus.followHandler(c.login, unf ? 'unfollow' : 'follow'); } catch (e) { }
    // The result shown is Twitch's own answer, not the button's.
    let now = null;
    for (let i = 0; i < 4 && auth && c.id; i++) {
      try { now = !!(await helix('channels/followed', { user_id: auth.userId, broadcaster_id: c.id })).data.length; } catch (e) { }
      if (now === !unf) break;
      await sleep(700);
    }
    toast(now === null ? 'Twitch n\'a pas répondu, réessaie' : now === !unf ? (unf ? 'Tu ne suis plus ' + c.name : 'Tu suis ' + c.name + ' ✓') : 'Ça n\'a pas marché, réessaie');
    if (done && now !== null) done(now);
  };
  if (following) return choose('Ne plus suivre ' + c.name + ' ?', [{ label: 'Ne plus suivre', icon: 'x', run: () => go(true) }, { label: 'Annuler', run: () => { } }]);
  go(false);
}
/** Without the follow plugin: the channel's page on Twitch as a QR code; the state is read again on close. */
function followQr(c, following, done) {
  const url = 'https://www.twitch.tv/' + encodeURIComponent(c.login);
  const l = modal(`<h2>${following ? 'Ne plus suivre' : 'Suivre'} ${esc(c.name)}</h2>
    <p class="sub">Scanne ce QR code avec ton téléphone : la chaîne s'ouvre sur Twitch, où tu peux ${following ? 'arrêter de la suivre' : 'la suivre'}.</p>
    <div style="display:flex;gap:36px;align-items:center;margin-top:24px"><img class="qr" src="${Native.qr(url)}" style="width:260px;height:260px;border-radius:18px;background:#fff;padding:14px">
    <div><p style="font-size:24px;margin:0 0 22px">twitch.tv/${esc(c.login)}</p><div class="btns"><div class="btn pri f" tabindex="-1" data-k="ok">${ic('heart')}<span>C'est fait</span></div></div></div></div>`, { cls: 'sm' });
  const recheck = async () => {
    if (!auth || !c.id || !done) return;
    try { done(!!(await helix('channels/followed', { user_id: auth.userId, broadcaster_id: c.id })).data.length); } catch (e) { }
  };
  $('[data-k=ok]', l.el).onclick = () => { l.close(); recheck(); };
  const close = l.close; l.close = () => { close(); recheck(); };
  setFocus($('[data-k=ok]', l.el));
}
function optionsSheet(c, items) {
  const s = c.stream, v = c.video;
  const sub = s ? `<span class="tag live">LIVE</span> ${fmtN(s.viewer_count)} spectateurs · ${esc(s.game_name || '')}` : v ? `Rediffusion · ${ago(v.created_at)} · ${dur(v.duration)}` : (c.stream === undefined ? 'Chaîne' : 'Hors ligne');
  const l = modal(`<div class="opt-h"><img src="${esc(c.avatar || BLANK)}"><div><h2>${esc(c.name || c.login)}</h2><p class="sub">${sub}</p>${s || v ? `<p class="opt-t">${esc((s || v).title || '')}</p>` : ''}</div></div><div class="opt-grid"></div>`, { cls: 'opt' });
  const g = $('.opt-grid', l.el);
  items.forEach(it => {
    const b = h(`<div class="btn glass f" tabindex="-1" ${it.label === 'Suivre' ? 'data-follow' : ''}>${ic(it.icon)}<span>${esc(it.label)}</span></div>`);
    b.onclick = () => { l.close(); it.run(); };
    g.appendChild(b);
  });
  setFocus(g.firstElementChild);
  if (!c.avatar && c.login) fillAvatar({ channel: c.login }, [$('.opt-h img', l.el)]);
  return l;
}

// ======================================================================= views
const VIEWS = {};

VIEWS.setup = ctx => {
  const devUrl = 'https://dev.twitch.tv/console/apps/create';
  const qr = HAS_NATIVE ? Native.qr(devUrl) : '';
  const needClient = !cfg.clientId;
  ctx.el.innerHTML = `<h1 class="pt">Bienvenue sur ${esc(APP)}</h1>
  <div class="setup glass">
    ${needClient && qr ? `<img class="qr" src="${qr}">` : ''}
    <div style="flex:1">
      ${needClient ? `<h2>1. Crée ton accès à l'API Twitch (2 min, une seule fois)</h2>
      <ol><li>Scanne le QR code ou ouvre <code>dev.twitch.tv/console/apps/create</code></li>
      <li>Nom : <code>StreamPlus TV</code> (sans le mot « Twitch », refusé) · URL de redirection : <code>http://localhost</code></li>
      <li>Catégorie : <code>Application Integration</code> · Type de client : <code>Public</code></li>
      <li>Copie le <b>Client ID</b> et saisis-le ci-dessous (ou dans <code>config.json</code> du projet)</li></ol>
      <div class="btns"><div class="btn pri f" tabindex="-1" data-k="cid">Saisir le Client ID</div></div>`
      : `<h2>2. Connecte ton compte Twitch</h2>
      <p class="sub" style="font-size:23px;color:var(--dim);margin:14px 0 26px">Pour voir les lives, tes chaînes suivies et les rediffusions. Tu valides depuis ton téléphone.</p>
      <div class="btns"><div class="btn pri f" tabindex="-1" data-k="login">Se connecter avec Twitch</div><div class="btn glass f" tabindex="-1" data-k="cid">Modifier le Client ID</div></div>`}
    </div>
  </div>`;
  const cid = $('[data-k=cid]', ctx.el);
  if (cid) cid.onclick = () => inputModal('Client ID Twitch', 'Colle ou tape le Client ID de ton application dev.twitch.tv', cfg.clientId, v => { cfg.clientId = v; saveCfg(); render(); });
  const lg = $('[data-k=login]', ctx.el); if (lg) lg.onclick = login;
};

VIEWS.home = async ctx => {
  if (!ready()) return VIEWS.setup(ctx);
  const el = ctx.el;
  el.innerHTML = `<div class="home-top"><h1>Accueil</h1><small class="upd"></small>
    <div class="btn glass f" tabindex="-1" data-k="h:refresh" data-late>${ic('refresh')}<span>Actualiser la page</span></div></div>
    <div id="hero"></div><div id="rows"><div class="loading">Chargement des lives…</div></div>`;
  $('[data-k="h:refresh"]', el).onclick = () => refreshHome(true);
  const [fol, top, games] = await Promise.all([
    followedLive().catch(() => []),
    topStreams({ first: 30 }).then(r => r.data),
    helix('games/top', { first: 30 }).then(r => r.data).catch(() => []),
  ]);
  await refreshPins();
  if (!ctx.alive) return;
  const pinned = pins.map(p => pinLive[p.id]).filter(Boolean).sort((a, b) => b.viewer_count - a.viewer_count);
  const all = [...pinned, ...fol, ...top];
  await withAvatars(all.filter((s, i) => all.findIndex(x => x.user_id === s.user_id) === i)).catch(() => { });
  all.forEach(s => { s._u = userCache['#' + s.user_id]; });
  if (!ctx.alive) return;
  const heroS = pinned[0] || fol[0] || top[0];
  if (heroS) {
    const u = heroS._u || {};
    const hero = h(`<div class="hero"><img src="${esc(sThumb(heroS, 1280, 720))}"><div class="hi glass">
      <div class="who"><img src="${esc(u.profile_image_url || BLANK)}"><div><b>${esc(heroS.user_name)}</b><small><span class="tag live">LIVE</span> &nbsp;${fmtN(heroS.viewer_count)} spectateurs · ${esc(heroS.game_name)} · ${uptime(heroS.started_at)}</small></div></div>
      <p>${esc(heroS.title)}</p>
      <div class="btns"><div class="btn pri f" tabindex="-1" data-k="h:play">${ic('play')}Regarder</div>
      <div class="btn glass f" tabindex="-1" data-k="h:multi">${ic('multi')}Multistream</div>
      <div class="btn glass f" tabindex="-1" data-k="h:pip">${ic('pip')}PiP</div>
      <div class="btn glass f" tabindex="-1" data-k="h:chan">${ic('user')}Chaîne</div></div></div></div>`);
    $('[data-k="h:play"]', hero).onclick = () => play(srcFromStream(heroS));
    $('[data-k="h:multi"]', hero).onclick = () => multiFrom(srcFromStream(heroS));
    $('[data-k="h:pip"]', hero).onclick = () => toPip(srcFromStream(heroS), cfg.vol, false, true);
    $('[data-k="h:chan"]', hero).onclick = () => go('channel', { login: heroS.user_login });
    $('#hero', el).appendChild(hero);
    setBg(sThumb(heroS, 320, 180));
  }
  homeAt = Date.now();
  $('.upd', el).textContent = 'Mis à jour à ' + new Date(homeAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + ' · automatiquement toutes les 5 min';
  const rows = $('#rows', el); rows.innerHTML = '';
  if (pinned.length) rows.appendChild(section('Tes épinglés en direct', pinned.length + ' en live', pinned, s => streamCard(s, 'pin:' + s.user_id)));
  if (fol.length) rows.appendChild(section('Chaînes suivies en direct', fol.length + ' en live', fol, s => streamCard(s, 'fol:' + s.user_id)));
  rows.appendChild(section('Lives populaires', langName(cfg.lang), top, s => streamCard(s, 'top:' + s.user_id)));
  if (games.length) rows.appendChild(section('Catégories populaires', '', games, catCard));
  const off = pins.filter(p => !pinLive[p.id]);
  if (off.length) rows.appendChild(section('Épinglés hors ligne', 'leurs rediffusions', off, p => chanCard({ ...p, live: false, sub: 'Voir les rediffusions' })));
  settle();
};

/** Parcourir: followed channels (live, then offline), top France, top world, categories. One tab each, no limit. */
const BROWSE_TABS = [['live', 'Suivies en live'], ['off', 'Suivies hors ligne'], ['fr', 'Top France'], ['world', 'Top monde'], ['cats', 'Catégories']];
VIEWS.browse = async ctx => {
  const p = ctx.params;
  const tab = p.tab || cfg.browseTab || (auth ? 'live' : 'fr');
  if (cfg.browseTab !== tab) { cfg.browseTab = tab; saveCfg(); }
  ctx.el.innerHTML = `<h1 class="pt">Parcourir</h1>
    <div class="tabs glass" style="margin:0 0 6px 8px">${BROWSE_TABS.map(([k, l]) => `<div class="tab f ${k === tab ? 'cur' : ''}" tabindex="-1" data-k="b:${k}" data-t="${k}">${l}</div>`).join('')}</div>
    <div class="grid"></div>`;
  $$('.tab', ctx.el).forEach(t => t.onclick = () => { if (t.dataset.t === tab) return; stack[stack.length - 1].params = { ...p, tab: t.dataset.t }; stack[stack.length - 1].focusKey = 'b:' + t.dataset.t; render(true); });
  const grid = $('.grid', ctx.el);
  const streams = async r => { await withAvatars(r.data).catch(() => { }); return { items: r.data, cursor: r.pagination && r.pagination.cursor }; };
  if (tab === 'cats') {
    grid.classList.add('cats');
    await pager(ctx, grid, async after => { const r = await helix('games/top', { first: 70, after }); return { items: r.data, cursor: r.pagination && r.pagination.cursor }; }, catCard, 7);
  } else if (tab === 'fr' || tab === 'world') {
    await pager(ctx, grid, async after => streams(await helix('streams', { first: 40, after, language: tab === 'fr' ? 'fr' : null })), s => streamCard(s));
  } else if (!auth) {
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1">Connecte ton compte Twitch (Paramètres) pour voir tes chaînes suivies.</div>';
  } else if (tab === 'live') {
    await pager(ctx, grid, async after => streams(await helix('streams/followed', { user_id: auth.userId, first: 100, after })), s => streamCard(s));
  } else {
    // Followed channels that are not live (most recently followed first), with their avatars.
    grid.style.gridTemplateColumns = 'repeat(7,minmax(0,1fr))';
    let live = null;
    await pager(ctx, grid, async after => {
      if (!live) {
        live = new Set(); let c = null;
        do { const r = await helix('streams/followed', { user_id: auth.userId, first: 100, after: c }); r.data.forEach(x => live.add(x.user_id)); c = r.data.length === 100 && r.pagination && r.pagination.cursor; } while (c);
      }
      const r = await helix('channels/followed', { user_id: auth.userId, first: 100, after });
      const off = r.data.filter(f => !live.has(f.broadcaster_id));
      const u = await users({ ids: off.map(f => f.broadcaster_id) }).catch(() => null);
      return {
        items: off.map(f => { const x = u && u.byId(f.broadcaster_id); return { id: f.broadcaster_id, login: f.broadcaster_login, name: f.broadcaster_name, avatar: x ? x.profile_image_url : '', live: false, sub: 'Hors ligne' }; }),
        cursor: r.pagination && r.pagination.cursor,
      };
    }, chanCard, 7);
  }
};

VIEWS.category = async ctx => {
  const p = ctx.params;
  let lang = p.lang != null ? p.lang : cfg.lang;
  ctx.el.innerHTML = `<div style="display:flex;gap:40px;align-items:flex-end;margin:6px 0 10px"><img src="${esc(gBox({ box_art_url: p.box || '' }, 216, 288))}" style="width:180px;border-radius:20px;box-shadow:0 20px 50px rgba(0,0,0,.5)">
    <div><h1 class="pt" style="margin:0 0 20px">${esc(p.name)}</h1><div class="btns"><div class="btn glass f" tabindex="-1" data-k="lang">${ic('browse')}Langue : ${esc(langName(lang))}</div></div></div></div><div class="grid"></div>`;
  if (p.box) setBg(gBox({ box_art_url: p.box }, 144, 192));
  $('[data-k=lang]', ctx.el).onclick = () => {
    const i = LANGS.findIndex(l => l[0] === lang); stack[stack.length - 1].params = { ...p, lang: LANGS[(i + 1) % LANGS.length][0] }; render();
  };
  await pager(ctx, $('.grid', ctx.el), async after => {
    const r = await helix('streams', { game_id: p.id, first: 40, after, language: lang || null });
    await withAvatars(r.data);
    return { items: r.data, cursor: r.pagination && r.pagination.cursor };
  }, s => streamCard(s));
};

VIEWS.search = async ctx => {
  const p = ctx.params;
  ctx.el.innerHTML = `<h1 class="pt">Rechercher</h1>
    <div class="search glass field f" tabindex="-1" data-k="q">${ic('search')}<input type="search" placeholder="Streamer, jeu, catégorie…" autocomplete="off" spellcheck="false"></div>
    <div id="res"><p class="empty">Appuie sur OK pour taper ou dicter avec la télécommande.</p></div>`;
  const inp = $('input', ctx.el), res = $('#res', ctx.el);
  inp.value = p.q || '';
  let t = null, n = 0;
  const run = async () => {
    const q = inp.value.trim(); stack[stack.length - 1].params = { q };
    if (!q) { res.innerHTML = '<p class="empty">Appuie sur OK pour taper ou dicter avec la télécommande.</p>'; return; }
    const id = ++n; res.innerHTML = '<p class="loading">Recherche…</p>';
    try {
      const [ch, cats] = await Promise.all([helix('search/channels', { query: q, first: 40 }), helix('search/categories', { query: q, first: 30 })]);
      if (id !== n || !ctx.alive) return;
      res.innerHTML = '';
      const chans = ch.data.sort((a, b) => b.is_live - a.is_live);
      const live = chans.filter(c => c.is_live).map(c => c.id);
      let streams = [];
      if (live.length) streams = (await helix('streams', { user_id: live.slice(0, 100), first: 100 })).data;
      await withAvatars(streams).catch(() => { });
      if (id !== n || !ctx.alive) return;
      if (streams.length) res.appendChild(section('En direct', '', streams, s => streamCard(s)));
      if (chans.length) res.appendChild(section('Chaînes', chans.length + ' résultats', chans, c => chanCard({ id: c.id, login: c.broadcaster_login, name: c.display_name, avatar: c.thumbnail_url, live: c.is_live, sub: c.is_live ? (c.game_name || 'En direct') : 'Hors ligne' })));
      if (cats.data.length) res.appendChild(section('Catégories', '', cats.data, catCard));
      if (!res.children.length) res.innerHTML = '<p class="empty">Aucun résultat.</p>';
    } catch (e) { if (id === n) res.innerHTML = `<p class="empty">${esc(e.message)}</p>`; }
  };
  inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 500); });
  inp._submit = () => { clearTimeout(t); run(); inp.blur(); setTimeout(() => { const f = $('#res .f'); if (f) setFocus(f); }, 900); };
  inp.addEventListener('change', inp._submit);
  if (p.q) await run();
  setFocus($('.search', ctx.el));
};

VIEWS.channel = async ctx => {
  const p = ctx.params;
  const u = (await users({ logins: [p.login] })).byLogin(p.login);
  if (!u) throw new Error('Chaîne introuvable : ' + p.login);
  const [chan, live, fol] = await Promise.all([
    helix('channels', { broadcaster_id: u.id }).then(r => r.data[0] || {}).catch(() => ({})),
    helix('streams', { user_id: u.id }).then(r => r.data[0]).catch(() => null),
    helix('channels/followers', { broadcaster_id: u.id, first: 1 }).then(r => r.total).catch(() => null),
  ]);
  if (!ctx.alive) return;
  const tab = p.tab || 'archive';
  ctx.el.innerHTML = `<div class="ch-head glass"><div class="bgx" style="background-image:url('${esc(u.offline_image_url || (live ? sThumb(live, 1280, 720) : u.profile_image_url))}')"></div>
    <img class="ch-av ${live ? 'live' : ''}" src="${esc(u.profile_image_url)}">
    <div class="ch-info"><h1>${esc(u.display_name)} ${u.broadcaster_type === 'partner' ? '<svg viewBox="0 0 24 24" style="width:44px;height:44px;color:var(--accent2)"><path fill="currentColor" d="m12 2 2.4 2.1 3.2-.3.8 3.1 2.8 1.6-1.2 3 1.2 3-2.8 1.6-.8 3.1-3.2-.3L12 22l-2.4-2.1-3.2.3-.8-3.1-2.8-1.6 1.2-3-1.2-3L5.6 7l.8-3.1 3.2.3z"/><path d="m8 12 3 3 5-6" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>' : ''}</h1>
      <div class="stats">${fol != null ? fmtN(fol) + ' followers · ' : ''}${esc(chan.game_name ? 'Dernière catégorie : ' + chan.game_name : '')}</div>
      <p>${esc(u.description || '')}</p>
      <div class="btns">${live ? `<div class="btn pri f" tabindex="-1" data-k="c:play">${ic('play')}Regarder le live</div>` : ''}
        <div class="btn glass f" tabindex="-1" data-k="c:follow">${ic('heart')}<span>Suivre</span></div>
        <div class="btn glass f" tabindex="-1" data-k="c:pin">${ic(isPinned(u.id) ? 'pinf' : 'pin')}<span>${isPinned(u.id) ? 'Épinglée' : 'Épingler'}</span></div>
        ${live ? `<div class="btn glass f" tabindex="-1" data-k="c:multi">${ic('multi')}Multistream</div><div class="btn glass f" tabindex="-1" data-k="c:pip">${ic('pip')}PiP</div>` : ''}</div></div></div>
    ${live ? `<div class="livebox glass"><div class="thumb card f" tabindex="-1" data-k="c:live" style="width:640px"><img src="${esc(sThumb(live))}"><span class="badge live">LIVE</span><span class="chip bl">${fmtN(live.viewer_count)} spectateurs</span><span class="chip br">${uptime(live.started_at)}</span></div>
      <div><span class="tag live">EN DIRECT</span><h3>${esc(live.title)}</h3><div class="g">${esc(live.game_name)}</div></div></div>` : ''}
    <div class="tabs glass">${[['archive', 'Rediffusions'], ['highlight', 'Temps forts'], ['clips', 'Clips']].map(([k, l]) => `<div class="tab f ${k === tab ? 'cur' : ''}" tabindex="-1" data-k="t:${k}" data-t="${k}">${l}</div>`).join('')}</div>
    <div class="grid"></div>`;
  setBg(live ? sThumb(live, 320, 180) : u.profile_image_url);
  const src = live ? { ...srcFromStream(live, u) } : null;
  const on = (k, f) => { const b = $(`[data-k="${k}"]`, ctx.el); if (b) b.onclick = f; };
  on('c:play', () => play(src)); on('c:live', () => play(src));
  on('c:multi', () => multiFrom(src)); on('c:pip', () => toPip(src, cfg.vol, false, true));
  // Follow / unfollow (state read from Twitch; the hidden player is switched to this channel ahead).
  const fb = $('[data-k="c:follow"]', ctx.el); let following = null;
  // Followed: shows "Suivi", and "Ne plus suivre" in red once selected.
  const showF = on => { following = on; fb.innerHTML = ic(on ? 'heartf' : 'heart') + (on ? '<span class="fo-a">Suivi</span><span class="fo-b">Ne plus suivre</span>' : '<span>Suivre</span>'); fb.classList.toggle('on', on); fb.classList.toggle('fol', on); };
  if (auth) helix('channels/followed', { user_id: auth.userId, broadcaster_id: u.id }).then(r => showF(!!(r.data && r.data.length))).catch(() => { });
  setTimeout(() => { if (ctx.alive) StreamPlus.emit('channel-open', u.login); }, 600);
  fb.onclick = () => follow({ login: u.login, id: u.id, name: u.display_name }, !!following, now => { if (fb.isConnected) showF(now); });
  on('c:pin', () => { const now = togglePin(u); const b = $('[data-k="c:pin"]', ctx.el); b.innerHTML = ic(now ? 'pinf' : 'pin') + `<span>${now ? 'Épinglée' : 'Épingler'}</span>`; });
  $$('.tab', ctx.el).forEach(t => t.onclick = () => { if (t.dataset.t === tab) return; stack[stack.length - 1].params = { ...p, tab: t.dataset.t }; stack[stack.length - 1].focusKey = 't:' + t.dataset.t; render(true); });
  const grid = $('.grid', ctx.el);
  if (tab === 'clips') {
    await pager(ctx, grid, async after => { const r = await helix('clips', { broadcaster_id: u.id, first: 40, after }); return { items: r.data, cursor: r.pagination && r.pagination.cursor }; }, clipCard);
  } else {
    askHistory(u.login, tab);
    await pager(ctx, grid, async after => { const r = await helix('videos', { user_id: u.id, type: tab, first: 40, after }); return { items: r.data, cursor: r.pagination && r.pagination.cursor }; }, v => videoCard(v, u));
  }
};

VIEWS.pins = async ctx => {
  ctx.el.innerHTML = `<h1 class="pt">Chaînes épinglées</h1><p class="empty" style="padding:0 8px 10px">OK : ouvrir la chaîne · Menu : options. Les épinglés apparaissent aussi dans la barre latérale.</p><div class="grid" style="grid-template-columns:repeat(7,minmax(0,1fr))"></div>`;
  if (!pins.length) { $('.grid', ctx.el).outerHTML = '<p class="empty">Aucune chaîne épinglée. Ouvre une chaîne et choisis « Épingler ».</p>'; return; }
  await refreshPins();
  if (!ctx.alive) return;
  const g = $('.grid', ctx.el);
  pinsSorted().forEach(p => { const s = pinLive[p.id]; const c = chanCard({ ...p, live: !!s, sub: s ? fmtN(s.viewer_count) + ' · ' + (s.game_name || '') : 'Hors ligne' }); c._ctx.stream = s; c.onclick = () => s ? play(srcFromStream(s, p)) : go('channel', { login: p.login }); g.appendChild(c); });
};

VIEWS.settings = async ctx => {
  const ov = HAS_NATIVE ? Native.canOverlay() : false;
  const pk = HAS_NATIVE && Native.pipKey ? JSON.parse(Native.pipKey()) : { key: 0 };
  const rows = [
    ['acc', auth ? `Connecté : ${auth.name}` : 'Se connecter avec Twitch', auth ? 'OK pour te déconnecter' : 'Chaînes suivies, lives et rediffusions', auth ? ic('logout') : ''],
    ['pl', HAS_NATIVE && Native.playerSignedIn() ? 'Lecteur connecté à twitch.tv' : 'Connecter le lecteur à twitch.tv', HAS_NATIVE && Native.playerSignedIn() ? 'Rediffusions réservées aux subs, sans pub si abonné · OK pour déconnecter' : 'Pour les rediffusions réservées aux abonnés et les avantages de ton sub', ''],
    ['prof', 'Profils', profiles.length + ' profil(s) · actuel : ' + ((profile() || {}).name || ''), 'Gérer'],
    ['cid', 'Client ID Twitch', cfg.clientId ? cfg.clientId.slice(0, 6) + '••••••' : 'Non configuré', ''],
    ['sec', 'Client Secret (optionnel)', 'Permet d\'utiliser l\'app sans connexion', cfg.clientSecret ? '••••••' : 'Aucun'],
    ['lang', 'Langue des lives', 'Accueil et catégories', langName(cfg.lang)],
    ['mq', 'Qualité en multistream', 'Plus bas = plus fluide avec 3–4 streams', { auto: 'Auto', 720: '720p', 480: '480p', 360: '360p', 160: '160p' }[cfg.mq]],
    ['chm', 'Chat', cfg.chatMode === 'full' ? 'Chat complet Twitch : envoyer des messages, plus lent à charger' : 'Chat rapide : instantané, lecture seule', cfg.chatMode === 'full' ? 'Complet' : 'Rapide'],
    ['ap', 'PiP automatique', 'Le stream continue en PiP quand tu appuies sur Accueil', cfg.autoPip ? 'Oui' : 'Non'],
    ['ov', 'Lecteur flottant (overlay)', 'Nécessaire pour le Picture in Picture', ov ? 'Autorisé' : 'À autoriser'],
    ['pk', 'Touche du menu PiP', pk.key ? (pk.enabled ? 'Ouvre le menu du PiP depuis n\'importe quelle app' : 'À activer dans Accessibilité (Paramètres de la TV)') : 'Un bouton de la télécommande qui ouvre le menu du PiP', pk.key ? keyName(pk.name) + (pk.enabled ? '' : ' · inactif') : 'Choisir'],
    ['clr', 'Vider le multistream', multi.length + ' stream(s) enregistré(s)', ''],
    ['ver', APP, 'Version ' + (HAS_NATIVE ? Native.version() : 'web') + ' · Lecteur officiel Twitch + API Helix', ''],
  ];
  ctx.el.innerHTML = `<h1 class="pt">Paramètres</h1><div class="set"><div class="set-g glass">${rows.map(([k, l, s, v]) => `<div class="set-r f" tabindex="-1" data-k="set:${k}"><div class="l"><b>${esc(l)}</b><small>${esc(s)}</small></div><div class="v">${v && v.startsWith('<') ? v : esc(v)}</div></div>`).join('')}</div></div>`;
  const on = (k, f) => { $(`[data-k="set:${k}"]`, ctx.el).onclick = f; };
  const re = () => render(true);
  on('acc', () => auth ? choose('Se déconnecter ?', [{ label: 'Déconnexion', icon: 'logout', run: () => { auth = null; store.set('auth', null); re(); renderSide(); } }, { label: 'Annuler', run: () => { } }]) : login());
  on('pl', () => {
    if (!HAS_NATIVE) return;
    if (Native.playerSignedIn()) choose('Déconnecter le lecteur ?', [{ label: 'Déconnecter', icon: 'logout', run: () => { Native.playerSignOut(); setTimeout(re, 300); } }, { label: 'Annuler', run: () => { } }]);
    else Native.playerSignIn();
  });
  on('prof', () => profilePanel());
  on('cid', () => inputModal('Client ID Twitch', 'Depuis dev.twitch.tv/console/apps', cfg.clientId, v => { cfg.clientId = v; saveCfg(); appTok = null; re(); }));
  on('sec', () => inputModal('Client Secret', 'Laisse vide pour utiliser uniquement la connexion à ton compte', cfg.clientSecret, v => { cfg.clientSecret = v; saveCfg(); appTok = null; store.set('apptok', null); re(); }));
  on('lang', () => { const i = LANGS.findIndex(l => l[0] === cfg.lang); cfg.lang = LANGS[(i + 1) % LANGS.length][0]; saveCfg(); re(); });
  on('mq', () => { const o = ['auto', '720', '480', '360', '160']; cfg.mq = o[(o.indexOf(cfg.mq) + 1) % o.length]; saveCfg(); re(); });
  on('chm', () => { cfg.chatMode = cfg.chatMode === 'full' ? 'fast' : 'full'; saveCfg(); re(); });
  on('ap', () => { cfg.autoPip = !cfg.autoPip; saveCfg(); re(); });
  on('ov', () => HAS_NATIVE && Native.requestOverlay());
  on('pk', () => HAS_NATIVE && pipKeyPanel(re));
  on('clr', () => { multi.forEach(m => m.player = null); multi = []; store.set('multi', []); renderSide(); re(); toast('Multistream vidé'); });
  on('ver', () => toast(APP + ' — fait pour Google TV · application non officielle, non affiliée à Twitch'));
};

const KEY_NAMES = { PROG_RED: 'Rouge', PROG_GREEN: 'Vert', PROG_YELLOW: 'Jaune', PROG_BLUE: 'Bleu', INFO: 'Info', GUIDE: 'Guide',
  SETTINGS: 'Paramètres', TV_INPUT: 'Source', CAPTIONS: 'Sous-titres', BOOKMARK: 'Favori', MENU: 'Menu', MEDIA_PLAY_PAUSE: 'Lecture / pause',
  MEDIA_FAST_FORWARD: 'Avance rapide', MEDIA_REWIND: 'Retour rapide', CHANNEL_UP: 'Chaîne +', CHANNEL_DOWN: 'Chaîne −', LAST_CHANNEL: 'Chaîne précédente',
  MUTE: 'Muet', VOLUME_MUTE: 'Muet', SEARCH: 'Recherche', ASSIST: 'Assistant', DVR: 'Enregistrer', TV: 'TV', APP_SWITCH: 'Apps récentes' };
const keyName = n => KEY_NAMES[n] || (/^\d$/.test(n) ? 'Touche ' + n : n);
/** Settings → "Touche du menu PiP": choose the button, then turn the accessibility service on. */
function pipKeyPanel(done) {
  const pk = JSON.parse(Native.pipKey()); pk.name = keyName(pk.name);
  const steps = `<p class="sub">1. Choisis le bouton de la télécommande.<br>2. Active « ${esc(APP)} · Touche du menu PiP » dans Paramètres de la TV → Système → Accessibilité (seules les touches sont lues).<br>Ensuite, quand un PiP est ouvert, ce bouton ouvre ou ferme son menu, quelle que soit l'app à l'écran. Sans PiP, il garde son action habituelle.</p>`;
  const l = modal(`<h2>Touche du menu PiP</h2>${steps}
    <p style="font-size:24px;margin:18px 0">Bouton : <b>${pk.key ? esc(pk.name) : 'aucun'}</b> · Service : <b>${pk.enabled ? 'activé ✓' : 'désactivé'}</b></p>
    <div class="btns"><div class="btn pri f" tabindex="-1" data-k="learn">${ic('pip')}<span>${pk.key ? 'Changer de bouton' : 'Choisir le bouton'}</span></div>
    ${pk.enabled ? '' : `<div class="btn glass f" tabindex="-1" data-k="acc">${ic('gear')}<span>Ouvrir Accessibilité</span></div>`}
    ${pk.key ? `<div class="btn glass f" tabindex="-1" data-k="clr">${ic('x')}<span>Aucun bouton</span></div>` : ''}</div>`, { cls: 'sm' });
  const on = (k, f) => { const b = $(`[data-k=${k}]`, l.el); if (b) b.onclick = f; };
  on('learn', () => {
    $('h2', l.el).textContent = 'Appuie sur le bouton…';
    $('[data-k=learn] span', l.el).textContent = 'En attente du bouton (Retour pour annuler)';
    app.keyLearned = (code, name) => {
      delete app.keyLearned; l.close();
      if (code) toast('Bouton du menu PiP : ' + keyName(name));
      done(); if (code) setTimeout(() => pipKeyPanel(done), 300);
    };
    Native.learnPipKey();
  });
  on('acc', () => { l.close(); Native.openAccessibility(); });
  on('clr', () => { Native.clearPipKey(); l.close(); done(); });
  setFocus($('.btn', l.el));
}

// ======================================================================= login (device code)
async function login() {
  if (!cfg.clientId) return toast('Configure d\'abord le Client ID');
  const r = await http('POST', 'https://id.twitch.tv/oauth2/device', { 'Content-Type': 'application/x-www-form-urlencoded' }, form({ client_id: cfg.clientId, scopes: 'user:read:follows' }));
  if (r.status !== 200) {
    let m = r.text; try { m = JSON.parse(r.text).message; } catch (e) { }
    return choose('Connexion impossible', [{ label: 'OK', run: () => { } }], `Twitch : ${m}. Vérifie que ton application est de type « Public ».`);
  }
  const d = JSON.parse(r.text);
  const qr = HAS_NATIVE ? Native.qr(d.verification_uri) : '';
  let alive = true;
  const l = modal(`<div class="login">${qr ? `<img class="qr" src="${qr}">` : ''}<div><h2>Connecte-toi avec ton téléphone</h2>
    <p class="sub" style="font-size:23px">Scanne le QR code, ou va sur <b>twitch.tv/activate</b> et entre le code :</p>
    <div class="code">${esc(d.user_code)}</div><p class="sub">En attente de validation…</p>
    <div class="btns"><div class="btn glass f" tabindex="-1">Annuler</div></div></div></div>`, { cls: 'sm', onClose: () => { alive = false; } });
  $('.btn', l.el).onclick = () => l.close();
  setFocus($('.btn', l.el));
  let interval = (d.interval || 5) * 1000;
  const until = Date.now() + d.expires_in * 1000;
  while (alive && Date.now() < until) {
    await sleep(interval);
    if (!alive) return;
    const t = await http('POST', 'https://id.twitch.tv/oauth2/token', { 'Content-Type': 'application/x-www-form-urlencoded' },
      form({ client_id: cfg.clientId, scopes: 'user:read:follows', device_code: d.device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }));
    if (t.status === 200) {
      const j = JSON.parse(t.text);
      const v = await http('GET', 'https://id.twitch.tv/oauth2/validate', { Authorization: 'OAuth ' + j.access_token });
      const vj = JSON.parse(v.text);
      auth = { token: j.access_token, refresh: j.refresh_token, userId: vj.user_id, login: vj.login, name: vj.login, avatar: '' };
      store.set('auth', auth);
      try { const me = (await users({ ids: [vj.user_id] })).byId(vj.user_id); auth.name = me.display_name; auth.avatar = me.profile_image_url; store.set('auth', auth); } catch (e) { }
      syncProfile();
      l.close(); toast('Connecté en tant que ' + auth.name);
      renderSide(); go('home', {}, { root: true }); refreshPins();
      return;
    }
    let msg = ''; try { msg = JSON.parse(t.text).message; } catch (e) { }
    if (msg === 'slow_down') interval += 2000;
    else if (msg !== 'authorization_pending') { l.close(); toast('Connexion : ' + (msg || t.status)); return; }
  }
  if (alive) l.close();
}

// ======================================================================= Twitch embed player
async function twitchReady() {
  for (let i = 0; i < 100 && !window.Twitch; i++) await sleep(100);
  if (!window.Twitch) {
    const s = document.createElement('script'); s.src = 'https://player.twitch.tv/js/embed/v1.js'; document.head.appendChild(s);
    for (let i = 0; i < 100 && !window.Twitch; i++) await sleep(100);
  }
  if (!window.Twitch) throw new Error('Lecteur Twitch indisponible (réseau ?)');
}
async function makePlayer(el, src, { volume = 1, muted = false, maxQ = null, onRefuse = null } = {}) {
  await twitchReady();
  const o = { width: '100%', height: '100%', parent: [location.hostname], autoplay: true, muted };
  if (src.video) { const at = src.time || resumeAt(String(src.video), vsecs(src.length)); o.video = String(src.video); if (at) o.time = toTime(at); } else o.channel = src.channel;
  const p = new Twitch.Player(el, o);
  if (src.video) vodPlayers.add({ el, p, id: String(src.video) });
  const f = $('iframe', el); if (f) { f.setAttribute('tabindex', '-1'); f.setAttribute('allow', 'autoplay; fullscreen; encrypted-media'); }
  p._want = { volume, muted };
  const apply = () => { try { p.setVolume(p._want.volume); p.setMuted(p._want.muted); } catch (e) { } };
  p.addEventListener(Twitch.Player.READY, apply);
  p.addEventListener(Twitch.Player.OFFLINE, () => { p._offline = true; });
  if (src.video && HAS_NATIVE && !Native.playerSignedIn()) p.addEventListener(Twitch.Player.READY, () => setTimeout(() => {
    try { if (!p._started && p.getDuration() === 0) { const top = layers[layers.length - 1]; if (top && top.say) top.say('Rediffusion réservée aux abonnés ? Paramètres → Connecter le lecteur à twitch.tv'); } } catch (e) { }
  }, 4000));
  p.addEventListener(Twitch.Player.ONLINE, () => { p._offline = false; });
  p.addEventListener(Twitch.Player.PLAYING, () => { p._started = true; apply(); if (p._onPlaying) p._onPlaying(); });
  p.audio = (v, m) => { p._want = { volume: v, muted: m }; apply(); };
  // VOD speed (handled by the hook added to Twitch's player page, see Web.java).
  p._rate = src.rate || 1;
  p.setRate = r => { p._rate = r; const f = $('iframe', el); try { f.contentWindow.postMessage({ streamPlusRate: r }, '*'); } catch (e) { } };
  if (src.video) p.addEventListener(Twitch.Player.PLAYING, () => { if (p._rate !== 1) p.setRate(p._rate); });
  // Cap the quality as soon as Twitch lists them, before decoding starts: the TV can't decode
  // a 1440p60 source next to other streams (error 3000).
  // Multistream: keep the quality capped at all times (Twitch reverts to auto after ads), and
  // reload a stream whose decoder gave up (error 3000) instead of leaving it dead.
  if (maxQ) {
    let stuck = 0;
    const qi = setInterval(() => {
      if (!document.contains(el)) return clearInterval(qi);
      try {
        if ((p.getQualities() || []).length) setQuality(p, maxQ());
        const dead = p._started && !p._userPaused && !p._offline && p.isPaused();
        stuck = dead ? stuck + 1 : 0;
        if (stuck >= 6) { stuck = -10; p._q = null; console.log('reload ' + (src.channel || src.video)); src.video ? p.setVideo(String(src.video), p.getCurrentTime()) : p.setChannel(src.channel); }
      } catch (e) { }
    }, 1000);
  }
  // The embed waits for a click before playing with sound: give it a real tap in its centre.
  const tap = (fx = 0.5, fy = 0.5) => {
    let paused = true; try { paused = p.isPaused(); } catch (e) { }
    if (!paused || p._offline || !document.contains(el) || !HAS_NATIVE || layers[layers.length - 1].el.contains(el) === false) return;
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    Native.tap((r.left + r.width * fx) / innerWidth, (r.top + r.height * fy) / innerHeight);
    setTimeout(reclaim, 150); setTimeout(reclaim, 600);
  };
  const kick = () => { if (p._started || p._gated) return; tap(); };
  // Taps only once the player is ready (several embeds can take 10 s+ to load together).
  p.addEventListener(Twitch.Player.READY, () => { setTimeout(kick, 1500); setTimeout(kick, 5000); });
  setTimeout(kick, 15000);
  // After something covered it (a menu), Twitch has paused it: play again, tap if refused.
  p.ensure = () => { try { p.play(); } catch (e) { } setTimeout(() => tap(), 1500); };
  p.gate = () => tap();
  // Mature content: Twitch's gate is reported by the player page; the viewer decides here.
  const frame = $('iframe', el);
  const onGate = e => {
    if (!frame || e.source !== frame.contentWindow || !e.data || !e.data.streamPlusGate) return;
    if (!document.contains(el)) { removeEventListener('message', onGate); return; }
    if (p._gateOpen) return;
    p._gated = true; p._gateOpen = true;
    const who = src.name || src.channel || 'Ce stream';
    choose('Contenu pour un public averti', [
      { label: 'Commencer à regarder', icon: 'play', run: () => { p._gateOpen = false; p._gated = false; try { frame.contentWindow.postMessage({ streamPlusGateAccept: 1 }, '*'); } catch (e) { } setTimeout(() => tap(), 1500); } },
      { label: src.video ? 'Quitter la rediffusion' : 'Quitter le stream', icon: 'x', run: () => { p._gateOpen = false; if (onRefuse) onRefuse(); } },
    ], who + ' : Twitch indique que ce contenu peut ne pas convenir à tous les publics.');
  };
  addEventListener('message', onGate);
  // Paused by Twitch rather than by the user: play again (once per pause).
  p.addEventListener(Twitch.Player.PAUSE, () => {
    if (p._userPaused || p._offline) return;
    setTimeout(() => { try { if (!p._userPaused && p.isPaused()) p.play(); } catch (e) { } }, 800);
  });
  return p;
}
function setQuality(p, max) {
  // Only when the target changes: every switch rebuffers the stream.
  try {
    const qs = p.getQualities() || [];
    if (!qs.length) return;
    let target = 'auto';
    if (max === 'source') {
      const best = qs.find(q => q.group === 'chunked') || qs.filter(q => q.group !== 'auto').map(q => ({ q, h: parseInt(q.name, 10) || 0 })).sort((a, b) => b.h - a.h).map(x => x.q)[0];
      if (best) target = best.group || best.name;
    } else if (max && /p/.test(max)) {
      // An exact quality ("1080p60"); if this live doesn't have it, the closest one below.
      const want = parseInt(max, 10);
      const ex = qs.find(q => q.name === max || q.group === max);
      const near = qs.filter(q => q.group !== 'auto').map(q => ({ q, h: parseInt(q.name, 10) || 0 })).filter(x => x.h && x.h <= want).sort((a, b) => b.h - a.h)[0];
      const pick = ex || (near && near.q);
      if (pick) target = pick.group || pick.name;
    } else if (max && max !== 'auto') {
      const lim = parseInt(max, 10);
      const ok = qs.map(q => ({ q, h: parseInt(q.name, 10) || parseInt(q.group, 10) || 0 })).filter(x => x.h && x.h <= lim).sort((a, b) => b.h - a.h)[0];
      if (ok) target = ok.q.group || ok.q.name;
    }
    const cur = p.getQuality();
    if (cur === target || (p._q === target && Date.now() - p._qt < 4000)) return;
    p._q = target; p._qt = Date.now();
    p.setQuality(target);
  } catch (e) { }
}

/** Fills a missing profile picture (and name) from the Twitch API. */
async function fillAvatar(src, imgs) {
  if (src.avatar || !src.channel || !ready()) return;
  try {
    const u = (await users({ logins: [src.channel] })).byLogin(src.channel);
    if (!u) return;
    src.avatar = u.profile_image_url;
    if (!src.name) src.name = u.display_name;
    imgs.forEach(i => { if (i) i.src = src.avatar; });
  } catch (e) { }
}

// ---------- live chat ----------
// Twitch's official chat embed, docked to the right of the video (never over it: Twitch pauses
// a covered player). VODs have no official chat replay embed.
const CHAT_W = 440;
const chatSrc = ch => `https://www.twitch.tv/embed/${encodeURIComponent(ch)}/chat?parent=${location.hostname}&darkpopout`;

/* Fast chat: Twitch's official chat server (IRC over WebSocket, read-only). One socket for every
 * channel on screen; each channel keeps its last messages, so switching chats is instant. */
const Chat = {
  ws: null, open: false, refs: {}, buf: {}, room: {}, views: new Set(), badges: {}, roomBadges: {}, retry: 0,
  use(ch) { ch = ch.toLowerCase(); this.refs[ch] = (this.refs[ch] || 0) + 1; this.buf[ch] = this.buf[ch] || []; this.connect(); if (this.open && this.refs[ch] === 1) this.send('JOIN #' + ch); },
  release(ch) { ch = ch.toLowerCase(); if (!this.refs[ch]) return; if (--this.refs[ch] === 0) { delete this.refs[ch]; if (this.open) this.send('PART #' + ch); } },
  send(l) { try { this.ws.send(l); } catch (e) { } },
  connect() {
    if (this.ws) return;
    const ws = this.ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
    ws.onopen = () => {
      this.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
      this.send('PASS SCHMOOPIIE');
      this.send('NICK justinfan' + (10000 + Math.floor(Math.random() * 89999)));
      this.open = true; this.retry = 0;
      Object.keys(this.refs).forEach(ch => this.send('JOIN #' + ch));
    };
    ws.onmessage = e => String(e.data).split('\r\n').forEach(l => l && this.line(l));
    ws.onerror = e => console.log('chat ws error');
    ws.onclose = e => {
      console.log('chat ws closed ' + e.code);
      this.ws = null; this.open = false;
      if (Object.keys(this.refs).length) setTimeout(() => this.connect(), Math.min(10000, 1000 * ++this.retry));
    };
  },
  line(l) {
    if (l.startsWith('PING')) return this.send('PONG' + l.slice(4));
    let tags = {}, i = 0;
    if (l[0] === '@') { i = l.indexOf(' '); l.slice(1, i).split(';').forEach(t => { const k = t.indexOf('='); tags[t.slice(0, k)] = t.slice(k + 1); }); i++; }
    const rest = l.slice(i), m = /^:(\S+) (\S+) #(\S+)(?: :(.*))?$/.exec(rest);
    if (!m) return;
    const cmd = m[2], ch = m[3];
    if (cmd === 'ROOMSTATE' && tags['room-id']) { this.room[ch] = tags['room-id']; this.loadBadges(tags['room-id']); return; }
    if (cmd === 'CLEARCHAT' && !m[4]) { this.buf[ch] = []; return this.emit(ch, null); }
    if (cmd !== 'PRIVMSG' && cmd !== 'USERNOTICE') return;
    const msg = { tags, text: m[4] || '', notice: cmd === 'USERNOTICE' ? (tags['system-msg'] || '').replace(/\\s/g, ' ') : '' };
    const b = this.buf[ch] || (this.buf[ch] = []);
    b.push(msg); if (b.length > 120) b.splice(0, b.length - 120);
    this.emit(ch, msg);
  },
  emit(ch, msg) { this.n = (this.n || 0) + 1; this.views.forEach(v => v.onMsg(ch, msg)); },
  async loadBadges(roomId) {
    if (!ready()) return;
    const load = async (key, path, params) => {
      if (this.badges[key]) return; this.badges[key] = {};
      try { (await helix(path, params)).data.forEach(set => set.versions.forEach(v => { this.badges[key][set.set_id + '/' + v.id] = v.image_url_2x; })); } catch (e) { }
    };
    await Promise.all([load('global', 'chat/badges/global'), load(roomId, 'chat/badges', { broadcaster_id: roomId })]);
  },
  badge(ch, id) { const r = this.badges[this.room[ch]] || {}, g = this.badges.global || {}; return r[id] || g[id]; },
};
const NAME_COLORS = ['#ff7a7a', '#7ab6ff', '#7aff9e', '#ffb37a', '#d38aff', '#ff8ad8', '#7affea', '#ffe27a'];
function readable(c, name) {
  if (!c) { let h = 0; for (const x of name) h = (h * 31 + x.charCodeAt(0)) | 0; return NAME_COLORS[Math.abs(h) % NAME_COLORS.length]; }
  const n = parseInt(c.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) < 90 ? `rgb(${(r + 255) >> 1},${(g + 255) >> 1},${(b + 255) >> 1})` : c;
}
function renderMsg(ch, m) {
  const t = m.tags, name = t['display-name'] || t.login || '';
  let html = '';
  if (m.notice) html += `<div class="cn">${esc(m.notice)}</div>`;
  if (m.text) {
    const badges = (t.badges || '').split(',').filter(Boolean).map(id => Chat.badge(ch, id)).filter(Boolean).map(u => `<img class="bd" src="${u}">`).join('');
    // Emotes: "id:start-end,start-end/id2:..." in code-point positions.
    const chars = Array.from(m.text), marks = [];
    (t.emotes || '').split('/').filter(Boolean).forEach(e => { const [id, pos] = e.split(':'); pos.split(',').forEach(r => { const [a, b] = r.split('-').map(Number); marks.push([a, b, id]); }); });
    marks.sort((x, y) => x[0] - y[0]);
    let out = '', i = 0;
    marks.forEach(([a, b, id]) => {
      out += esc(chars.slice(i, a).join(''));
      out += `<img class="em" alt="" src="https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/1.0">`;
      i = b + 1;
    });
    out += esc(chars.slice(i).join(''));
    const me = /^\u0001ACTION (.*)\u0001$/.test(m.text);
    html += `<div class="cm">${badges}<b style="color:${readable(t.color, name)}">${esc(name)}</b>${me ? ' ' : ' : '}<span${me ? ` style="color:${readable(t.color, name)}"` : ''}>${me ? out.replace(/^\u0001ACTION |\u0001$/g, '') : out}</span></div>`;
  }
  return html;
}

function chatBox(channel, name) {
  const c = h(`<div class="chatbox glass dark"><div class="chat-h">${ic('chat')}<span></span></div><div class="chat-list"></div></div>`);
  const list = $('.chat-list', c);
  let cur = null, pend = [], raf = 0;
  const flush = () => {
    raf = 0; if (!pend.length) return;
    const ph = list.querySelector('.cn.wait'); if (ph) ph.remove();
    list.insertAdjacentHTML('beforeend', pend.join('')); pend = [];
    while (list.childElementCount > 90) list.firstElementChild.remove();
    list.scrollTop = list.scrollHeight;
  };
  const view = { onMsg(ch, m) { if (ch !== cur) return; if (!m) { list.innerHTML = ''; return; } pend.push(renderMsg(ch, m)); if (!raf) raf = requestAnimationFrame(flush); } };
  if (cfg.chatMode === 'full') {
    c.classList.add('full');
    list.outerHTML = '<iframe tabindex="-1"></iframe>';
  }
  c.set = (ch, nm) => {
    ch = ch.toLowerCase();
    $('.chat-h span', c).textContent = 'Chat · ' + (nm || ch);
    if (ch === cur) return;
    if (cfg.chatMode === 'full') { cur = ch; $('iframe', c).src = chatSrc(ch); return; }
    if (cur) Chat.release(cur);
    cur = ch; Chat.use(ch);
    const b = Chat.buf[ch] || [];
    list.innerHTML = b.length ? b.slice(-60).map(m => renderMsg(ch, m)).join('') : '<div class="cn wait">Connexion au chat…</div>';
    list.scrollTop = list.scrollHeight;
  };
  c.dispose = () => { Chat.views.delete(view); if (cur && cfg.chatMode !== 'full') Chat.release(cur); cur = null; };
  Chat.views.add(view);
  c.set(channel, name);
  return c;
}
/** Keeps the chats of every multistream stream joined, so switching between them is instant. */
const warmChats = new Set();
function warmChat(chs) {
  if (cfg.chatMode === 'full') return;
  const want = new Set(chs.map(x => x.toLowerCase()));
  warmChats.forEach(ch => { if (!want.has(ch)) { Chat.release(ch); warmChats.delete(ch); } });
  want.forEach(ch => { if (!warmChats.has(ch)) { Chat.use(ch); warmChats.add(ch); } });
}

// ---------- single player ----------
// Twitch pauses its embed as soon as anything covers it ("style visibility"), so controls never
// sit on the video: showing them squeezes the video (tvOS-style) and the glass goes around it.
let playerLayer = null;
const isVideoLayer = l => l && (l.kind === 'player' || l.kind === 'multi' || l.kind === 'clip');
function closePlayer() { if (playerLayer) playerLayer.close(); }
async function play(src) {
  if (!src) return;
  closePlayer();
  if (multiLayer) multiLayer.close();
  const isVod = !!src.video;
  const el = h(`<div class="layer vid" id="player"><div class="sink" tabindex="-1"></div><div class="pl-bg"></div><div class="embed"></div>
    <div class="pl-info glass ui t"><img src="${esc(src.avatar || BLANK)}"><div><b>${esc(src.name || src.channel)} ${isVod ? '<span class="tag" style="background:#6441a5">REDIFF</span>' : '<span class="tag live">LIVE</span>'}</b>
      <small>${esc(src.title || '')}${src.game ? ' · ' + esc(src.game) : ''}${src.viewers ? ' · ' + fmtN(src.viewers) + ' spectateurs' : ''}${src.date ? ' · ' + ago(src.date) : ''}</small></div></div>
    <div class="pl-msg glass ui t"></div>
    ${isVod ? '<div class="pl-seekrow glass ui b f" tabindex="-1"><span class="cur">0:00</span><div class="tr"><i></i><b></b></div><span class="tot">…</span></div>' : ''}
    <div class="pl-bar glass ui b"></div></div>`);
  if (src.thumb) $('.pl-bg', el).style.backgroundImage = `url("${src.thumb}")`;
  const bar = $('.pl-bar', el), msg = $('.pl-msg', el);
  let p = null, paused = false, hideT = null, vol = cfg.vol, muted = false, seekT = null;
  const btn = (icon, label, fn, cls = '') => { const b = h(`<div class="btn ${label ? '' : 'icon'} f ${cls}" tabindex="-1">${ic(icon)}${label ? `<span>${esc(label)}</span>` : ''}</div>`); b.onclick = () => { fn(b); wake(); }; bar.appendChild(b); return b; };
  const say = t => { msg.textContent = t; msg.classList.add('on'); clearTimeout(say._t); say._t = setTimeout(() => msg.classList.remove('on'), 2500); wake(); };
  const seek = d => { if (!p) return; const t = Math.max(0, p.getCurrentTime() + d); p.seek(t); say((d > 0 ? '+' : '−') + Math.abs(d) + ' s · ' + secs(t)); };
  // Big progress bar (VODs): ◀▶ move a preview position, the jump happens when you stop (or on OK).
  const srow = $('.pl-seekrow', el);
  let target = null, tgtT = null, lastStep = 0, streak = 0;
  function drawSeek() {
    if (!srow || !p) return;
    let c = 0, d = 0; try { c = p.getCurrentTime(); d = p.getDuration(); } catch (e) { }
    const t = target ?? c;
    $('.cur', srow).textContent = secs(t); $('.tot', srow).textContent = d ? secs(d) : '…';
    $('i', srow).style.width = (d ? Math.min(100, c / d * 100) : 0) + '%';
    $('b', srow).style.left = (d ? Math.min(100, t / d * 100) : 0) + '%';
    srow.classList.toggle('pv', target !== null);
    if (d && mutedSegs && !srow._segs) {
      srow._segs = true;
      $('.tr', srow).insertAdjacentHTML('afterbegin', mutedSegs.map(m => `<u style="left:${(m.offset / d * 100).toFixed(3)}%;width:${Math.max(0.15, m.duration / d * 100).toFixed(3)}%"></u>`).join(''));
    }
  }
  let mutedSegs = null;
  if (isVod) helix('videos', { id: src.video }).then(r => { const v = r.data && r.data[0]; mutedSegs = (v && v.muted_segments) || []; drawSeek(); }).catch(() => { });
  function commitSeek() { clearTimeout(tgtT); if (target === null || !p) return; p.seek(target); target = null; drawSeek(); }
  function nudge(dir) {
    if (!p) return;
    const now = Date.now(); streak = now - lastStep < 450 ? streak + 1 : 0; lastStep = now;
    const step = streak < 4 ? 10 : streak < 10 ? 30 : streak < 20 ? 60 : 180;
    let d = 0; try { d = p.getDuration(); } catch (e) { }
    target = Math.max(0, Math.min(d || Infinity, (target ?? p.getCurrentTime()) + dir * step));
    drawSeek(); clearTimeout(tgtT); tgtT = setTimeout(commitSeek, 900);
  }
  if (srow) srow.onclick = commitSeek;
  if (isVod) btn('back10', '', () => seek(-10));
  const pp = btn('pause', '', b => { if (!p) return; paused = !paused; p._userPaused = paused; paused ? p.pause() : p.play(); b.innerHTML = ic(paused ? 'play' : 'pause'); });
  if (isVod) {
    btn('fwd10', '', () => seek(10));
    const rb = h(`<div class="btn f rate" tabindex="-1">${rateLabel(cfg.vrate || 1)}</div>`);
    rb.onclick = () => {
      const r = RATES[(RATES.indexOf(cfg.vrate || 1) + 1) % RATES.length];
      cfg.vrate = r; saveCfg(); rb.textContent = rateLabel(r); if (p) p.setRate(r); say('Vitesse ' + rateLabel(r)); wake();
    };
    bar.appendChild(rb);
  }
  const mb = btn('vol', '', () => { muted = !muted; sl.set(vol, muted); });
  const sl = slider(vol, muted, (v, m) => { vol = v; muted = m || v === 0; cfg.vol = vol; saveCfg(); mb.innerHTML = ic(muted || vol === 0 ? 'mute' : 'vol'); if (p) p.audio(vol, muted); wake(); });
  sl.set(vol, muted, false);
  bar.appendChild(sl);
  if (!isVod) btn('multi', 'Multistream', () => { const s = src; l.close(); multiFrom(s); });
  let chat = null;
  const chatBtn = !isVod && src.channel ? btn('chat', 'Chat', () => { cfg.chat = !cfg.chat; saveCfg(); applyChat(); }) : null;
  function applyChat() {
    const on = !!(chatBtn && cfg.chat);
    if (on && !chat) { chat = chatBox(src.channel, src.name); el.appendChild(chat); }
    if (!on && chat) { chat.dispose(); chat.remove(); chat = null; }
    if (chatBtn) chatBtn.classList.toggle('on', on);
    plLayout();
  }
  /** Video rectangle: the screen minus the chat column, minus the glass bars when they show. */
  function plLayout() {
    const W = 1920 - (chat ? CHAT_W + 16 : 0), ui = !el.classList.contains('noui');
    let w, hh, x, y;
    if (ui) { w = Math.min(W - 48, srow ? 1220 : 1408); hh = Math.round(w * 9 / 16); x = Math.round((W - w) / 2); y = srow ? 140 : 150; }
    else { w = Math.min(W, 1920); hh = Math.round(w * 9 / 16); x = 0; y = Math.round((1080 - hh) / 2); }
    Object.assign($('.embed', el).style, { left: x + 'px', top: y + 'px', width: w + 'px', height: hh + 'px' });
    $('.pl-info', el).style.left = Math.max(24, x) + 'px';
  }
  btn('pip', 'PiP', () => { const t = p && isVod ? p.getCurrentTime() : 0; toPip({ ...src, time: t }, vol, muted, true); });
  if (src.channel) btn('user', 'Chaîne', () => { const c = src.channel; l.close(); go('channel', { login: c }); });
  if (isVod) btn('tap', '', () => { if (p) p.gate(); say('Lecteur touché (lecture)'); });
  btn('gear', '', () => playerSettings(p, src, isVod, say));

  function wake() { if (el.classList.contains('noui')) { el.classList.remove('noui'); plLayout(); } clearTimeout(hideT); hideT = setTimeout(hide, 6000); }
  let lastBar = null;
  function hide() { const a = document.activeElement; if (a && (bar.contains(a) || a === srow)) lastBar = a; el.classList.add('noui'); plLayout(); clearTimeout(hideT); $('.sink', el).focus({ preventScroll: true }); }
  const l = pushLayer({
    el, kind: 'player', src, say, get vol() { return vol; }, get muted() { return muted; }, player: () => p,
    resume() { if (p && !paused) p.ensure(); },
    onKey(k) {
      if (el.classList.contains('noui')) {
        if (srow && (k === 'left' || k === 'right')) { wake(); setFocus(srow, true); nudge(k === 'left' ? -1 : 1); return true; }
        if (k === 'playpause') { pp.click(); return true; }
        if (k === 'chup' || k === 'chdown') { zap(k === 'chup' ? -1 : 1); return true; }
        wake(); if (!bar.contains(document.activeElement)) setFocus(lastBar && (bar.contains(lastBar) || lastBar === srow) ? lastBar : pp, true); return true;
      }
      wake();
      if (k === 'playpause') { pp.click(); return true; }
      if (k === 'ff') { seek(30); return true; } if (k === 'rew') { seek(-30); return true; }
      if (k === 'chup' || k === 'chdown') { zap(k === 'chup' ? -1 : 1); return true; }
      const a = document.activeElement;
      if (srow && a === srow) {
        if (k === 'left' || k === 'right') { nudge(k === 'left' ? -1 : 1); return true; }
        if (k === 'down') { setFocus(pp, true); return true; }
      }
      if (k === 'up') { if (srow && a !== srow) { setFocus(srow, true); return true; } hide(); return true; }
      return false;
    },
    back() { if (!el.classList.contains('noui')) { hide(); return true; } return false; },
    close() { if (isVod && p) { try { savePos(String(src.video), p.getCurrentTime(), p.getDuration()); } catch (e) { } } if (chat) chat.dispose(); clearInterval(seekT); clearTimeout(tgtT); clearTimeout(hideT); playerLayer = null; if (HAS_NATIVE) Native.keepOn(false); popLayer(l); },
  });
  function zap(d) {
    const live = pinsSorted().filter(x => pinLive[x.id]); if (!live.length) return say('Aucun épinglé en direct');
    const i = live.findIndex(x => x.id === src.id); const n = live[(i + d + live.length) % live.length];
    play(srcFromStream(pinLive[n.id], n));
  }
  playerLayer = l;
  fillAvatar(src, [$('.pl-info img', el)]);
  if (HAS_NATIVE) Native.keepOn(true);
  applyChat();
  // Opens full screen without controls: the first OK shows them (it must not pause).
  lastBar = pp; hide();
  try { p = await makePlayer($('.embed', el), isVod ? { ...src, rate: cfg.vrate || 1 } : src, { volume: vol, muted, maxQ: () => cfg.quality || 'source', onRefuse: () => l.close() }); }
  catch (e) { say(e.message); }
  // The play/pause icon follows the real player state.
  if (p) {
    p.addEventListener(Twitch.Player.PLAYING, () => { paused = false; p._userPaused = false; pp.innerHTML = ic('pause'); });
    p.addEventListener(Twitch.Player.PAUSE, () => { if (p._userPaused) { paused = true; pp.innerHTML = ic('play'); } });
  }
  if (isVod && p) {
    drawSeek(); seekT = setInterval(() => { if (!el.classList.contains('noui')) drawSeek(); }, 1000);
  }
}
function playClip(c) {
  closePlayer();
  const el = h(`<div class="layer" id="player"><div class="embed"><iframe src="https://clips.twitch.tv/embed?clip=${encodeURIComponent(c.id)}&parent=${location.hostname}&autoplay=true&muted=false" allow="autoplay; fullscreen" tabindex="-1"></iframe></div>
    <div class="pl-info glass ui t"><div><b>${esc(c.title)}</b><small>${esc(c.broadcaster_name)} · clippé par ${esc(c.creator_name)} · ${fmtN(c.view_count)} vues</small></div></div></div>`);
  let hideT;
  const l = pushLayer({ el, kind: 'clip', onKey() { el.classList.remove('noui'); clearTimeout(hideT); hideT = setTimeout(() => el.classList.add('noui'), 4000); return true; }, close() { playerLayer = null; popLayer(l); } });
  playerLayer = l;
  hideT = setTimeout(() => el.classList.add('noui'), 4000);
}

/** ⚙ in the player: quality (kept for next time) and, for lives, low latency. */
const qLabel = q => q === 'auto' ? 'Auto' : q === 'source' ? 'Source' : q;
function playerSettings(p, src, isVod, say) {
  if (!p) return;
  const l = modal(`<h2>Réglages du lecteur</h2><p class="sub">Qualité actuelle : ${esc(p.getQuality() === 'chunked' ? 'source' : p.getQuality())}</p>
    <div class="sec-h" style="margin:18px 0 10px"><h2 style="font-size:26px">Qualité</h2></div><div class="btns" id="qs"></div>
    ${isVod ? '' : '<div class="sec-h" style="margin:30px 0 10px"><h2 style="font-size:26px">Faible latence</h2><small>moins de retard sur le direct, un peu plus de mises en mémoire tampon</small></div><div class="btns" id="ll"></div>'}`, { cls: 'opt' });
  const box = $('#qs', l.el);
  // Auto, then every quality Twitch offers for this live, by its own name.
  const prefs = [['auto', 'Auto']];
  (p.getQualities() || []).filter(q => q.group !== 'auto').forEach(q => prefs.push([q.group === 'chunked' ? 'source' : q.name, q.name]));
  prefs.forEach(([v, label]) => {
    const b = h(`<div class="btn glass f ${cfg.quality === v ? 'on' : ''}" tabindex="-1">${esc(label)}</div>`);
    b.onclick = () => { cfg.quality = v; saveCfg(); p._q = null; setQuality(p, v); l.close(); say('Qualité : ' + qLabel(v)); };
    box.appendChild(b);
  });
  if (!isVod) {
    const ll = $('#ll', l.el);
    [[true, 'Activée'], [false, 'Désactivée']].forEach(([v, t]) => {
      const b = h(`<div class="btn glass f ${cfg.lowLat === v ? 'on' : ''}" tabindex="-1">${t}</div>`);
      b.onclick = () => {
        l.close(); if (cfg.lowLat === v) return;
        cfg.lowLat = v; saveCfg(); if (HAS_NATIVE) Native.setLowLatency(v);
        p._q = null; p.setChannel(src.channel);  // the player reads it when it (re)starts
        say('Faible latence ' + (v ? 'activée' : 'désactivée'));
      };
      ll.appendChild(b);
    });
  }
  setFocus($('.btn.on', box) || box.firstElementChild);
}

// ---------- PiP ----------
function toPip(src, volume, muted, goHome) {
  if (!HAS_NATIVE) return toast('PiP disponible uniquement sur la TV');
  if (!Native.canOverlay()) {
    toast('Autorise l\'affichage par-dessus les autres apps', 4000);
    Native.requestOverlay(); return false;
  }
  const o = { channel: src.channel, name: src.name, title: src.title, avatar: src.avatar, id: src.id, volume, muted };
  if (src.video) { o.video = String(src.video); o.time = Math.floor(src.time || 0); }
  closePlayer();
  Native.startPip(JSON.stringify(o), !!goHome);
  pipState = o; renderSide();
  return true;
}
function pipPanel() {
  const st = HAS_NATIVE ? JSON.parse(Native.pipState()) : null;
  if (!st) { pipState = null; renderSide(); return toast('Aucun stream en PiP'); }
  const l = modal(`<h2>Picture in Picture</h2><div class="pipbox"><img src="${esc(st.avatar || BLANK)}"><div><h2>${esc(st.name || st.channel)}</h2><p class="sub">${esc(st.title || '')}</p></div></div>
    <div class="btns" id="pv"></div><div style="height:22px"></div><div class="btns" id="pa"></div>`, { cls: 'sm' });
  const pv = $('#pv', l.el), pa = $('#pa', l.el);
  const mb = h(`<div class="btn glass icon f" tabindex="-1">${ic(st.muted ? 'mute' : 'vol')}</div>`);
  const sl = slider(st.volume, st.muted, (v, m) => { Native.pipCmd('volume', String(v)); if (m && v > 0) Native.pipCmd('mute', 'true'); else if (!m) Native.pipCmd('mute', 'false'); mb.innerHTML = ic(m || v === 0 ? 'mute' : 'vol'); }, 'big');
  sl.style.width = '560px';
  mb.onclick = () => sl.set(sl._v, !sl._m);
  pv.append(mb, sl);
  [['corner', 'Déplacer', 'expand'], ['size', 'Taille', 'pip'], ['expand', 'Plein écran', 'play'], ['stop', 'Fermer le PiP', 'x']].forEach(([c, label, icon]) => {
    const b = h(`<div class="btn glass f" tabindex="-1">${ic(icon)}<span>${label}</span></div>`);
    b.onclick = () => {
      if (c === 'expand') { l.close(); pipState = null; renderSide(); Native.pipCmd('expand', ''); return; }
      Native.pipCmd(c, ''); if (c === 'stop') { l.close(); pipState = null; renderSide(); }
    };
    pa.appendChild(b);
  });
  setFocus(sl);
}

// ======================================================================= multistream
let multiLayer = null;
const MAXM = 4;
const saveMulti = () => store.set('multi', multi.map(({ channel, id, name, avatar, title, game, video, rate, vol, muted, player }) => {
  let time; try { time = video && player ? Math.floor(player.getCurrentTime()) : undefined; } catch (e) { }
  return { channel, id, name, avatar, title, game, video, rate, vol, muted, time };
}));
function rects(n, W = 1920) {
  const H = 1080, hh = 540, w = Math.round(W / 2), w2 = Math.min(W, 960);
  if (n <= 1) return [[0, 0, W, H]];
  if (n === 2) return [[Math.round((W - w2) / 2), 0, w2, hh], [Math.round((W - w2) / 2), hh, w2, hh]];  // top / bottom, each 16:9
  if (n === 3) return [[0, 0, w, hh], [w, 0, W - w, hh], [Math.round((W - w) / 2), hh, w, hh]];       // two on top, one centred below
  return [[0, 0, w, hh], [w, 0, W - w, hh], [0, hh, w, hh], [w, hh, W - w, hh]];                    // four corners
}
const mkey = s => s.video ? 'v:' + s.video : s.channel;
function addToMulti(src, open) {
  if (!src || !(src.channel || src.video)) return;
  if (multi.some(m => mkey(m) === mkey(src))) { toast(src.name + ' est déjà dans le multistream'); }
  else if (multi.length >= MAXM) { toast('Maximum 4 streams — retire-en un d\'abord'); }
  else {
    multi.push({ channel: src.channel, id: src.id, name: src.name, avatar: src.avatar, title: src.title, game: src.game, video: src.video, time: src.time, rate: 1, vol: multi.length ? 0.5 : 1, muted: multi.length > 0 });
    saveMulti(); renderSide();
    if (multiLayer) multiLayer.sync(); else toast('➕ ' + src.name + ' ajouté au multistream (' + multi.length + '/4)');
  }
  if (open && !multiLayer) openMulti();
}
/** "Multistream" from a live: opens the multistream and its picker; the live is only suggested. */
function multiFrom(src) {
  if (!multiLayer) openMulti(true);
  picker(s => addToMulti(s), src);
}
function openMulti(noPicker) {
  closePlayer();
  if (multiLayer) return;
  const el = h(`<div class="layer vid" id="multi"><div class="sink" tabindex="-1"></div><div class="pl-bg"></div><div class="mtop glass ui"></div></div>`);
  const top = $('.mtop', el);
  let hideT = null;
  const tb = (icon, label, fn) => { const b = h(`<div class="btn icon f" tabindex="-1" title="${label}">${ic(icon)}</div>`); b.onclick = () => { fn(); wake(); }; top.appendChild(b); return b; };
  const addB = tb('plus', 'Ajouter', () => picker(s => addToMulti(s)));
  tb('mute', 'Tout couper', () => { multi.forEach(m => { m.slider && m.slider.set(m.vol, true); }); say('Tous les streams coupés'); });
  const chatT = tb('chat', 'Chat', () => { cfg.mchat = !cfg.mchat; saveCfg(); applyChat(); });
  tb('x', 'Quitter', () => l.close());
  let chat = null, chatIdx = 0;
  function applyChat() {
    const lives = multi.filter(m => !m.video);
    if (!multi[chatIdx] || multi[chatIdx].video) chatIdx = multi.findIndex(m => !m.video);
    const on = !!cfg.mchat && lives.length > 0 && chatIdx >= 0;
    if (on && !chat) { chat = chatBox(multi[chatIdx].channel, multi[chatIdx].name); el.appendChild(chat); }
    if (on) chat.set(multi[chatIdx].channel, multi[chatIdx].name);
    if (!on && chat) { chat.dispose(); chat.remove(); chat = null; }
    warmChat(on ? lives.map(m => m.channel) : []);
    chatT.classList.toggle('on', on);
    multi.forEach((m, i) => m.chatB && m.chatB.classList.toggle('on', on && i === chatIdx));
    layout();
  }
  // Messages go to a native toast: a separate window, so it never covers the embeds.
  const say = t => { if (HAS_NATIVE) Native.toast(t); else console.log(t); };

  function wake() { if (el.classList.contains('noui')) { el.classList.remove('noui'); layout(); } clearTimeout(hideT); if (multi.length) hideT = setTimeout(hide, 6000); }
  function hide() { if (!multi.length) return; el.classList.add('noui'); clearTimeout(hideT); layout(); $('.sink', el).focus({ preventScroll: true }); }
  function buildSlot(m) {
    const s = h(`<div class="slot"><div class="embed"></div>
      <div class="mx glass ui b"><div class="who f" tabindex="-1"><img src="${esc(m.avatar || BLANK)}"><span>${esc(m.name)}</span>${m.video ? '<i class="vtag">REDIFF</i>' : ''}</div></div></div>`);
    const mx = $('.mx', s);
    const b = (icon, fn) => { const x = h(`<div class="btn icon f" tabindex="-1">${ic(icon)}</div>`); x.onclick = () => { fn(x); wake(); }; mx.appendChild(x); return x; };
    const mb = b(m.muted ? 'mute' : 'vol', () => m.slider.set(m.vol, !m.muted));
    b('solo', () => { multi.forEach(o => { const me = o === m; o.slider.set(me ? Math.max(o.vol, 0.8) : o.vol, !me); }); say('🎧 Son uniquement : ' + m.name); });
    if (!m.video) m.chatB = b('chat', () => { chatIdx = multi.indexOf(m); cfg.mchat = true; saveCfg(); applyChat(); });
    else {
      const rb = h(`<div class="btn f rate" tabindex="-1">${rateLabel(m.rate || 1)}</div>`);
      rb.onclick = () => { m.rate = RATES[(RATES.indexOf(m.rate || 1) + 1) % RATES.length]; rb.textContent = rateLabel(m.rate); if (m.player) m.player.setRate(m.rate); saveMulti(); wake(); };
      mx.appendChild(rb);
    }
    b('expand', () => { const src = { ...m }; if (m.video) { try { src.time = m.player.getCurrentTime(); } catch (e) { } } l.close(); play(src); });
    b('x', () => { removeSlot(m); });
    m.slider = slider(m.vol, m.muted, (v, mu) => {
      m.vol = v; m.muted = mu || v === 0; mb.innerHTML = ic(m.muted ? 'mute' : 'vol');
      if (m.player) m.player.audio(m.vol, m.muted); saveMulti(); wake();
    });
    mx.appendChild(m.slider);
    $('.who', s).onclick = () => { const c = m.channel; cardMenu({ kind: 'channel', login: c, id: m.id, name: m.name, avatar: m.avatar }); };
    m.el = s;
    fillAvatar(m, [$('.who img', s)]).then(() => saveMulti());
    el.appendChild(s);
    makePlayer($('.embed', s), m, { volume: m.vol, muted: m.muted, maxQ: () => multi.length > 1 ? cfg.mq : 'auto', onRefuse: () => removeSlot(m) }).then(p => {
      m.player = p; p._onPlaying = () => setQuality(p, multi.length > 1 ? cfg.mq : 'auto');
    }).catch(e => say(e.message));
  }
  /** Cells per layout; with the controls shown each video shrinks inside its cell, its mixer below it. */
  function layout() {
    const W = 1920 - (chat ? CHAT_W + 16 : 0);
    const n = multi.length, r = rects(n, W), ui = !el.classList.contains('noui');
    multi.forEach((m, i) => {
      const [x, y, w, hh] = r[i];
      Object.assign(m.el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: hh + 'px' });
      m.el.classList.toggle('narrow', w < 900);  // e.g. 4 streams + chat: compact mixer that fits its cell
      const e = $('.embed', m.el);
      if (ui) {
        const side = n === 1 ? 170 : chat ? 50 : 104;
        const ew = Math.min(w - side * 2, Math.round((hh - 112) * 16 / 9)), eh = Math.round(ew * 9 / 16);
        Object.assign(e.style, { left: Math.round((w - ew) / 2) + 'px', top: '12px', width: ew + 'px', height: eh + 'px' });
      } else Object.assign(e.style, { left: '0px', top: '0px', width: w + 'px', height: hh + 'px' });
      if (m.player) setQuality(m.player, n > 1 ? cfg.mq : 'auto');
    });
    // Toolbar column: in the gap between the two columns (3–4 streams), else on the left.
    Object.assign(top.style, n >= 3 ? { left: Math.round(W / 2) - 42 + 'px', top: (n === 3 ? 270 : 540) - 160 + 'px' } : { left: '40px', top: '380px' });
    addB.style.display = n >= MAXM ? 'none' : '';
  }
  function removeSlot(m) {
    const i = multi.indexOf(m); if (i < 0) return;
    multi.splice(i, 1); m.el.remove(); m.player = null; saveMulti(); renderSide();
    // Only one stream left: back to the normal player for it.
    if (multi.length === 1) {
      const last = multi[0], src = { channel: last.channel, id: last.id, name: last.name, avatar: last.avatar, title: last.title, game: last.game };
      if (last.video) { src.video = last.video; try { src.time = last.player.getCurrentTime(); } catch (e) { } }
      l.close(); play(src); toast('Plus qu\'un stream : retour au lecteur classique');
      return;
    }
    if (chatIdx === i) chatIdx = 0; else if (chatIdx > i) chatIdx--;
    applyChat();
    const next = multi[Math.min(i, multi.length - 1)];
    setFocus(next ? next.slider : addB, true);
    if (!multi.length) { el.classList.remove('noui'); say('Multistream vide — ajoute des streams avec +'); }
  }
  const l = pushLayer({
    el, kind: 'multi', say,
    sync() { multi.forEach(m => { if (!m.el || !el.contains(m.el)) buildSlot(m); }); applyChat(); renderSide(); wake(); },
    resume() { multi.forEach(m => m.player && m.player.ensure()); },
    onKey(k) {
      if (el.classList.contains('noui')) {
        wake();
        const a = document.activeElement;
        if (!a || !el.contains(a) || !visible(a)) setFocus(multi[0] ? multi[0].slider : addB, true);
        return true;
      }
      wake(); return false;
    },
    back() { if (!el.classList.contains('noui') && multi.length) { hide(); return true; } return false; },
    close() { saveMulti(); if (chat) chat.dispose(); warmChat([]); clearTimeout(hideT); multi.forEach(m => { m.player = null; m.el = null; m.slider = null; }); multiLayer = null; if (HAS_NATIVE) Native.keepOn(false); popLayer(l); renderSide(); },
  });
  multiLayer = l;
  if (HAS_NATIVE) Native.keepOn(true);
  multi.forEach(buildSlot); applyChat(); wake();
  setFocus(multi[0] ? multi[0].slider : addB, true);
  if (!multi.length && !noPicker) picker(s => addToMulti(s));
}
/** Stream picker for the multistream: pinned & followed live, popular, or search. */
async function picker(onPick, suggest) {
  const l = modal(`<div style="display:flex;align-items:center;gap:24px"><div style="flex:1"><h2>Choisis tes streams</h2><p class="sub"></p></div><div class="btn pri f" tabindex="-1" data-k="done">Terminé</div></div>
    <div class="search glass field f" tabindex="-1" style="height:84px">${ic('search')}<input type="search" placeholder="Rechercher une chaîne (live ou rediffusions)…"></div><div id="pk"><p class="loading">Chargement…</p></div>`);
  const box = $('#pk', l.el), inp = $('input', l.el);
  const sub = $('.sub', l.el), done = $('[data-k=done]', l.el);
  const count = () => { sub.textContent = `${multi.length}/4 · un live, ou une chaîne pour choisir une rediffusion, puis Terminé`; };
  count();
  done.onclick = () => l.close();
  const pick = (s, c) => {
    if (multi.length >= MAXM) return;
    onPick(s.video ? s : srcFromStream(s));
    c.classList.add('added'); c.onclick = null; count();
    if (multi.length >= MAXM) l.close();
  };
  const card = s => {
    const c = streamCard(s); c.style.width = '360px';
    if (multi.some(m => m.channel === s.user_login)) c.classList.add('added'); else c.onclick = () => pick(s, c);
    return c;
  };
  // A channel's page inside the picker: its live (if any) and every VOD (paginated).
  let inChannel = false;
  const ctx = { alive: true };
  l.back = () => { if (!inChannel) return false; inChannel = false; ctx.alive = false; fill(); return true; };
  const chanTile = c => { const t = chanCard(c); t.onclick = () => openChan(c); t._ctx = null; return t; };
  const openChan = async c => {
    inChannel = true; ctx.alive = false;
    const my = { alive: true }; Object.assign(ctx, my); ctx.alive = true;
    box.innerHTML = `<div class="btns" style="margin:20px 0 4px"><div class="btn glass f" tabindex="-1" data-k="pkback">← Retour</div><h2 style="margin-left:12px">${esc(c.name)}</h2></div><div id="pklive"></div><section class="sec"><div class="sec-h"><h2>Rediffusions</h2><small>OK pour l'ajouter</small></div><div class="grid" style="grid-template-columns:repeat(4,minmax(0,1fr))"></div></section>`;
    $('[data-k=pkback]', box).onclick = () => l.back();
    const live = (await helix('streams', { user_id: c.id }).catch(() => ({ data: [] }))).data;
    if (live.length) { await withAvatars(live).catch(() => { }); $('#pklive', box).appendChild(section('En direct', '', live, card)); }
    const grid = $('.grid', box);
    askHistory(c.login, 'archive');
    await pager(ctx, grid, async after => { const r = await helix('videos', { user_id: c.id, type: 'archive', first: 40, after }); return { items: r.data, cursor: r.pagination && r.pagination.cursor }; }, v => {
      const vc = videoCard(v, { profile_image_url: c.avatar });
      const src = { video: v.id, channel: v.user_login, id: v.user_id, name: v.user_name, avatar: c.avatar, title: v.title };
      if (multi.some(m => m.video === v.id)) vc.classList.add('added'); else vc.onclick = () => pick(src, vc);
      vc._ctx = null;
      return vc;
    });
    if (layers[layers.length - 1] === l) setFocus($('.card:not(.added)', box) || $('[data-k=pkback]', box));
  };
  const fill = async () => {
    await refreshPins();
    let cur = [];
    if (suggest && suggest.channel && !multi.some(m => m.channel === suggest.channel)) {
      cur = (await helix('streams', { user_login: suggest.channel }).catch(() => ({ data: [] }))).data;
    }
    const pinned = pins.map(p => pinLive[p.id]).filter(Boolean);
    const [fol, top] = await Promise.all([followedLive().catch(() => []), topStreams({ first: 20 }).then(r => r.data).catch(() => [])]);
    await withAvatars([...cur, ...pinned, ...fol, ...top]).catch(() => { });
    box.innerHTML = '';
    const not = s => !cur.some(c => c.user_id === s.user_id);
    if (cur.length) box.appendChild(section('Stream que tu regardais', '', cur, card));
    if (pinned.filter(not).length) box.appendChild(section('Épinglés en direct', '', pinned.filter(not), card));
    if (fol.filter(not).length) box.appendChild(section('Suivis en direct', '', fol.filter(not), card));
    box.appendChild(section('Populaires', langName(cfg.lang), top.filter(not), card));
    // Channels, live or not, to pick a VOD from.
    const chans = [];
    pinsSorted().forEach(p => chans.push({ id: p.id, login: p.login, name: p.name, avatar: p.avatar, live: !!pinLive[p.id], sub: pinLive[p.id] ? 'En direct · rediffusions' : 'Rediffusions' }));
    if (auth) {
      try {
        const f = (await helix('channels/followed', { user_id: auth.userId, first: 60 })).data.filter(x => !chans.some(c => c.id === x.broadcaster_id));
        const u = await users({ ids: f.map(x => x.broadcaster_id) });
        f.forEach(x => { const uu = u.byId(x.broadcaster_id) || {}; chans.push({ id: x.broadcaster_id, login: x.broadcaster_login, name: x.broadcaster_name, avatar: uu.profile_image_url, live: false, sub: 'Rediffusions' }); });
      } catch (e) { }
    }
    if (inChannel) return;
    if (chans.length) box.appendChild(section('Chaînes · choisir une rediffusion', '', chans, chanTile));
    if (layers[layers.length - 1] === l && (!document.activeElement || !l.el.contains(document.activeElement))) setFocus($('.card:not(.added)', box) || $('.field', l.el));
  };
  let t = null;
  const search = async () => {
    const q = inp.value.trim(); if (!q) return fill();
    inChannel = false;
    const r = await helix('search/channels', { query: q, first: 30 });
    const ids = r.data.filter(c => c.is_live).map(c => c.id);
    const st = ids.length ? (await helix('streams', { user_id: ids, first: 100 })).data : [];
    await withAvatars(st).catch(() => { });
    box.innerHTML = '';
    if (st.length) box.appendChild(section('En direct', '', st, card));
    if (r.data.length) box.appendChild(section('Chaînes · choisir une rediffusion', '', r.data.map(c => ({ id: c.id, login: c.broadcaster_login, name: c.display_name, avatar: c.thumbnail_url, live: c.is_live, sub: c.is_live ? 'En direct · rediffusions' : 'Rediffusions' })), chanTile));
    if (!box.children.length) box.appendChild(h('<p class="empty">Aucune chaîne trouvée.</p>'));
  };
  inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(search, 500); });
  inp._submit = () => { clearTimeout(t); search().then(() => { inp.blur(); const c = $('.card', box); if (c) setFocus(c); }); };
  fill().catch(e => { box.innerHTML = `<p class="empty">${esc(e.message)}</p>`; });
}

// ======================================================================= app lifecycle (called by Android)
const app = window.app = {
  back() {
    const ae = document.activeElement;
    if (ae && ae._adj) { ae.adjust(false); return true; }
    const top = layers[layers.length - 1];
    if (top) { if (top.back && top.back()) return true; top.close(); return true; }
    const a = document.activeElement;
    if (a && a.closest && a.closest('#side') && stack.length <= 1 && stack[0] && stack[0].name !== 'home') { go('home', {}, { root: true }); return true; }
    if (stack.length > 1) { stack.pop(); render(true); return true; }
    if (stack[0] && stack[0].name !== 'home') { go('home', {}, { root: true }); return true; }
    if (a && a.closest && a.closest('#main')) { const n = $('#side .nv.cur') || $('#side .nv'); setFocus(n); return true; }
    return false;
  },
  key(k) { key(k); },
  followDone(login, ok, following) {
    const n = followNames[login.toLowerCase()] || login;
    toast(!ok ? 'Twitch n\'a pas répondu, réessaie' : following ? 'Tu suis ' + n + ' ✓' : 'Tu ne suis plus ' + n);
  },
  /** OK on a card, timed by Android: long → options, short → normal OK. */
  ok(long) {
    const cur = document.activeElement;
    if (long && cur && cur._ctx) return cardMenu(cur._ctx);
    key('ok');
  },
  autoPip() {
    if (!cfg.autoPip || !playerLayer || playerLayer.kind !== 'player') return;
    const p = playerLayer.player(); const s = playerLayer.src;
    toPip({ ...s, time: s.video && p ? p.getCurrentTime() : 0 }, playerLayer.vol, playerLayer.muted, false);
  },
  onResume() {
    pipState = HAS_NATIVE ? JSON.parse(Native.pipState()) : null; trackPip(pipState);
    renderSide();
    if (ready()) refreshPins();
    if (app._stoppedMulti && multi.length) { app._stoppedMulti = false; openMulti(); }
  },
  onStop() {
    // Leaving the app stops every in-app player (the PiP window lives in its own service).
    if (playerLayer) closePlayer();
    if (multiLayer) { app._stoppedMulti = true; multiLayer.close(); }
    StreamPlus.emit('app-stop');  // plugins free what they keep loaded in the background
  },
  openExternal(json) {
    let s; try { s = typeof json === 'string' ? JSON.parse(json) : json; } catch (e) { return; }
    pipState = null; renderSide();
    if (s && s.page === 'multi') { closePlayer(); openMulti(); return; }
    if (s && s.page && VIEWS[s.page]) { while (layers.length) layers[layers.length - 1].close(); go(s.page, s.page === 'channel' ? { login: s.login, tab: s.tab } : {}, { root: s.page !== 'channel' }); return; }
    if (s && (s.channel || s.video)) play(s);
  },
};

// ======================================================================= boot
(async function boot() {
  if (HAS_NATIVE) Native.setLowLatency(cfg.lowLat !== false);
  await loadFileConfig();
  syncProfile();
  pipState = HAS_NATIVE ? JSON.parse(Native.pipState()) : null;
  $('#side').dataset.zone = ''; $('#main').dataset.zone = '';
  renderSide();
  await go('home', {}, { root: true });
  setInterval(() => { if (!document.hidden && ready()) refreshPins(); }, 60000);
  StreamPlus.sticky('ready', { login: (pins[0] && pins[0].login) || (auth && auth.login) || null });
})();
