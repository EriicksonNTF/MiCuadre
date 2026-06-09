import { readFileSync } from 'fs';

const TOKEN = process.env.SUPABASE_MGMT_TOKEN || '';
if (!TOKEN) {
  console.error('SUPABASE_MGMT_TOKEN env var required');
  process.exit(1);
}
const REF = 'zmbxriaftswtxjihatfr';
const BASE = 'https://api.supabase.com';

async function runSQL(query) {
  const res = await fetch(`${BASE}/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`✗ Error: ${data.message || JSON.stringify(data)}`);
    return null;
  }
  return data;
}

// Check existing functions
console.log('📊 Checking existing functions...');
const check = await runSQL(
  "SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace " +
  "AND proname IN ('create_transfer_safe','add_goal_contribution_safe','create_transaction_safe','reconcile_account_balance') ORDER BY proname"
);
if (check) {
  const names = check.map(r => r.proname);
  console.log('Existing:', names.join(', ') || 'none');
  
  const missing = ['create_transfer_safe','add_goal_contribution_safe','create_transaction_safe'].filter(n => !names.includes(n));
  const missingReconcile = !names.includes('reconcile_account_balance');
  
  async function runScript(filePath, label) {
    console.log(`\n📦 Running ${label}...`);
    const sql = readFileSync(filePath, 'utf8');
    // Split by semicolons but keep function bodies intact
    // Simple approach: send the whole script at once
    const result = await runSQL(sql);
    if (result !== null) {
      console.log(`✅ ${label} executed successfully`);
    } else {
      // Try statement by statement
      console.log(`⚠️ Trying statement-by-statement...`);
      const stmts = sql.split(';\n').filter(s => s.trim().length > 1);
      for (const stmt of stmts) {
        const trimmed = stmt.trim();
        if (trimmed.length > 5) {
          const r = await runSQL(trimmed + ';');
          if (r === null) console.log(`  ⚠ Statement failed (may be expected)`);
          else console.log(`  ✓ ${trimmed.substring(0, 50)}...`);
        }
      }
    }
  }
  
  if (missing.length > 0) {
    await runScript('/Users/papolo/Documents/MiCuadre/MiCuadre/scripts/029_atomic_operations.sql', '029_atomic_operations.sql');
  } else {
    console.log('✅ 029_atomic_operations.sql already applied');
  }
  
  if (missingReconcile) {
    await runScript('/Users/papolo/Documents/MiCuadre/MiCuadre/scripts/030_reconcile_balance.sql', '030_reconcile_balance.sql');
  } else {
    console.log('✅ 030_reconcile_balance.sql already applied');
  }
  
  // Final verification
  const final = await runSQL(
    "SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace " +
    "AND proname IN ('create_transfer_safe','add_goal_contribution_safe','create_transaction_safe','reconcile_account_balance') ORDER BY proname"
  );
  if (final) {
    console.log(`\n📊 Final functions: ${final.map(r => r.proname).join(', ') || '(none)'}`);
  }
}
