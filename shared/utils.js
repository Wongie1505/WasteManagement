// ============================================================
// SHARED UTILITY FUNCTIONS
// ============================================================

// Format time relative to now (e.g., "5 mins ago")
function formatTimeAgo(date) {
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} mins ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
}

// Get status color for UI
function getStatusColor(status) {
    const colors = {
        'critical': '#D32F2F',
        'half-full': '#F57C00',
        'clear': '#2E7D32',
        'in-route': '#0288D1',
    };
    return colors[status] || '#757575';
}

// Get status badge class
function getStatusBadgeClass(status) {
    const classes = {
        'PENDING': 'pending',
        'IN PROGRESS': 'in-progress',
        'COLLECTED': 'collected',
        'DISPATCHED': 'in-progress',
        'VERIFIED': 'collected',
    };
    return classes[status] || 'pending';
}

// Validate bin code format
function isValidBinCode(code) {
    return /^BIN_\d{3}$/.test(code);
}

// Parse WhatsApp message (for future integration)
function parseWhatsAppMessage(message) {
    // Expected format: "Bin XXX [status]"
    // Example: "Bin 042 full"
    const match = message.match(/bin\s*(\d+)\s+(\w+)/i);
    if (!match) return null;
    
    return {
        binId: parseInt(match[1]),
        status: match[2].toLowerCase(),
    };
}

// Get status badge text
function getStatusText(fullness) {
    if (fullness >= 80) return 'CRITICAL';
    if (fullness >= 50) return 'HALF-FULL';
    return 'CLEAR';
}

// Calculate urgency level
function getUrgencyLevel(status) {
    const urgencyMap = {
        'critical': 'urgent',
        'half-full': 'medium',
        'clear': 'low',
    };
    return urgencyMap[status] || 'low';
}

// Format capacity display
function formatCapacity(liters) {
    if (liters >= 1000) {
        return `${(liters / 1000).toFixed(1)} tons`;
    }
    return `${liters} liters`;
}

// Generate report ID
function generateReportId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `${timestamp}-${random}`;
}

// Log to console with timestamp
function log(message, level = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[${timestamp}]`;
    
    if (level === 'error') {
        console.error(`${prefix} ERROR: ${message}`);
    } else if (level === 'warn') {
        console.warn(`${prefix} WARN: ${message}`);
    } else {
        console.log(`${prefix} ${message}`);
    }
}

// Debounce function for event handlers
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Check if in development mode
function isDevelopment() {
    return window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1';
}