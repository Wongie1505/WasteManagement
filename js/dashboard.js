/* ===== Config ===== */
const HEADERS = {
  apikey: KEY,
  Authorization: 'Bearer ' + KEY
};

const STALE_MS = 12 * 60 * 60 * 1000;   // report older than this = unverified
const POLL_MS = 30 * 1000;              // data refresh interval
const SLOW_MS = 10 * 1000;              // satellite tiles slower than this = weak network

// PLACEHOLDERS near MUST. Replace with the real depot and dump site.
const DEPOT = { name: 'Depot', lat: -15.9030, lng: 35.2140 };
const DUMP = { name: 'Dump site', lat: -15.9100, lng: 35.2230 };

const FUEL_L_PER_100KM = 35;            // assumption, set to the real truck
const GMAPS_MAX_STOPS = 9;              // Google Maps limit per link
const OSRM = 'https://router.project-osrm.org';

const COLOR = {
  full: '#c62828',
  fine: '#15803d',
  stale: '#8a948f',
  none: '#8a948f'
};

const NAMES = {
  full: 'Full',
  fine: 'Still fine',
  collected: 'Collected'
};

const $ = id => document.getElementById(id);

/* ===== Toasts ===== */
function toast(text, kind = 'info') {
  const box = $('toasts');
  const el = document.createElement('div');

  el.className = 'toast ' + kind;
  el.textContent = text;
  box.append(el);

  // Keep at most three on screen
  while (box.children.length > 3) {
    box.firstChild.remove();
  }

  setTimeout(() => el.classList.add('out'), 4500);
  setTimeout(() => el.remove(), 5000);
}

/* ===== Map and basemaps ===== */
const satellite = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  {
    maxZoom: 19,
    maxNativeZoom: 18,
    attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics'
  }
);

const streets = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
});

// Start on streets when the browser reports a weak or data-saving connection
const connection = navigator.connection;
const weakStart = connection && (connection.saveData || /2g/.test(connection.effectiveType || ''));

const map = L.map('map', { layers: [weakStart ? streets : satellite] })
  .setView([-15.9026, 35.216], 15);

L.control.layers(
  { Satellite: satellite, Streets: streets },
  null,
  { position: 'topleft' }   // keeps it clear of the detail panel
).addTo(map);

if (weakStart) {
  toast('Weak connection. Using the street map.', 'info');
}

// Switch to streets when satellite tiles fail or crawl.
// Stops once the user picks a layer themselves.
let userPicked = false;
let autoSwitching = false;
let tileErrors = [];
let loadStarted = 0;

function switchToStreets(message) {
  if (userPicked || !map.hasLayer(satellite)) return;

  autoSwitching = true;
  map.removeLayer(satellite);
  map.addLayer(streets);
  autoSwitching = false;

  toast(message, 'info');
}

map.on('baselayerchange', () => {
  if (!autoSwitching) {
    userPicked = true;
    tileErrors = [];
  }
});

satellite.on('tileerror', () => {
  const now = Date.now();

  tileErrors = tileErrors.filter(time => now - time < 10000);
  tileErrors.push(now);

  if (tileErrors.length >= 4) {
    switchToStreets('Weak connection. Switched to the street map.');
  }
});

satellite.on('loading', () => {
  loadStarted = Date.now();
});

satellite.on('load', () => {
  if (loadStarted && Date.now() - loadStarted > SLOW_MS) {
    switchToStreets('Slow connection. Switched to the street map.');
  }
});

/* ===== Pins ===== */
function makePin(color) {
  return L.divIcon({
    className: 'pin',
    iconSize: [34, 46],
    iconAnchor: [17, 46],
    popupAnchor: [0, -42],
    html: `<svg viewBox="0 0 28 38" width="34" height="46">
      <path d="M14 1C6.8 1 1 6.8 1 13.9 1 23.5 14 37 14 37s13-13.5 13-23.1C27 6.8 21.2 1 14 1z"
            fill="${color}" stroke="#fff" stroke-width="2"/>
      <circle cx="14" cy="14" r="5" fill="#fff"/>
    </svg>`
  });
}

const ICON = Object.fromEntries(
  Object.entries(COLOR).map(([key, color]) => [key, makePin(color)])
);

/* ===== Data ===== */
const markers = {};
const lastStatus = {};     // bin id -> last seen status, for change toasts
let bins = [];
let firstFit = true;
let loaded = false;

// full, fine, stale (older than 12 h) or none (never reported)
function stateOf(bin) {
  if (!bin.status) return 'none';
  if (Date.now() - new Date(bin.reported_at) > STALE_MS) return 'stale';

  // A collected bin has just been emptied, so it counts as fine
  return bin.status === 'collected' ? 'fine' : bin.status;
}

function timeAgo(time) {
  const minutes = Math.round((Date.now() - new Date(time)) / 60000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return minutes + ' min ago';

  const hours = Math.floor(minutes / 60);
  return hours < 24 ? hours + 'h ago' : Math.floor(hours / 24) + 'd ago';
}

function describe(bin) {
  const state = stateOf(bin);

  if (state === 'none') return 'No reports yet';

  if (state === 'stale') {
    return 'Unverified. Last report: ' + NAMES[bin.status] + ', ' + timeAgo(bin.reported_at);
  }

  return NAMES[bin.status] + ', ' + timeAgo(bin.reported_at);
}

// Most urgent first: full, then unverified, then no data, then fine
function sortByUrgency(list) {
  const rank = { full: 0, stale: 1, none: 2, fine: 3 };

  return [...list].sort((a, b) =>
    rank[stateOf(a)] - rank[stateOf(b)] ||
    new Date(a.reported_at || 0) - new Date(b.reported_at || 0)
  );
}

function buildRow(bin) {
  const state = stateOf(bin);

  const row = document.createElement('button');
  row.className = 'row';

  const dot = document.createElement('i');
  dot.className = 'dot ' + (state === 'full' || state === 'fine' ? state : '');

  const name = document.createElement('strong');
  name.textContent = bin.name;

  const detail = document.createElement('small');
  detail.textContent = describe(bin);

  const text = document.createElement('span');
  text.append(name, detail);

  row.append(dot, text);

  row.onclick = () => {
    map.flyTo([bin.lat, bin.lng], 17);
    openPanel(bin.id);
  };

  return row;
}

function draw() {
  const counts = { full: 0, fine: 0, stale: 0 };
  const list = $('list');
  list.replaceChildren();

  if (!bins.length) {
    list.innerHTML = '<p class="empty">No bins found.</p>';
  }

  sortByUrgency(bins).forEach(bin => {
    const state = stateOf(bin);
    counts[state === 'full' || state === 'fine' ? state : 'stale']++;

    // One pin per bin, recoloured only when its state changes
    let marker = markers[bin.id];

    if (!marker) {
      marker = L.marker([bin.lat, bin.lng], { icon: ICON[state], title: bin.name }).addTo(map);
      markers[bin.id] = marker;

      marker.on('click', () => {
        openPanel(bin.id);
        keepPinVisible(bin.id);
      });
    }

    if (marker.state !== state) {
      marker.setIcon(ICON[state]);
      marker.state = state;
    }

    list.append(buildRow(bin));
  });

  $('nFull').textContent = counts.full;
  $('nFine').textContent = counts.fine;
  $('nStale').textContent = counts.stale;
  $('updated').textContent = 'Updated ' + new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  if (firstFit && bins.length) {
    map.fitBounds(bins.map(bin => [bin.lat, bin.lng]), { padding: [60, 60], maxZoom: 17 });
    firstFit = false;
  }

  // Keep an open panel in step with new data
  if (selectedId && findBin(selectedId)) {
    renderPanelSummary(findBin(selectedId));
    loadPanelHistory(selectedId);
  }

  updatePlanner();
}

async function refresh() {
  try {
    const response = await fetch(SB + '/rest/v1/bin_status?select=*', { headers: HEADERS });

    if (!response.ok) throw new Error(response.status);

    bins = await response.json();
    $('err').hidden = true;
  } catch {
    $('err').hidden = false;
    return;
  }

  // Toast when a bin's status changed since the last refresh (not on first load)
  bins.forEach(bin => {
    if (loaded && bin.status && lastStatus[bin.id] !== bin.status) {
      if (bin.status === 'collected') {
        toast(bin.name + ' was collected', 'fine');
      } else {
        toast(bin.name + ' reported ' + NAMES[bin.status], bin.status);
      }
    }

    lastStatus[bin.id] = bin.status;
  });

  loaded = true;
  draw();
}

/* ===== Bin detail panel ===== */
const GPS_OK_M = 100;   // collection GPS farther than this from the bin gets flagged
let selectedId = null;

const findBin = id => bins.find(bin => bin.id === id);
const photoUrl = path => `${SB}/storage/v1/object/public/report-photos/${path}`;

function formatWhen(time) {
  return new Date(time).toLocaleString([], {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function stateLabel(bin) {
  const state = stateOf(bin);

  if (state === 'none') return 'No reports yet';
  if (state === 'stale') return 'Unverified';

  return NAMES[bin.status];
}

// Straight-line distance in metres between two GPS points
function distanceMeters(lat1, lng1, lat2, lng2) {
  const radius = 6371000;
  const toRad = degrees => degrees * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return 2 * radius * Math.asin(Math.sqrt(a));
}

async function getJson(url) {
  const response = await fetch(url, { headers: HEADERS });

  if (!response.ok) throw new Error(response.status);

  return response.json();
}

// Last 10 reports (with photos) and the most recent collection
async function fetchBinHistory(binId) {
  const base = SB + '/rest/v1/reports?bin_id=eq.' + encodeURIComponent(binId);

  const [recent, collected] = await Promise.all([
    getJson(base + '&select=id,status,created_at,lat,lng,report_photos(path)&order=created_at.desc&limit=10'),
    getJson(base + '&status=eq.collected&select=created_at&order=created_at.desc&limit=1')
  ]);

  return { recent: recent, lastCollected: collected[0] || null };
}

// A report has at most one photo; the API returns it as an object or a list
function photoOf(row) {
  const photo = Array.isArray(row.report_photos) ? row.report_photos[0] : row.report_photos;
  return photo ? photo.path : null;
}

// Part of the panel that comes straight from the map data
function renderPanelSummary(bin) {
  $('pName').textContent = bin.name;
  $('pId').textContent = bin.id;
  $('pCoords').textContent = bin.lat.toFixed(5) + ', ' + bin.lng.toFixed(5);

  $('pStatus').textContent = stateLabel(bin);
  $('pStatus').className = 'chip ' + stateOf(bin);

  $('pWhen').textContent = bin.status
    ? 'Reported ' + timeAgo(bin.reported_at) + ', ' + formatWhen(bin.reported_at)
    : 'Nobody has reported this bin yet.';
}

function buildHistoryItem(bin, row) {
  const item = document.createElement('li');

  const dot = document.createElement('i');
  dot.className = 'dot ' + (row.status === 'full' ? 'full' : 'fine');

  const info = document.createElement('div');
  info.className = 'info';

  const title = document.createElement('strong');
  title.textContent = NAMES[row.status];

  const when = document.createElement('small');
  when.textContent = formatWhen(row.created_at);

  info.append(title, when);

  // Collections carry the truck's GPS, so show how close it was to the bin
  if (row.status === 'collected' && row.lat !== null && row.lng !== null) {
    const meters = Math.round(distanceMeters(row.lat, row.lng, bin.lat, bin.lng));
    const close = meters <= GPS_OK_M;

    const gps = document.createElement('small');
    gps.textContent = `GPS check: ${meters} m from the bin` + (close ? '' : ' (far)');
    gps.className = close ? '' : 'far';

    info.append(gps);
  }

  item.append(dot, info);

  // Small photo, tap to enlarge
  const path = photoOf(row);

  if (path) {
    const button = document.createElement('button');
    button.className = 'thumb';
    button.onclick = () => openLightbox(photoUrl(path));

    const img = document.createElement('img');
    img.src = photoUrl(path);
    img.alt = 'Report photo';
    img.loading = 'lazy';

    button.append(img);
    item.append(button);
  }

  return item;
}

// Part of the panel that needs the extra query
function renderPanelHistory(bin, data) {
  $('pCollected').textContent = data.lastCollected
    ? formatWhen(data.lastCollected.created_at) + ' (' + timeAgo(data.lastCollected.created_at) + ')'
    : 'Not collected yet';

  // Newest photo among the recent reports
  const withPhoto = data.recent.find(row => photoOf(row));

  $('pPhotoBtn').hidden = !withPhoto;
  $('pPhotoCap').hidden = !withPhoto;

  if (withPhoto) {
    $('pPhoto').src = photoUrl(photoOf(withPhoto));
    $('pPhotoCap').textContent = 'Photo from the report ' + timeAgo(withPhoto.created_at);
  }

  const list = $('pHistory');
  list.replaceChildren();

  if (!data.recent.length) {
    list.textContent = 'No reports yet.';
    return;
  }

  data.recent.forEach(row => list.append(buildHistoryItem(bin, row)));
}

async function loadPanelHistory(binId) {
  try {
    const data = await fetchBinHistory(binId);

    // The user may have clicked another bin while this was loading
    if (selectedId !== binId) return;

    renderPanelHistory(findBin(binId), data);
  } catch {
    if (selectedId === binId) {
      $('pHistory').textContent = 'Could not load the history.';
    }
  }
}

function openPanel(binId) {
  const bin = findBin(binId);

  if (!bin) return;

  selectedId = binId;

  // Clear the previous bin's details while the new ones load
  $('pCollected').textContent = '...';
  $('pPhotoBtn').hidden = true;
  $('pPhotoCap').hidden = true;
  $('pHistory').textContent = 'Loading...';

  renderPanelSummary(bin);
  $('panel').hidden = false;

  loadPanelHistory(binId);
}

function closePanel() {
  selectedId = null;
  $('panel').hidden = true;
}

// On wide screens, nudge the map if the pin would sit under the panel
function keepPinVisible(binId) {
  const bin = findBin(binId);

  if (!bin || window.innerWidth <= 800) return;

  const point = map.latLngToContainerPoint([bin.lat, bin.lng]);
  const limit = map.getSize().x - 380;

  if (point.x > limit) {
    map.panBy([point.x - limit, 0]);
  }
}

function openLightbox(url) {
  $('lbImg').src = url;
  $('lightbox').hidden = false;
}

function closeLightbox() {
  $('lightbox').hidden = true;
  $('lbImg').src = '';
}

/* ===== Route planner ===== */
const routeLayer = L.layerGroup().addTo(map);
let todayBins = [];
let planning = false;
let currentRoute = null;   // last planned route, kept so it can be published

const asLngLat = point => point.lng + ',' + point.lat;

function plural(count) {
  return count + (count === 1 ? ' bin' : ' bins');
}

// Bins to collect today: full ones, plus unverified if the box is ticked
function updatePlanner() {
  if (planning) return;

  const includeStale = $('inclStale').checked;

  todayBins = bins.filter(bin => {
    const state = stateOf(bin);
    return state === 'full' || (includeStale && state === 'stale');
  });

  $('planBtn').disabled = todayBins.length === 0;
  $('planBtn').textContent = todayBins.length
    ? 'Plan route (' + plural(todayBins.length) + ')'
    : 'No bins need collecting';
}

function setPlanning(flag) {
  planning = flag;
  $('planBtn').disabled = flag;

  if (flag) {
    $('planBtn').textContent = 'Planning...';
  } else {
    updatePlanner();
  }
}

function showPlanMessage(text) {
  $('planMsg').textContent = text;
  $('planMsg').hidden = false;
}

// Best order and road geometry: depot first, dump site last
async function fetchBestTrip(stops) {
  const coords = stops.map(asLngLat).join(';');
  const url = `${OSRM}/trip/v1/driving/${coords}`
    + '?source=first&destination=last&roundtrip=false&overview=full&geometries=geojson';

  const data = await (await fetch(url)).json();

  if (data.code !== 'Ok') throw new Error(data.code);

  return data;
}

// Road distance (metres) when the stops are visited in the order given
async function fetchFixedDistance(stops) {
  const coords = stops.map(asLngLat).join(';');
  const url = `${OSRM}/route/v1/driving/${coords}?overview=false`;

  const data = await (await fetch(url)).json();

  if (data.code !== 'Ok') throw new Error(data.code);

  return data.routes[0].distance;
}

async function planRoute() {
  const stops = [DEPOT, ...todayBins, DUMP];

  // Baseline: a fixed round through every bin, in ID order
  const fixedRound = [DEPOT, ...[...bins].sort((a, b) => a.id.localeCompare(b.id)), DUMP];

  $('planMsg').hidden = true;
  setPlanning(true);

  try {
    const [data, fixedMeters] = await Promise.all([
      fetchBestTrip(stops),
      fetchFixedDistance(fixedRound)
    ]);

    // waypoint_index is each input stop's position in the best trip
    const ordered = stops
      .map((stop, i) => ({ stop: stop, position: data.waypoints[i].waypoint_index }))
      .sort((a, b) => a.position - b.position)
      .map(item => item.stop);

    drawRoute(ordered, data.trips[0].geometry);
    renderRouteInfo(ordered, data.trips[0], fixedMeters);

    currentRoute = { ordered: ordered, km: data.trips[0].distance / 1000 };
    resetPublish();
  } catch {
    showPlanMessage('Could not plan the route. Check the connection and try again.');
  }

  setPlanning(false);
}

// Numbered badge: S = start, E = end, numbers = bins in visiting order
function badgeIcon(text, isEnd) {
  return L.divIcon({
    className: 'badge' + (isEnd ? ' badge-end' : ''),
    html: text,
    iconSize: isEnd ? [28, 28] : [24, 24],
    // Stop badges sit above the pin head, start and end sit on the spot
    iconAnchor: isEnd ? [14, 14] : [12, 60]
  });
}

function drawRoute(ordered, geometry) {
  routeLayer.clearLayers();

  // White casing under the blue line keeps it visible on satellite imagery
  L.geoJSON(geometry, { style: { color: '#ffffff', weight: 9, opacity: 0.9 } }).addTo(routeLayer);
  L.geoJSON(geometry, { style: { color: '#1d4ed8', weight: 5, opacity: 1 } }).addTo(routeLayer);

  ordered.forEach((stop, index) => {
    const isEnd = index === 0 || index === ordered.length - 1;
    let text = String(index);

    if (index === 0) text = 'S';
    if (index === ordered.length - 1) text = 'E';

    L.marker([stop.lat, stop.lng], {
      icon: badgeIcon(text, isEnd),
      interactive: false,
      zIndexOffset: 1000
    }).addTo(routeLayer);
  });

  map.fitBounds(L.geoJSON(geometry).getBounds(), { padding: [50, 50] });
}

function formatDuration(seconds) {
  const minutes = Math.round(seconds / 60);

  if (minutes < 60) return minutes + ' min';

  return Math.floor(minutes / 60) + ' h ' + (minutes % 60) + ' min';
}

function buildMapsUrl(ordered) {
  const point = stop => stop.lat + ',' + stop.lng;
  const middle = ordered.slice(1, -1).slice(0, GMAPS_MAX_STOPS);

  const params = new URLSearchParams({
    api: '1',
    origin: point(ordered[0]),
    destination: point(ordered[ordered.length - 1]),
    waypoints: middle.map(point).join('|'),
    travelmode: 'driving'
  });

  return 'https://www.google.com/maps/dir/?' + params;
}

function renderRouteInfo(ordered, trip, fixedMeters) {
  const km = trip.distance / 1000;
  const fixedKm = fixedMeters / 1000;
  const savedKm = fixedKm - km;

  $('statKm').textContent = km.toFixed(1) + ' km';
  $('statTime').textContent = formatDuration(trip.duration);
  $('statFuel').textContent = (km * FUEL_L_PER_100KM / 100).toFixed(1) + ' L';

  if (savedKm > 0.05) {
    const percent = Math.round(savedKm / fixedKm * 100);
    $('saving').textContent = `Saves ${savedKm.toFixed(1)} km (${percent}%) compared with a fixed round `
      + `through all ${bins.length} bins (${fixedKm.toFixed(1)} km). Estimate.`;
  } else {
    $('saving').textContent = 'No saving compared with a fixed round today.';
  }

  // Ordered stop list
  const list = $('stops');
  list.replaceChildren();

  ordered.forEach((stop, index) => {
    const item = document.createElement('li');

    const num = document.createElement('span');
    num.className = 'num';

    if (index === 0) {
      num.textContent = 'S';
    } else if (index === ordered.length - 1) {
      num.textContent = 'E';
    } else {
      num.textContent = index;
    }

    const name = document.createElement('span');
    name.textContent = stop.name;

    item.append(num, name);
    list.append(item);
  });

  // Hand-off to the driver's phone
  $('gmaps').href = buildMapsUrl(ordered);

  const tooMany = ordered.length - 2 > GMAPS_MAX_STOPS;
  $('gmapsNote').textContent = 'Google Maps takes ' + GMAPS_MAX_STOPS + ' stops per link, so the rest are left off.';
  $('gmapsNote').hidden = !tooMany;

  $('routeBox').hidden = false;
}

function clearRoute() {
  routeLayer.clearLayers();
  $('routeBox').hidden = true;
  currentRoute = null;
}

function resetPublish() {
  $('publishBtn').disabled = false;
  $('publishBtn').textContent = 'Publish to driver';
}

// Save the planned route so the driver page can follow it
async function publishRoute() {
  if (!currentRoute) return;

  const lastIndex = currentRoute.ordered.length - 1;

  const stops = currentRoute.ordered.map((stop, index) => {
    let type = 'bin';

    if (index === 0) type = 'depot';
    if (index === lastIndex) type = 'dump';

    return { type: type, id: stop.id || null, name: stop.name, lat: stop.lat, lng: stop.lng };
  });

  $('publishBtn').disabled = true;
  $('publishBtn').textContent = 'Publishing...';

  try {
    const response = await fetch(SB + '/rest/v1/routes', {
      method: 'POST',
      headers: { ...HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ stops: stops, km: Math.round(currentRoute.km * 10) / 10 })
    });

    if (!response.ok) throw new Error(response.status);

    $('publishBtn').textContent = 'Published to driver';
    toast('Route published. The driver can see it now.', 'info');
  } catch {
    resetPublish();
    toast('Could not publish the route. Try again.', 'info');
  }
}

/* ===== Events and start ===== */
$('planBtn').addEventListener('click', planRoute);
$('clearBtn').addEventListener('click', clearRoute);
$('publishBtn').addEventListener('click', publishRoute);
$('inclStale').addEventListener('change', updatePlanner);

$('pClose').addEventListener('click', closePanel);
$('pPhotoBtn').addEventListener('click', () => openLightbox($('pPhoto').src));
$('lightbox').addEventListener('click', closeLightbox);
map.on('click', closePanel);

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;

  if (!$('lightbox').hidden) {
    closeLightbox();
  } else {
    closePanel();
  }
});

refresh();
setInterval(refresh, POLL_MS);