const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const STALE = 12 * 3600e3;   // report older than this = unverified
const POLL = 30e3;           // refresh interval
const SLOW = 10e3;           // satellite tiles taking longer than this = weak network
const COLOR = { full: '#c62828', fine: '#15803d', stale: '#8a948f', none: '#8a948f' };
const $ = id => document.getElementById(id);

/* ---------- toasts ---------- */
function toast(text, kind = 'info') {
  const box = $('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = text;
  box.append(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => el.classList.add('out'), 4500);
  setTimeout(() => el.remove(), 5000);
}

/* ---------- map + basemaps ---------- */
const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19, maxNativeZoom: 18,
  attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics'
});
const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
});

const conn = navigator.connection;
const weakStart = conn && (conn.saveData || /2g/.test(conn.effectiveType || ''));

const map = L.map('map', { layers: [weakStart ? osm : sat] }).setView([-15.9026, 35.216], 15);
L.control.layers({ 'Satellite Imagery': sat, 'OpenStreetMap': osm }).addTo(map);
if (weakStart) toast('Weak connection. Using the street map.', 'info');

// Auto-switch to streets when satellite tiles fail or crawl. Stops once the user picks a layer themselves.
let userPicked = false, auto = false, errs = [], t0 = 0;

function toStreets(msg) {
  if (userPicked || !map.hasLayer(sat)) return;
  auto = true;
  map.removeLayer(sat);
  map.addLayer(osm);
  auto = false;
  toast(msg, 'info');
}

map.on('baselayerchange', () => { if (!auto) { userPicked = true; errs = []; } });
sat.on('tileerror', () => {
  const now = Date.now();
  errs = errs.filter(t => now - t < 10e3);
  errs.push(now);
  if (errs.length >= 4) toStreets('Weak connection. Switched to the street map.');
});
sat.on('loading', () => { t0 = Date.now(); });
sat.on('load', () => { if (t0 && Date.now() - t0 > SLOW) toStreets('Slow connection. Switched to the street map.'); });

/* ---------- pins ---------- */
const pin = c => L.divIcon({
  className: 'pin', iconSize: [34, 46], iconAnchor: [17, 46], popupAnchor: [0, -42],
  html: `<svg viewBox="0 0 28 38" width="34" height="46"><path d="M14 1C6.8 1 1 6.8 1 13.9 1 23.5 14 37 14 37s13-13.5 13-23.1C27 6.8 21.2 1 14 1z" fill="${c}" stroke="#fff" stroke-width="2"/><circle cx="14" cy="14" r="5" fill="#fff"/></svg>`
});
const ICON = Object.fromEntries(Object.entries(COLOR).map(([k, c]) => [k, pin(c)]));

/* ---------- data ---------- */
const markers = {};
const prev = {};            // bin id -> last seen status, for change toasts
let bins = [], first = true, loaded = false;

const state = b => !b.status ? 'none'
  : Date.now() - new Date(b.reported_at) > STALE ? 'stale' : b.status;

function ago(t) {
  const m = Math.round((Date.now() - new Date(t)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + ' min ago';
  const h = Math.floor(m / 60);
  return h < 24 ? h + 'h ago' : Math.floor(h / 24) + 'd ago';
}

const names = { full: 'Full', fine: 'Still fine' };
function describe(b) {
  const s = state(b);
  if (s === 'none') return 'No reports yet';
  if (s === 'stale') return 'Unverified. Last report: ' + names[b.status] + ', ' + ago(b.reported_at);
  return names[s] + ', ' + ago(b.reported_at);
}

function popup(b) {
  const el = document.createElement('div');
  el.className = 'pop';
  const t = document.createElement('strong'); t.textContent = b.name;
  const d = document.createElement('span'); d.textContent = describe(b);
  el.append(t, d);
  return el;
}

function draw() {
  const rank = { full: 0, stale: 1, none: 2, fine: 3 };
  const sorted = [...bins].sort((a, b) =>
    rank[state(a)] - rank[state(b)] || new Date(a.reported_at || 0) - new Date(b.reported_at || 0));

  const n = { full: 0, fine: 0, stale: 0 };
  const list = $('list');
  list.replaceChildren();
  if (!bins.length) list.innerHTML = '<p class="empty">No bins found.</p>';

  sorted.forEach(b => {
    const s = state(b);
    n[s === 'full' || s === 'fine' ? s : 'stale']++;

    let m = markers[b.id];
    if (!m) m = markers[b.id] = L.marker([b.lat, b.lng], { icon: ICON[s], title: b.name }).addTo(map);
    if (m._s !== s) { m.setIcon(ICON[s]); m._s = s; }
    m.bindPopup(popup(b));

    const row = document.createElement('button');
    row.className = 'row';
    const dot = document.createElement('i');
    dot.className = 'dot ' + (s === 'full' || s === 'fine' ? s : '');
    const txt = document.createElement('span');
    const nm = document.createElement('strong'); nm.textContent = b.name;
    const sm = document.createElement('small'); sm.textContent = describe(b);
    txt.append(nm, sm);
    row.append(dot, txt);
    row.onclick = () => { map.flyTo([b.lat, b.lng], 17); m.openPopup(); };
    list.append(row);
  });

  $('nFull').textContent = n.full;
  $('nFine').textContent = n.fine;
  $('nStale').textContent = n.stale;
  $('updated').textContent = 'Updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (first && bins.length) {
    map.fitBounds(bins.map(b => [b.lat, b.lng]), { padding: [60, 60], maxZoom: 17 });
    first = false;
  }
}

async function refresh() {
  try {
    const res = await fetch(SB + '/rest/v1/bin_status?select=*', { headers: H });
    if (!res.ok) throw 0;
    bins = await res.json();
    $('err').hidden = true;
  } catch {
    $('err').hidden = false;
    return;
  }
  bins.forEach(b => {
    if (loaded && b.status && prev[b.id] !== b.status) toast(b.name + ' reported ' + names[b.status], b.status);
    prev[b.id] = b.status;
  });
  loaded = true;
  draw();
}

refresh();
setInterval(refresh, POLL);