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
    try {
        console.log('Loading data from Supabase...');
        
        initSupabase();
        
        BINS = await fetchBinsFromSupabase();
        console.log(`Loaded ${BINS.length} bins`);
        
        REPORTS = await fetchReportsFromSupabase();
        console.log(`Loaded ${REPORTS.length} reports`);
        
        if (BINS.length === 0) {
            console.warn('No bins in Supabase. Using mock data.');
            BINS = getMockBins();
            REPORTS = getMockReports();
        }
    } catch (error) {
        console.error('Error loading from Supabase:', error);
        console.log('Falling back to mock data...');
        BINS = getMockBins();
        REPORTS = getMockReports();
    }
}

// ============================================================
// MOCK DATA (Updated from GitHub)
// ============================================================

function getMockBins() {
    return [
        {
            id: 1,
            bin_code: 'BIN_01',
            name: 'Limbe Market NW Gate',
            location: 'Stalls 44-70',
            lat: -15.8161085154919,
            lng: 35.05312777760588,
            status: 'critical',
            fullness_percent: 100,
            last_report: new Date(Date.now() - 5 * 60000),
            reporter_name: 'Limbikani Phiri',
            reporter_phone: '+265 99 123 4567',
            capacity_liters: 1200,
        },
        {
            id: 2,
            bin_code: 'BIN_089',
            name: 'Victoria Ave CBD',
            location: 'Main Street',
            lat: -15.811480936086843,
            lng: 35.0555325833541,
            status: 'critical',
            fullness_percent: 98,
            last_report: new Date(Date.now() - 8 * 60000),
            reporter_name: 'Marshal Mussa',
            reporter_phone: '+265 99 456 7890',
            capacity_liters: 1200,
        },
        {
            id: 3,
            bin_code: 'BIN_018',
            name: 'Produce Shed 4 (East)',
            location: 'Market area',
            lat: -15.811524923171396,
            lng: 35.06323679230538,
            status: 'critical',
            fullness_percent: 82,
            last_report: new Date(Date.now() - 12 * 60000),
            reporter_name: 'Samule Joel',
            reporter_phone: '+265 99 789 0123',
            capacity_liters: 240,
        },
        {
            id: 4,
            bin_code: 'BIN_003',
            name: 'Chichiri Roundabout',
            location: 'Civic Center',
            lat: -15.816886750793403,
            lng: 35.05943289699813,
            status: 'half-full',
            fullness_percent: 65,
            last_report: new Date(Date.now() - 15 * 60000),
            reporter_name: 'Twambilire Jere',
            reporter_phone: '+265 99 111 2222',
            capacity_liters: 240,
        },
        {
            id: 5,
            bin_code: 'BIN_006',
            name: 'Kanjedza Residential',
            location: 'Drop Point C',
            lat: -15.809801233209551,
            lng: 35.064722688535355,
            status: 'half-full',
            fullness_percent: 55,
            last_report: new Date(Date.now() - 22 * 60000),
            reporter_name: 'John Doe',
            reporter_phone: '+265 99 654 3210',
            capacity_liters: 240,
        },
        {
            id: 6,
            bin_code: 'BIN_012',
            name: 'Secondary Market Bin',
            location: 'Chichiri Stand 2',
            lat: -15.805293091968014,
            lng: 35.04403626172913,
            status: 'clear',
            fullness_percent: 32,
            last_report: new Date(Date.now() - 60 * 60000),
            reporter_name: 'Jeremy Banda',
            reporter_phone: '+265 99 234 5678',
            capacity_liters: 240,
        },
        {
            id: 7,
            bin_code: 'BIN_007',
            name: 'Butchery Offal Container',
            location: 'Limbe Central',
            lat: -15.809801233209551,
            lng: 35.059640339803515,
            status: 'clear',
            fullness_percent: 18,
            last_report: new Date(Date.now() - 2 * 60 * 60000),
            reporter_name: 'Dalitso Ajijo',
            reporter_phone: '+265 99 543 2100',
            capacity_liters: 1200,
        },
    ];
}

function getMockReports() {
    return [
        { bin_id: 1, status: 'PENDING', timestamp: '08:15 AM' },
        { bin_id: 2, status: 'PENDING', timestamp: '08:02 AM' },
        { bin_id: 3, status: 'PENDING', timestamp: '07:45 AM' },
        { bin_id: 4, status: 'IN PROGRESS', timestamp: '08:10 AM' },
        { bin_id: 5, status: 'IN PROGRESS', timestamp: '07:50 AM' },
        { bin_id: 6, status: 'COLLECTED', timestamp: '07:12 AM' },
        { bin_id: 7, status: 'COLLECTED', timestamp: '06:45 AM' },
    ];
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
    console.log('Dashboard loaded');
    
    await loadData();
    initMap();
    renderReportsFeed();
    setupFilterButtons();
    setupRefreshButton();
    
    setInterval(async () => {
        REPORTS = await fetchReportsFromSupabase();
        renderReportsFeed();
    }, 30000);
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