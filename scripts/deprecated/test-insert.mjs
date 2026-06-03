import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  console.log('Testing insert...');
  
  // Note: since this is using ANON_KEY and no user session, if RLS is enabled and requires auth, this will fail.
  // This is a good test. If it fails with "new row violates row-level security policy", we know RLS is active.
  const { data, error } = await supabase.from('accounts').insert({
    name: 'Test Account',
    type: 'cash',
    currency: 'DOP',
    balance: 100,
    is_active: true
  }).select();

  console.log('Data:', data);
  console.log('Error:', error);
}
test();