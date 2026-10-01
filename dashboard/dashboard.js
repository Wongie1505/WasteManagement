// ============================================================
// STATE & DATA
// ============================================================

let BINS = [];
let REPORTS = [];
let map;
let markers = {};
let selectedBinId = null;
let currentFilter = 'all';

// ============================================================
// LOAD DATA FROM SUPABASE
// ============================================================

async function loadData() {
    console.log('Loading from Supabase...');
    
    initSupabase();
    
    BINS = await fetchBinsFromSupabase();
    if (BINS.length === 0) {
        throw new Error('No bins returned from Supabase. Check credentials and database.');
    }
    console.log(`Loaded ${BINS.length} bins from Supabase`);
    
    REPORTS = await fetchReportsFromSupabase();
    console.log(`Loaded ${REPORTS.length} reports from Supabase`);
}

// ============================================================
// INITIALIZE MAP
// ============================================================

function initMap() {
    const center = [-15.814667245590488, 35.06032333365631];
    
    map = L.map('map').setView(center, 15);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
    }).addTo(map);
    
    BINS.forEach(bin => renderBinMarker(bin));
    
    document.getElementById('zoom-in').addEventListener('click', () => map.zoomIn());
    document.getElementById('zoom-out').addEventListener('click', () => map.zoomOut());
    document.getElementById('recenter').addEventListener('click', () => {
        map.setView(center, 15);
    });
}

// ============================================================
// RENDER BIN MARKER
// ============================================================

function renderBinMarker(bin) {
    const { lat, lng, status, id } = bin;
    
    const iconColor = status === 'critical' ? '#D32F2F' :
                      status === 'half-full' ? '#F57C00' :
                      '#2E7D32';
    
    const icon = L.divIcon({
        className: `bin-marker bin-marker-${status}`,
        html: `<div class="marker-inner" style="background-color: ${iconColor};">${id}</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
    });
    
    const marker = L.marker([lat, lng], { icon }).addTo(map);
    marker.on('click', () => {
        selectedBinId = id;
        showBinPopup(bin);
    });
    
    markers[id] = marker;
}

// ============================================================
// POPUP HANDLERS
// ============================================================

function showBinPopup(bin) {
    const popup = document.getElementById('bin-popup');
    const lastReportTime = formatTimeAgo(new Date(bin.last_report));
    
    document.getElementById('popup-bin-id').textContent = `Receptacle #${bin.id}`;
    document.getElementById('popup-location').textContent = `${bin.name} (${bin.location})`;
    document.getElementById('popup-status').textContent = `${bin.status.toUpperCase()} (${bin.fullness_percent}%)`;
    document.getElementById('popup-last-report').textContent = lastReportTime;
    document.getElementById('popup-reporter').textContent = bin.reporter_name;
    document.getElementById('popup-contact').textContent = bin.reporter_phone;
    
    popup.classList.remove('hidden');
    
    document.getElementById('popup-mark-collected').onclick = () => markBinCollected(bin.id);
    document.getElementById('popup-sms-driver').onclick = () => smsBinDriver(bin.id);
    document.getElementById('popup-view-history').onclick = () => viewBinHistory(bin.id);
    document.getElementById('popup-close').onclick = () => popup.classList.add('hidden');
}

function closeBinPopup() {
    document.getElementById('bin-popup').classList.add('hidden');
    selectedBinId = null;
}

// ============================================================
// BIN ACTIONS
// ============================================================

async function markBinCollected(binId) {
    const bin = BINS.find(b => b.id === binId);
    if (!bin) return;
    
    try {
        await updateBinStatus(binId, 'clear', 0);
        await logCollectionEvent(binId, 'Supervisor', 100);
        
        bin.status = 'clear';
        bin.fullness_percent = 0;
        bin.last_report = new Date().toISOString();
        
        const marker = markers[binId];
        if (marker) {
            map.removeLayer(marker);
            renderBinMarker(bin);
        }
        
        closeBinPopup();
        
        REPORTS = await fetchReportsFromSupabase();
        renderReportsFeed();
        
        console.log(`Bin ${binId} marked as collected`);
    } catch (error) {
        console.error('Error marking bin collected:', error);
    }
}

function smsBinDriver(binId) {
    const bin = BINS.find(b => b.id === binId);
    if (!bin) return;
    
    alert(`SMS sent to driver:\n\nCollect Bin #${bin.id} at ${bin.name}`);
    console.log(`SMS Driver: Bin ${binId}`);
}

function viewBinHistory(binId) {
    const bin = BINS.find(b => b.id === binId);
    if (!bin) return;
    
    alert(`History for Bin #${bin.id}:\n\nLast 5 reports would show here.`);
    console.log(`View History: Bin ${binId}`);
}

// ============================================================
// REPORTS FEED
// ============================================================

function renderReportsFeed() {
    const feed = document.getElementById('reports-feed');
    feed.innerHTML = '';
    
    let filteredReports = REPORTS;
    
    if (currentFilter !== 'all') {
        filteredReports = REPORTS.filter(report => {
            if (currentFilter === 'urgent') return report.status === 'PENDING';
            if (currentFilter === 'in-progress') return report.status === 'IN PROGRESS';
            if (currentFilter === 'collected') return report.status === 'COLLECTED';
            return true;
        });
    }
    
    filteredReports.forEach(report => {
        const bin = BINS.find(b => b.id === report.bin_id);
        if (!bin) return;
        
        const statusClass = report.status.toLowerCase().replace(' ', '-');
        const reportEl = document.createElement('div');
        reportEl.className = `report-item ${bin.status}`;
        reportEl.innerHTML = `
            <div class="report-item-header">
                <span class="report-bin-id">Bin #${bin.id}</span>
                <span class="report-status-badge ${statusClass}">${report.status}</span>
            </div>
            <div class="report-location">${bin.name}</div>
            <div class="report-meta">
                <span>${report.timestamp}</span>
                <span>${report.reporter_name}</span>
            </div>
        `;
        
        reportEl.addEventListener('click', () => {
            selectedBinId = bin.id;
            showBinPopup(bin);
        });
        
        feed.appendChild(reportEl);
    });
    
    document.getElementById('report-count').textContent = `${filteredReports.length} reports`;
}

// ============================================================
// FILTER FEED
// ============================================================

function setupFilterButtons() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            currentFilter = btn.dataset.filter;
            renderReportsFeed();
        });
    });
}

// ============================================================
// REFRESH FEED
// ============================================================

function setupRefreshButton() {
    document.getElementById('refresh-feed').addEventListener('click', () => {
        renderReportsFeed();
        console.log('Feed refreshed');
    });
}

// ============================================================
// INIT ON PAGE LOAD
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('Dashboard loading...');
        
        await loadData();
        initMap();
        renderReportsFeed();
        setupFilterButtons();
        setupRefreshButton();
        
        console.log('Dashboard ready');
        
        setInterval(async () => {
            REPORTS = await fetchReportsFromSupabase();
            renderReportsFeed();
        }, 30000);
    } catch (error) {
        console.error('FATAL ERROR:', error);
        document.body.innerHTML = `
            <div style="padding: 40px; color: #d32f2f; font-family: monospace;">
                <h2>Error Loading Dashboard</h2>
                <p><strong>${error.message}</strong></p>
                <p>Check browser console (F12) for details.</p>
                <p>Verify Supabase credentials in shared/supabaseConfig.js</p>
            </div>
        `;
    }
});

// ============================================================
// CUSTOM MARKER STYLES (CSS-in-JS)
// ============================================================

const style = document.createElement('style');
style.innerHTML = `
    .bin-marker {
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .marker-inner {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 12px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        border: 2px solid white;
    }
    
    .bin-marker-critical .marker-inner {
        animation: pulse-critical 2s infinite;
    }
    
    @keyframes pulse-critical {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
    }
`;
document.head.appendChild(style);