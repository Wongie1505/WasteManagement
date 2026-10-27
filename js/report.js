/* ===== Config ===== */
const COOLDOWN_MS = 3 * 60 * 1000;    // lock after a report, stops double taps
const CORRECTION_MS = 10 * 1000;      // window to fix a wrong tap
const MAX_SIDE = 1000;                // longest photo side in px
const MAX_BYTES = 450 * 1024;         // stays under the 500 KB bucket limit
const QUEUE_KEY = 'queue';
const BUCKET = 'report-photos';

const HEADERS = {
  apikey: KEY,
  Authorization: 'Bearer ' + KEY,
  'Content-Type': 'application/json'
};

const LABELS = {
  full: 'Full',
  fine: 'Still fine'
};

/* ===== State ===== */
let binId = new URLSearchParams(location.search).get('bin');
let bins = [];
let busy = false;
let uploading = false;
let countdownTimer;

/* ===== Small helpers ===== */
const $ = id => document.getElementById(id);
const lastKey = () => 'last:' + binId;

// Show one of the three main screens, or none when name is null
function show(name) {
  ['choose', 'done', 'bad'].forEach(id => {
    $(id).hidden = id !== name;
  });
}

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: carry on without it
  }
}

/* ===== Sending reports ===== */

// Returns the saved row, or null if the server rejected it.
// Throws on network trouble so the caller can queue the report.
async function postReport(report) {
  const response = await fetch(SB + '/rest/v1/reports', {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'return=representation' },
    body: JSON.stringify(report)
  });

  if (response.ok) {
    const rows = await response.json();
    return rows[0] || null;
  }

  // 4xx means retrying will not help, so drop it
  if (response.status >= 400 && response.status < 500) {
    return null;
  }

  throw new Error(response.status);
}

// Send anything saved while offline, oldest first
async function flushQueue() {
  const queue = load(QUEUE_KEY, []);

  while (queue.length) {
    try {
      await postReport(queue[0]);
      queue.shift();
      save(QUEUE_KEY, queue);
    } catch {
      return; // still offline, try again later
    }
  }
}

async function submit(status) {
  if (busy || !binId) return;
  busy = true;

  const report = {
    bin_id: binId,
    status: status,
    created_at: new Date().toISOString()
  };

  let reportId = null;
  let queued = false;

  try {
    const row = await postReport(report);
    reportId = row ? row.id : null;
  } catch {
    save(QUEUE_KEY, [...load(QUEUE_KEY, []), report]);
    queued = true;
  }

  save(lastKey(), {
    status: status,
    t: Date.now(),
    queued: queued,
    reportId: reportId,
    photoAdded: false
  });

  busy = false;
  render();
}

/* ===== Success screen ===== */
function render() {
  clearInterval(countdownTimer);

  // A stale timer can fire after the user has left the bin
  if (!binId) return;

  const last = load(lastKey(), null);
  const age = last ? Date.now() - last.t : Infinity;

  // Cooldown over, or nothing sent yet: back to the buttons
  if (age >= COOLDOWN_MS) {
    return show('choose');
  }

  const other = last.status === 'full' ? 'fine' : 'full';
  const time = new Date(last.t).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  $('doneTitle').textContent = last.queued ? 'Saved. Will send when online' : 'Sent';
  $('doneText').textContent = LABELS[last.status] + ' at ' + time;
  $('undo').onclick = () => submit(other);

  renderPhotoBox(last);
  startCountdown(last, other);
  show('done');

  // Come back when the correction window ends, then when the cooldown ends
  const wait = age < CORRECTION_MS ? CORRECTION_MS - age : COOLDOWN_MS - age;
  setTimeout(render, wait + 50);
}

// "Wrong button?" link with a live seconds counter
function startCountdown(last, other) {
  const paint = () => {
    const seconds = Math.ceil((CORRECTION_MS - (Date.now() - last.t)) / 1000);

    $('undo').hidden = seconds <= 0;

    if (seconds > 0) {
      $('undo').textContent = `Wrong button? Send "${LABELS[other]}" instead (${seconds}s)`;
    } else {
      clearInterval(countdownTimer);
    }
  };

  paint();

  if (Date.now() - last.t < CORRECTION_MS) {
    countdownTimer = setInterval(paint, 250);
  }
}

function renderPhotoBox(last) {
  // Photos only attach to reports that reached the server
  $('photoBox').hidden = !last.reportId;
  $('photoBtn').hidden = Boolean(last.photoAdded);

  // Do not wipe the "Uploading..." text if a timer re-renders mid-upload
  if (!uploading) {
    $('photoBtn').disabled = false;
    $('photoMsg').textContent = last.photoAdded ? 'Photo added. Thank you.' : '';
  }
}

/* ===== Photo ===== */

// Shrink the photo on the phone so it uploads fast on weak data
async function compressImage(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  // Lower the quality until it fits under the size limit
  for (const quality of [0.7, 0.5, 0.35]) {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));

    if (blob && blob.size <= MAX_BYTES) {
      return blob;
    }
  }

  throw new Error('Photo too large');
}

async function uploadPhoto(reportId, file) {
  const blob = await compressImage(file);

  // Random name, so photo links cannot be guessed
  const path = crypto.randomUUID() + '.jpg';

  const upload = await fetch(`${SB}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      apikey: KEY,
      Authorization: 'Bearer ' + KEY,
      'Content-Type': 'image/jpeg'
    },
    body: blob
  });

  if (!upload.ok) throw new Error('Upload failed');

  // Link the photo to its report
  const link = await fetch(SB + '/rest/v1/report_photos', {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ report_id: reportId, path: path })
  });

  if (!link.ok) throw new Error('Link failed');
}

async function handlePhoto(file) {
  const key = lastKey(); // the bin may change while the upload runs
  const last = load(key, null);

  if (!file || !last || !last.reportId) return;

  uploading = true;
  $('photoBtn').disabled = true;
  $('photoMsg').textContent = 'Uploading...';

  try {
    await uploadPhoto(last.reportId, file);
    last.photoAdded = true;
    save(key, last);
    uploading = false;
    render();
  } catch {
    uploading = false;
    render();
    $('photoMsg').textContent = 'Photo failed. Check your connection and try again.';
  }
}

/* ===== Bin list and search ===== */
async function loadBins() {
  try {
    const response = await fetch(SB + '/rest/v1/bins?select=id,name&order=name', {
      headers: HEADERS
    });

    if (!response.ok) throw new Error(response.status);

    const rows = await response.json();
    save('bins', rows);
    return rows;
  } catch {
    return load('bins', []); // offline: use the last list we saw
  }
}

// Match typed text to a bin by ID or by name, ignoring case
function findBin(text) {
  const query = (text || '').trim().toLowerCase();

  if (!query) return null;

  return bins.find(bin =>
    bin.id.toLowerCase() === query || bin.name.toLowerCase() === query
  ) || null;
}

function fillSuggestions() {
  const list = $('binList');
  list.replaceChildren();

  bins.forEach(bin => {
    const option = document.createElement('option');
    option.value = bin.name;  // what gets filled in when picked
    option.label = bin.id;    // shown beside it as a hint
    list.append(option);
  });

  const current = bins.find(bin => bin.id === binId);
  $('binSearch').value = current ? current.name : '';
  $('pick').hidden = bins.length === 0;
}

function showBin() {
  const bin = bins.find(item => item.id === binId);

  if (!binId) {
    $('name').textContent = 'Select a bin';
    return show(null);
  }

  if (bins.length && !bin) {
    $('name').textContent = 'Select a bin';
    return show('bad');
  }

  // With no bin list at all (offline, first visit) the URL is trusted
  $('name').textContent = bin ? bin.name : binId;
  render();
}

// Keep the address bar in step with the chosen bin
function updateUrl() {
  const url = new URL(location.href);

  if (binId) {
    url.searchParams.set('bin', binId);
  } else {
    url.searchParams.delete('bin');
  }

  history.replaceState(null, '', url);
}

// Back to the start so another bin can be reported
function goBack() {
  // No bin list (offline, first visit): nothing to search, so leave the page
  if (!bins.length) {
    location.href = 'index.html';
    return;
  }

  binId = null;
  $('binSearch').value = '';
  $('pickHint').hidden = true;

  updateUrl();
  showBin();
}

/* ===== Events ===== */
$('binSearch').addEventListener('input', event => {
  const text = event.target.value;
  const bin = findBin(text);

  binId = bin ? bin.id : null;
  $('pickHint').hidden = Boolean(bin) || !text.trim();

  updateUrl();
  showBin();
});

$('full').addEventListener('click', () => submit('full'));
$('fine').addEventListener('click', () => submit('fine'));

$('backBtn').addEventListener('click', goBack);

$('photoBtn').addEventListener('click', () => $('photoInput').click());
$('photoInput').addEventListener('change', event => {
  handlePhoto(event.target.files[0]);
  event.target.value = ''; // lets the same photo be picked again
});

addEventListener('online', flushQueue);

/* ===== Start ===== */
async function init() {
  bins = await loadBins();

  // Accept ?bin=must-01 and fix the casing to the real ID
  const match = findBin(binId);
  if (match) binId = match.id;

  fillSuggestions();
  showBin();
  flushQueue();
}

init();