# CivicWaste GIS - Waste Management System Prototype

A real-time waste collection monitoring system using GIS mapping, WhatsApp reporting, and Supabase.

## Project Structure

```
WasteManagement/
├── index.html                    # Redirects to dashboard
├── dashboard/
│   ├── dashboard.html           # Main dispatch console UI
│   ├── dashboard.css            # Dashboard styling
│   └── dashboard.js             # Map rendering, interactions, mock data
├── whatsappfeed/
│   ├── whatsappfeed.html       # WhatsApp reports feed page
│   ├── whatsappfeed.css        # Feed styling
│   └── whatsappfeed.js         # Feed logic (Phase 2)
├── shared/
│   ├── supabaseConfig.js       # Supabase configuration (placeholder)
│   └── utils.js                # Shared utility functions
└── README.md                    # This file
```

## Features (Current Prototype)

### Dashboard Screen (Live)
- **Leaflet Map**: Interactive map showing Limbe Market, Blantyre
- **10 Mock Bins**: Plotted with hardcoded data
  - 🔴 Red (Critical): >80% full, pulsing animation
  - 🟡 Yellow (Half-full): 50-80% full
  - 🟢 Green (Clear): 0-50% full
- **Bin Click Popup**: Click any bin to see:
  - Bin ID, location, fullness level
  - Last report time and reporter name
  - Contact info
  - "Mark Collected" button
- **Live Reports Feed**: Real-time list of bin statuses (right sidebar)
- **Responsive Design**: Three-column layout (sidebar | map | feed)

### Current Functionality
- ✓ Map rendering and navigation (zoom, pan, recenter)
- ✓ Click bin marker → popup with details
- ✓ Mark bin as collected → map updates in real-time
- ✓ Filter reports (All, Urgent, In Progress, Collected)
- ✓ Auto-refresh feed every 30 seconds
- ✓ Responsive sidebar navigation
- ✓ Mobile-friendly design

## What's Hardcoded (Mock Data)

- **10 bins** in `dashboard.js` with fake fullness data
- **7 reports** with mock statuses
- **No Supabase connection yet** — all data in JavaScript

## Getting Started

### Option 1: Open Locally (Easiest)
1. Download the project folder
2. Open `index.html` in your browser
3. You should see the dashboard with a map

### Option 2: Run with a Local Server (Recommended)
```bash
# Using Python 3
python -m http.server 8000

# Using Node.js
npx http-server

# Then open: http://localhost:8000
```

### Option 3: Use Live Server in VSCode
1. Install "Live Server" extension
2. Right-click `index.html` → "Open with Live Server"

## How It Works Right Now

1. **Page loads** → dashboard.js initializes Leaflet map
2. **Mock bins render** on map with colored markers
3. **Reports feed populates** on right sidebar
4. **Click any bin** → popup shows details
5. **Click "Mark Collected"** → bin status changes, feed updates
6. **Click "WhatsApp Reports"** → navigate to feed page (placeholder)

## Next Steps (Phase 2 - Connecting Supabase)

### 1. Set up Supabase
```bash
# Create account at https://supabase.com
# Create new project
# Get your API URL and anon key
```

### 2. Create Database Schema
```sql
-- bins table
CREATE TABLE bins (
  id SERIAL PRIMARY KEY,
  bin_code VARCHAR(50) UNIQUE,
  location GEOGRAPHY(POINT, 4326),
  zone_id INTEGER,
  status VARCHAR(20),
  fullness_percent INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- fullness_reports table
CREATE TABLE fullness_reports (
  id SERIAL PRIMARY KEY,
  bin_id INTEGER REFERENCES bins(id),
  status VARCHAR(50),
  reporter_id VARCHAR(100),
  timestamp TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- collection_events table
CREATE TABLE collection_events (
  id SERIAL PRIMARY KEY,
  bin_id INTEGER REFERENCES bins(id),
  vehicle_id VARCHAR(50),
  collected_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 3. Update supabaseConfig.js
```javascript
const SUPABASE_URL = 'your-url';
const SUPABASE_ANON_KEY = 'your-key';
// Import Supabase client and implement queries
```

### 4. Replace Mock Data
In `dashboard.js`:
- Remove `MOCK_BINS` array
- Call `fetchBinsFromSupabase()` instead
- Listen to Supabase real-time updates

### 5. Set up WhatsApp Webhook
- Use Africastalking or Twilio API
- Create Edge Function in Supabase to receive messages
- Parse "Bin XXX [status]" format
- Insert into `fullness_reports` table

### 6. WhatsApp Reports Feed (Screen 2)
- Display incoming messages in real-time
- Show parser output (bin ID, status, confidence)
- Allow quick actions (dispatch, SMS driver)

## Code Quality Notes

- **No build tool needed**: Pure HTML/CSS/JS
- **External dependencies**: Only Leaflet (CDN) for mapping
- **Vanilla JavaScript**: No frameworks, no transpiling
- **Clean structure**: Separation of concerns (HTML/CSS/JS)
- **Comments**: Well-documented functions
- **Utilities**: `utils.js` for reusable functions

## Testing Checklist

- [ ] Map loads and displays at Limbe Market
- [ ] 10 bins appear on map with correct colors
- [ ] Click a bin → popup appears with correct data
- [ ] Click "Mark Collected" → bin turns green, feed updates
- [ ] Reports feed shows all 7 mock reports
- [ ] Filter buttons work (All, Urgent, etc.)
- [ ] Refresh button updates feed
- [ ] Auto-refresh happens every 30 seconds
- [ ] Zoom controls work (+, −, recenter)
- [ ] Responsive on mobile (sidebar hides)
- [ ] Navigation to WhatsApp feed works

## Developer Notes

### Adding More Mock Bins
Edit `MOCK_BINS` array in `dashboard.js`:
```javascript
{
    id: 99,
    code: 'BIN_099',
    name: 'Your Location',
    lat: -15.xxxx,
    lng: 34.xxxx,
    status: 'critical', // or 'half-full', 'clear'
    fullness: 95,
    lastReport: '5 mins ago',
    reporter: 'Your Name',
    reporterPhone: '+265 99 xxx xxxx',
    capacity: 240,
}
```

### Debugging
Open browser console (F12) to see:
- Map initialization logs
- Click events
- Report rendering
- Action logs

## Contact & Support

For questions about the prototype or next steps, reach out to the developer.

---

**Status**: Prototype v1.0 (Frontend Complete, Backend Ready for Integration)
**Last Updated**: September 2026