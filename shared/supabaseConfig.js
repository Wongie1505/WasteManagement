// ============================================================
// SUPABASE CONFIG
// ============================================================

// TODO: Replace these with YOUR Supabase credentials
const SUPABASE_URL = 'https://wgolsrjbumnbdpufzogn.supabase.co;
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb2xzcmpidW1uYmRwdWZ6b2duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NzE0OTIsImV4cCI6MjEwNjI0NzQ5Mn0.OIAMkXklC4uUYBIC885FXjlOIwl4a9Z5o9g3EgzzuCU';

// Initialize Supabase client
const { createClient } = supabase;
let client = null;

function initSupabase() {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✓ Supabase initialized');
    return client;
}

// Fetch all bins from database
async function fetchBinsFromSupabase() {
    try {
        const { data, error } = await client
            .from('bins')
            .select('*')
            .order('id');
        
        if (error) throw error;
        console.log(`✓ Fetched ${data.length} bins from Supabase`);
        return data || [];
    } catch (error) {
        console.error('Error fetching bins:', error);
        return [];
    }
}

// Fetch reports for a specific bin
async function fetchReportsFromSupabase(binId = null) {
    try {
        let query = client
            .from('fullness_reports')
            .select('*')
            .order('timestamp', { ascending: false });
        
        if (binId) {
            query = query.eq('bin_id', binId);
        }
        
        const { data, error } = await query.limit(50);
        
        if (error) throw error;
        console.log(`✓ Fetched ${data.length} reports from Supabase`);
        return data || [];
    } catch (error) {
        console.error('Error fetching reports:', error);
        return [];
    }
}

// Log a collection event
async function logCollectionEvent(binId, supervisorName, amount) {
    try {
        const { data, error } = await client
            .from('collection_events')
            .insert([
                {
                    bin_id: binId,
                    supervisor_name: supervisorName,
                    collected_at: new Date().toISOString(),
                    amount_cleared_percent: amount || 100,
                }
            ])
            .select();
        
        if (error) throw error;
        console.log(`✓ Logged collection for bin ${binId}`);
        return data;
    } catch (error) {
        console.error('Error logging collection:', error);
        return null;
    }
}

// Insert a new report
async function insertReport(binId, status, reporterName, reporterPhone, fullness) {
    try {
        const { data, error } = await client
            .from('fullness_reports')
            .insert([
                {
                    bin_id: binId,
                    status: status.toUpperCase(),
                    reporter_name: reporterName,
                    reporter_phone: reporterPhone,
                    fullness_percent: fullness,
                    timestamp: new Date().toISOString(),
                }
            ])
            .select();
        
        if (error) throw error;
        console.log(`✓ Inserted report for bin ${binId}`);
        return data;
    } catch (error) {
        console.error('Error inserting report:', error);
        return null;
    }
}

// Update bin status
async function updateBinStatus(binId, newStatus, fullness) {
    try {
        const { data, error } = await client
            .from('bins')
            .update({
                status: newStatus,
                fullness_percent: fullness,
                last_report: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', binId)
            .select();
        
        if (error) throw error;
        console.log(`✓ Updated bin ${binId} status`);
        return data;
    } catch (error) {
        console.error('Error updating bin:', error);
        return null;
    }
}