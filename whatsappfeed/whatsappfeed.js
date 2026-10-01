// ============================================================
// REPORT FORM SUBMISSION
// ============================================================

let BINS = [];

document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('report-form');
    
    if (!form) return;
    
    initSupabase();
    
    // Load bins from Supabase
    await loadBins();
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const binId = document.getElementById('bin-id').value;
        const status = document.getElementById('status').value;
        const reporterName = document.getElementById('reporter-name').value;
        const reporterPhone = document.getElementById('reporter-phone').value || null;
        
        try {
            // Map status to fullness percent
            const fullnessMap = {
                'empty': 10,
                'quarter': 35,
                'half': 65,
                'full': 90,
                'overflow': 110,
            };
            
            const fullness = fullnessMap[status] || 50;
            const statusText = status.toUpperCase();
            
            // Insert report into Supabase
            const { data, error } = await client
                .from('fullness_reports')
                .insert([{
                    bin_id: parseInt(binId),
                    status: statusText,
                    reporter_name: reporterName,
                    reporter_phone: reporterPhone,
                    fullness_percent: fullness,
                    timestamp: new Date().toISOString(),
                }])
                .select();
            
            if (error) throw error;
            
            console.log('Report submitted:', data);
            
            // Also update the bin status
            const binStatus = fullness >= 80 ? 'critical' :
                             fullness >= 50 ? 'half-full' :
                             'clear';
            
            const { error: updateError } = await client
                .from('bins')
                .update({
                    status: binStatus,
                    fullness_percent: fullness,
                    last_report: new Date().toISOString(),
                })
                .eq('id', parseInt(binId));
            
            if (updateError) throw updateError;
            
            console.log(`Updated bin ${binId} status to ${binStatus}`);
            
            // Show success message
            showSuccess();
            
            // Refresh dashboard after 1 second
            setTimeout(() => {
                window.opener?.location.reload();
                console.log('Dashboard refreshed');
            }, 1000);
            
        } catch (error) {
            console.error('Error submitting report:', error);
            showError(error.message);
        }
    });
    
    // Reset button
    document.querySelector('.btn-reset')?.addEventListener('click', () => {
        form.reset();
        hideMessages();
    });
    
    // Retry button
    document.querySelector('.btn-retry')?.addEventListener('click', () => {
        hideMessages();
    });
});

async function loadBins() {
    try {
        const { data, error } = await client
            .from('bins')
            .select('id, name')
            .order('id');
        
        if (error) throw error;
        
        BINS = data;
        
        // Populate dropdown
        const dropdown = document.getElementById('bin-id');
        dropdown.innerHTML = '<option value="">Select a bin...</option>';
        
        BINS.forEach(bin => {
            const option = document.createElement('option');
            option.value = bin.id;
            option.textContent = `#${bin.id} - ${bin.name}`;
            dropdown.appendChild(option);
        });
        
        console.log(`Loaded ${BINS.length} bins`);
    } catch (error) {
        console.error('Error loading bins:', error);
        document.getElementById('bin-id').innerHTML = '<option value="">Error loading bins</option>';
    }
}

function showSuccess() {
    document.getElementById('report-form').classList.add('hidden');
    document.getElementById('success-message').classList.remove('hidden');
}

function showError(message) {
    document.getElementById('error-text').textContent = message;
    document.getElementById('error-message').classList.remove('hidden');
}

function hideMessages() {
    document.getElementById('success-message').classList.add('hidden');
    document.getElementById('error-message').classList.add('hidden');
    document.getElementById('report-form').classList.remove('hidden');
}