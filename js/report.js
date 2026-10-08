const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

let binId = new URLSearchParams(location.search).get('bin');
let bins = [];
const $ = id => document.getElementById(id);
const COOLDOWN = 3 * 60e3, UNDO = 10e3;
const QKEY = 'queue';
const lkey = () => 'last:' + binId;
const label = { full: 'Full', fine: 'Still fine' };
let busy = false, tick;

const show = name => ['choose', 'done', 'bad'].forEach(s => $(s).hidden = s !== name);
const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } };
const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} };

async function post(r) {
  const res = await fetch(SB + '/rest/v1/reports', { method: 'POST', headers: H, body: JSON.stringify(r) });
  if (res.ok || (res.status >= 400 && res.status < 500)) return; // 4xx: retrying won't help, drop it
  throw new Error(res.status);
}

async function flush() {
  const q = get(QKEY, []);
  while (q.length) {
    try { await post(q[0]); q.shift(); set(QKEY, q); } catch { return; }
  }
}

async function submit(status) {
  if (busy || !binId) return;
  busy = true;
  const r = { bin_id: binId, status, created_at: new Date().toISOString() };
  let queued = false;
  try { await post(r); } catch { set(QKEY, [...get(QKEY, []), r]); queued = true; }
  set(lkey(), { status, t: Date.now(), queued });
  busy = false;
  render();
}

function render() {
  clearInterval(tick);
  const last = get(lkey(), null);
  const age = last ? Date.now() - last.t : Infinity;
  if (age >= COOLDOWN) return show('choose');
  const other = last.status === 'full' ? 'fine' : 'full';
  $('doneTitle').textContent = last.queued ? 'Saved. Will send when online' : 'Sent';
  $('doneText').textContent = label[last.status] + ' at ' +
    new Date(last.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  $('undo').onclick = () => submit(other);
  const paint = () => {
    const s = Math.ceil((UNDO - (Date.now() - last.t)) / 1000);
    $('undo').hidden = s <= 0;
    if (s > 0) $('undo').textContent = 'Wrong button? Send "' + label[other] + '" instead (' + s + 's)';
    else clearInterval(tick);
  };
  paint();
  if (age < UNDO) tick = setInterval(paint, 250);
  show('done');
  setTimeout(render, (age < UNDO ? UNDO - age : COOLDOWN - age) + 50);
}

async function loadBins() {
  try {
    const res = await fetch(SB + '/rest/v1/bins?select=id,name&order=name', { headers: H });
    if (!res.ok) throw 0;
    const rows = await res.json();
    set('bins', rows);
    return rows;
  } catch {
    return get('bins', []); // offline: use the last list we saw
  }
}

function fillPicker() {
  const sel = $('picker');
  sel.replaceChildren(new Option('Select a bin...', ''));
  bins.forEach(b => sel.add(new Option(b.name, b.id)));
  sel.value = binId || '';
  $('pick').hidden = !bins.length;
}

function showBin() {
  const bin = bins.find(b => b.id === binId);
  if (!binId) { $('name').textContent = 'Select a bin'; return show(); }
  if (bins.length && !bin) { $('name').textContent = 'Select a bin'; return show('bad'); }
  $('name').textContent = bin ? bin.name : binId; // no list at all (offline, first visit): trust the URL
  render();
}

$('picker').onchange = e => {
  binId = e.target.value || null;
  const u = new URL(location.href);
  binId ? u.searchParams.set('bin', binId) : u.searchParams.delete('bin');
  history.replaceState(null, '', u);
  showBin();
};

$('full').onclick = () => submit('full');
$('fine').onclick = () => submit('fine');
addEventListener('online', flush);

(async () => {
  bins = await loadBins();
  fillPicker();
  showBin();
  flush();
})();