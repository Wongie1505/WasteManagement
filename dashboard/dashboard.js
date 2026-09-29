// ============================================================
// HARDCODED TEST DATA (Will replace with Supabase later)
// ============================================================

const MOCK_BINS = [
    {
        id: 1,
        code: 'BIN_01',
        name: 'Limbe Market NW Gate',
        description: 'Stalls 44-70',
        lat: -15.8161085154919,
        lng: 35.05312777760588,
        status: 'critical',
        fullness: 100,
        lastReport: '5 mins ago',
        reportTime: new Date(Date.now() - 5 * 60000),
        reporter: 'Limbikani Phiri',
        reporterPhone: '+265 99 123 4567',
        capacity: 1200,
    },
    {
        id: 2,
        code: 'BIN_089',
        name: 'Victoria Ave CBD',
        description: 'Main Street',
        lat: -15.811480936086843,
        lng: 35.0555325833541,
        status: 'critical',
        fullness: 98,
        lastReport: '8 mins ago',
        reportTime: new Date(Date.now() - 8 * 60000),
        reporter: 'Marshal Mussa',
        reporterPhone: '+265 99 456 7890',
        capacity: 1200,
    },
    {
        id: 3,
        code: 'BIN_018',
        name: 'Produce Shed 4 (East)',
        description: 'Market area',
        lat: -15.811524923171396,
        lng: 35.06323679230538,
        status: 'critical',
        fullness: 82,
        lastReport: '12 mins ago',
        reportTime: new Date(Date.now() - 12 * 60000),
        reporter: 'Samule Joel',
        reporterPhone: '+265 99 789 0123',
        capacity: 240,
    },
    {
        id: 4,
        code: 'BIN_003',
        name: 'Chichiri Roundabout',
        description: 'Civic Center',
        lat: -15.816886750793403,
        lng: 35.05943289699813,
        status: 'half-full',
        fullness: 65,
        lastReport: '15 mins ago',
        reportTime: new Date(Date.now() - 15 * 60000),
        reporter: 'Twambilire Jere',
        reporterPhone: '+265 99 111 2222',
        capacity: 240,
    },
    {
        id: 5,
        code: 'BIN_006',
        name: 'Kanjedza Residential',
        description: 'Drop Point C',
        lat: -15.809801233209551,
        lng: 35.064722688535355,
        status: 'half-full',
        fullness: 55,
        lastReport: '22 mins ago',
        reportTime: new Date(Date.now() - 22 * 60000),
        reporter: 'John Doe',
        reporterPhone: '+265 99 654 3210',
        capacity: 240,
    },
    {
        id: 6,
        code: 'BIN_012',
        name: 'Secondary Market Bin',
        description: 'Chichiri Stand 2',
        lat: -15.805293091968014,
        lng: 35.04403626172913,
        status: 'clear',
        fullness: 32,
        lastReport: '1 hour ago',
        reportTime: new Date(Date.now() - 60 * 60000),
        reporter: 'Jeremy Banda',
        reporterPhone: '+265 99 234 5678',
        capacity: 240,
    },
    {
        id: 7,
        code: 'BIN_007',
        name: 'Butchery Offal Container',
        description: 'Limbe Central',
        lat: -15.809801233209551,
        lng: 35.059640339803515,
        status: 'clear',
        fullness: 18,
        lastReport: '2 hours ago',
        reportTime: new Date(Date.now() - 2 * 60 * 60000),
        reporter: 'Dalitso Ajijo',
        reporterPhone: '+265 99 543 2100',
        capacity: 1200,
    },
];

const MOCK_REPORTS = [
    { binId: 1, status: 'PENDING', timestamp: '08:15 AM' },
    { binId: 2, status: 'PENDING', timestamp: '08:02 AM' },
    { binId: 3, status: 'PENDING', timestamp: '07:45 AM' },
    { binId: 4, status: 'IN PROGRESS', timestamp: '08:10 AM' },
    { binId: 5, status: 'IN PROGRESS', timestamp: '07:50 AM' },
    { binId: 6, status: 'COLLECTED', timestamp: '07:12 AM' },
    { binId: 7, status: 'COLLECTED', timestamp: '06:45 AM' },
];

// ============================================================
// STATE MANAGEMENT
// ============================================================

let map;
let markers = {};
let selectedBinId = null;

// ============================================================
// INITIALIZE MAP
// ============================================================

function initMap() {
    // Center on Limbe Market, Blantyre
    const center = [-15.814667245590488, 35.06032333365631];
    
    map = L.map('map').setView(center, 15);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
    }).addTo(map);
    
    // Render all bins
    MOCK_BINS.forEach(bin => renderBinMarker(bin));
    
    // Map controls
    document.getElementById('zoom-in').addEventListener('click', () => map.zoomIn());
    document.getElementById('zoom-out').addEventListener('click', () => map.zoomOut());
    document.getElementById('recenter').addEventListener('click', () => {
        map.setView(center, 17);
    });
}

// ============================================================
// RENDER BIN MARKER
// ============================================================

function renderBinMarker(bin) {
    const { lat, lng, status, id, code } = bin;
    
    // Create custom icon based on status
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
    
    // Click handler
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
    
    document.getElementById('popup-bin-id').textContent = `Receptacle #${bin.id}`;
    document.getElementById('popup-location').textContent = `${bin.name} (${bin.description})`;
    document.getElementById('popup-status').textContent = `${bin.status.toUpperCase()} (${bin.fullness}%)`;
    document.getElementById('popup-last-report').textContent = bin.lastReport;
    document.getElementById('popup-reporter').textContent = bin.reporter;
    document.getElementById('popup-contact').textContent = bin.reporterPhone;
    
    popup.classList.remove('hidden');
    
    // Button handlers
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

function markBinCollected(binId) {
    const bin = MOCK_BINS.find(b => b.id === binId);
    if (!bin) return;
    
    // Update mock data
    bin.status = 'clear';
    bin.fullness = 0;
    bin.lastReport = 'Just now';
    
    // Update marker
    const marker = markers[binId];
    if (marker) {
        map.removeLayer(marker);
        renderBinMarker(bin);
    }
    
    // Close popup
    closeBinPopup();
    
    // Refresh feed
    renderReportsFeed();
    
    console.log(`✓ Bin ${binId} marked as collected`);
}

function smsBinDriver(binId) {
    const bin = MOCK_BINS.find(b => b.id === binId);
    if (!bin) return;
    
    alert(`SMS sent to driver:\n\nCollect Bin #${bin.id} at ${bin.name}`);
    console.log(`SMS Driver: Bin ${binId}`);
}

function viewBinHistory(binId) {
    const bin = MOCK_BINS.find(b => b.id === binId);
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
    
    MOCK_REPORTS.forEach(report => {
        const bin = MOCK_BINS.find(b => b.id === report.binId);
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
                <span>${bin.reporter}</span>
            </div>
        `;
        
        reportEl.addEventListener('click', () => {
            selectedBinId = bin.id;
            showBinPopup(bin);
        });
        
        feed.appendChild(reportEl);
    });
    
    // Update report count
    document.getElementById('report-count').textContent = `${MOCK_REPORTS.length} reports`;
}

// ============================================================
// FILTER FEED
// ============================================================

function setupFilterButtons() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const filter = btn.dataset.filter;
            console.log(`Filtering by: ${filter}`);
            // TODO: Implement filtering logic
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

document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard loaded');
    initMap();
    renderReportsFeed();
    setupFilterButtons();
    setupRefreshButton();
    
    // Auto-refresh feed every 30 seconds (for demo)
    setInterval(renderReportsFeed, 30000);
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