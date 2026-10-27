/* ===== Config ===== */
const POLL_MS = 30 * 1000;       // how often to look for a new route
const CONFIRM_MS = 4 * 1000;     // second tap must come within this
const GPS_TIMEOUT_MS = 4 * 1000; // never hold the driver up waiting for GPS
const QUEUE_KEY = 'queue';       // same offline queue the report page uses
const ROUTE_KEY = 'route';       // last route seen, for working offline

const OFFLINE_TEXT = 'No connection. Showing the saved route. Collections will send when you are back online.';

const HEADERS = {
  apikey: KEY,
  Authorization: 'Bearer ' + KEY,
  'Content-Type': 'application/json'
};

/* ===== State ===== */
let route = null;          // latest published route
let done = new Set();      // bin IDs already collected on this route
let confirmingId = null;   // bin whose Collected button is armed
let confirmTimer;
let busy = false;

/* ===== Small helpers ===== */
const $ = id => document.getElementById(id);
const doneKey = routeRow => 'done:' + routeRow.id;

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

function showBanner(text) {
  $('err').textContent = text;
  $('err').hidden = !text;
}

/* ===== Network ===== */

// Throws on any failure. error.rejected = true means the server said no (4xx).
async function postReport(report) {
  const response = await fetch(SB + '/rest/v1/reports', {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(report)
  });

  if (response.ok) return;

  const error = new Error('HTTP ' + response.status);
  error.rejected = response.status >= 400 && response.status < 500;
  throw error;
}

// Send anything saved while offline, oldest first
async function flushQueue() {
  const queue = load(QUEUE_KEY, []);

  while (queue.length) {
    try {
      await postReport(queue[0]);
    } catch (error) {
      if (!error.rejected) return; // still offline, try again later
    }

    queue.shift();
    save(QUEUE_KEY, queue);
  }
}

async function fetchLatestRoute() {
  const url = SB + '/rest/v1/routes?select=id,stops,km,created_at&order=created_at.desc&limit=1';
  const response = await fetch(url, { headers: HEADERS });

  if (!response.ok) throw new Error(response.status);

  const rows = await response.json();
  return rows[0] || null;
}

// Bins collected since this route was published
async function fetchCollected(routeRow) {
  const since = encodeURIComponent(routeRow.created_at);
  const url = `${SB}/rest/v1/reports?select=bin_id&status=eq.collected&created_at=gte.${since}`;
  const response = await fetch(url, { headers: HEADERS });

  if (!response.ok) throw new Error(response.status);

  const rows = await response.json();
  return rows.map(row => row.bin_id);
}

async function refresh() {
  try {
    const latest = await fetchLatestRoute();
    const fromServer = latest ? await fetchCollected(latest) : [];
    const fromPhone = latest ? load(doneKey(latest), []) : [];

    route = latest;
    done = new Set([...fromServer, ...fromPhone]);
    save(ROUTE_KEY, latest);

    showBanner('');
    flushQueue();
  } catch {
    // Offline: carry on with the last route we saw
    route = load(ROUTE_KEY, null);
    done = new Set(route ? load(doneKey(route), []) : []);
    showBanner(OFFLINE_TEXT);
  }

  render();
}

/* ===== GPS ===== */

// Position is a bonus: resolves to null if unavailable or too slow
function getPosition() {
  return new Promise(resolve => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: GPS_TIMEOUT_MS, maximumAge: 30000 }
    );
  });
}

/* ===== Collecting ===== */

// First bin on the route that is not collected yet
function nextBin() {
  const bins = route.stops.filter(stop => stop.type === 'bin');
  return bins.find(bin => !done.has(bin.id)) || null;
}

async function markCollected(bin) {
  busy = true;
  render();

  const position = await getPosition();

  const report = {
    bin_id: bin.id,
    status: 'collected',
    created_at: new Date().toISOString()
  };

  // Where the truck actually was, kept as evidence
  if (position) {
    report.lat = position.lat;
    report.lng = position.lng;
  }

  try {
    await postReport(report);
  } catch (error) {
    if (error.rejected) {
      // The server refused it, so do not pretend it worked
      showBanner('The server rejected this collection. Tell the admin.');
      busy = false;
      render();
      return;
    }

    // Offline: keep it and send later
    save(QUEUE_KEY, [...load(QUEUE_KEY, []), report]);
  }

  done.add(bin.id);
  save(doneKey(route), [...done]);

  busy = false;
  render();
}

// First tap arms the button, a second tap within 4 seconds sends it
function onCollectClick() {
  const bin = route && nextBin();

  if (!bin || busy) return;

  if (confirmingId !== bin.id) {
    confirmingId = bin.id;

    clearTimeout(confirmTimer);
    confirmTimer = setTimeout(() => {
      confirmingId = null;
      render();
    }, CONFIRM_MS);

    render();
    return;
  }

  clearTimeout(confirmTimer);
  confirmingId = null;
  markCollected(bin);
}

/* ===== Screen ===== */
const mapsLink = stop =>
  `https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}&travelmode=driving`;

function renderNextCard(bins, dump, upcoming) {
  const card = $('next');
  const index = upcoming ? bins.indexOf(upcoming) + 1 : 0;

  card.hidden = false;

  if (upcoming) {
    $('nextLabel').textContent = `Next stop, ${index} of ${bins.length}`;
    $('nextName').textContent = upcoming.name;
    $('nextMeta').textContent = 'Empty the bin, then tap Collected.';
    $('navBtn').href = mapsLink(upcoming);

    const armed = confirmingId === upcoming.id;
    $('collectBtn').hidden = false;
    $('collectBtn').disabled = busy;
    $('collectBtn').classList.toggle('armed', armed);
    $('collectBtn').textContent = busy ? 'Saving...' : armed ? 'Tap again to confirm' : 'Collected';
    return;
  }

  // Every bin is done: the dump site is the last stop
  $('collectBtn').hidden = true;

  if (dump) {
    $('nextLabel').textContent = 'All bins collected';
    $('nextName').textContent = dump.name;
    $('nextMeta').textContent = 'Head to the dump site to unload.';
    $('navBtn').href = mapsLink(dump);
  } else {
    card.hidden = true;
  }
}

function renderStopList(upcoming) {
  const list = $('stops');
  list.replaceChildren();

  let binNumber = 0;

  route.stops.forEach((stop, position) => {
    const item = document.createElement('li');
    const num = document.createElement('span');
    const name = document.createElement('span');

    num.className = 'num';
    name.textContent = stop.name;

    if (stop.type === 'depot') {
      num.textContent = 'S';
    } else if (stop.type === 'dump') {
      num.textContent = 'E';
    } else {
      binNumber++;
      num.textContent = done.has(stop.id) ? '\u2713' : binNumber;
      item.classList.toggle('done', done.has(stop.id));
      item.classList.toggle('current', upcoming && upcoming.id === stop.id);
    }

    item.append(num, name);
    list.append(item);
  });
}

function render() {
  const hasRoute = Boolean(route && route.stops && route.stops.length);

  $('empty').hidden = hasRoute;
  $('progress').hidden = !hasRoute;
  $('title').textContent = 'Collections';

  if (!hasRoute) {
    $('next').hidden = true;
    $('stops').replaceChildren();
    $('sub').textContent = '';
    return;
  }

  const bins = route.stops.filter(stop => stop.type === 'bin');
  const dump = route.stops.find(stop => stop.type === 'dump');
  const upcoming = nextBin();
  const doneCount = bins.filter(bin => done.has(bin.id)).length;

  const published = new Date(route.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  $('sub').textContent = `${doneCount} of ${bins.length} collected. Published ${published}.`;
  $('bar').style.width = (bins.length ? doneCount / bins.length * 100 : 0) + '%';

  renderNextCard(bins, dump, upcoming);
  renderStopList(upcoming);
}

/* ===== Start ===== */
$('collectBtn').addEventListener('click', onCollectClick);
addEventListener('online', flushQueue);

getPosition();   // asks for location permission early, so the first collection is not delayed
refresh();
setInterval(refresh, POLL_MS);