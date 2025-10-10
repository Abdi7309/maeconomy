import { createClient } from '@supabase/supabase-js';

// Supabase project configuration
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://lasqujeicadwlfdmvgrx.supabase.co'
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

const CONFIG = {
    // Keep for any other non-API related configurations
    SUPABASE_URL: supabaseUrl,
    SUPABASE_ANON_KEY: supabaseAnonKey,
};

export default CONFIG;