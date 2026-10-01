// ============================================================
// SUPABASE CONFIG
// ============================================================

// TODO: Replace these with YOUR Supabase credentials
const SUPABASE_URL = 'https://wgolsrjbumnbdpufzogn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_tBI8PHLNr0qGocKweFLhHA_oDHQeave';

let client = null;

function initSupabase() {
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase initialized');
    return client;
}

async function fetchBinsFromSupabase() {
    try {
        if (!client) throw new Error('Supabase not initialized');
        
        const { data, error } = await client
            .from('bins')
            .select('*')
            .order('id');
        
        if (error) throw error;
        console.log(`Fetched ${data.length} bins`);
        return data || [];
    } catch (error) {
        console.error('Error fetching bins:', error.message);
        throw error;
    }
}

async function fetchReportsFromSupabase() {
    try {
        if (!client) throw new Error('Supabase not initialized');
        
        const { data, error } = await client
            .from('fullness_reports')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(50);
        
        if (error) throw error;
        console.log(`Fetched ${data.length} reports`);
        return data || [];
    } catch (error) {
        console.error('Error fetching reports:', error.message);
        throw error;
    }
}

async function logCollectionEvent(binId, supervisorName, amount) {
    try {
        if (!client) throw new Error('Supabase not initialized');
        
        const { data, error } = await client
            .from('collection_events')
            .insert([{
                bin_id: binId,
                supervisor_name: supervisorName,
                collected_at: new Date().toISOString(),
                amount_cleared_percent: amount || 100,
            }])
            .select();
        
        if (error) throw error;
        console.log(`Logged collection for bin ${binId}`);
        return data;
    } catch (error) {
        console.error('Error logging collection:', error.message);
        throw error;
    }
}

async function updateBinStatus(binId, newStatus, fullness) {
    try {
        if (!client) throw new Error('Supabase not initialized');
        
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
        console.log(`Updated bin ${binId}`);
        return data;
    } catch (error) {
        console.error('Error updating bin:', error.message);
        throw error;
    }
}