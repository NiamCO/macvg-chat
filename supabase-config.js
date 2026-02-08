// ==============================================
// MACVG CHAT - Supabase Configuration
// ==============================================
// IMPORTANT: Replace these values with YOUR actual Supabase project credentials
// ==============================================

// Your Supabase project URL and anon key
// Get these from: Supabase Dashboard → Settings → API
const SUPABASE_URL = 'https://atojfbqwkvkleisxiujv.supabase.co'; // ← REPLACE THIS
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0b2pmYnF3a3ZrbGVpc3hpdWp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1NzY3ODIsImV4cCI6MjA4NjE1Mjc4Mn0.jiHItdZVtQuu0-S3C-Z2ifM0MUbpiaAdvkUJKGOW2As';// ← REPLACE THIS

// Initialize Supabase client
let supabaseClient;

try {
    // Create Supabase client
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        realtime: {
            params: {
                eventsPerSecond: 10
            }
        }
    });
    
    console.log('✅ Supabase client initialized successfully');
    
} catch (error) {
    console.error('❌ Failed to initialize Supabase:', error);
    console.log('⚠️ Please check your Supabase URL and Anon Key');
    
    // Create a mock supabase object to prevent errors during development
    supabaseClient = {
        from: () => ({
            select: () => Promise.resolve({ data: [], error: null }),
            insert: () => Promise.resolve({ data: [], error: null }),
            update: () => Promise.resolve({ data: [], error: null }),
            delete: () => Promise.resolve({ data: [], error: null })
        }),
        channel: () => ({
            on: () => ({ subscribe: () => ({}) }),
            subscribe: () => ({})
        })
    };
}

// ==============================================
// TEST CONNECTION FUNCTION
// ==============================================
async function testSupabaseConnection() {
    if (!SUPABASE_URL.includes('your-project-id')) {
        try {
            const { data, error } = await supabaseClient
                .from('chat_messages')
                .select('*')
                .limit(1);
            
            if (error) {
                console.error('❌ Supabase connection test failed:', error.message);
                return false;
            }
            
            console.log('✅ Supabase connection successful!');
            return true;
            
        } catch (error) {
            console.error('❌ Error testing Supabase connection:', error);
            return false;
        }
    } else {
        console.log('⚠️ Supabase credentials not configured yet');
        return false;
    }
}

// ==============================================
// CHECK IF SUPABASE IS CONFIGURED
// ==============================================
function isSupabaseConfigured() {
    const isConfigured = !SUPABASE_URL.includes('your-project-id') && 
                        !SUPABASE_ANON_KEY.includes('your-anon-key-here');
    
    if (!isConfigured) {
        console.warn('⚠️ Supabase is not configured!');
        console.warn('Please update supabase-config.js with your credentials');
    }
    
    return isConfigured;
}

// ==============================================
// EXPORT FOR USE IN OTHER FILES
// ==============================================
window.supabase = supabaseClient; // Changed from window.supabaseClient
window.testSupabaseConnection = testSupabaseConnection;
window.isSupabaseConfigured = isSupabaseConfigured;

// Auto-test connection when page loads (if configured)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (isSupabaseConfigured()) {
            testSupabaseConnection();
        }
    }, 1000);
});

// ==============================================
// TABLE STRUCTURE REFERENCE:
// ==============================================
// chat_messages table:
// - id: uuid (primary key)
// - user_id: text (the actual username entered)
// - display_name: text (what shows in chat - "Niam - Creator" for admin)
// - is_admin: boolean (true for Doneman1233)
// - message: text (the message content)
// - created_at: timestamp
//
// game_requests table:
// - id: uuid (primary key)
// - from_user: text (username of requester)
// - from_display_name: text (display name of requester)
// - to_user: text (target username)
// - game_name: text (name of game)
// - game_url: text (optional URL)
// - status: text ('pending', 'accepted', 'rejected')
// - created_at: timestamp
// - responded_at: timestamp
// ==============================================
