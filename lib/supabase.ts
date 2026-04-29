import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client
const supabaseUrl = 'https://your-supabase-url.supabase.co';
const supabaseKey = 'your-anon-public-key';
const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;