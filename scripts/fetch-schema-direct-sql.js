/**
 * Direct SQL approach to fetch schema using Supabase REST API
 * Uses SQL functions executed via RPC
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const PROJECT_REF = 'eqxagfhgfgrcdbtmxepl';
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;

// Try to get service role key from environment
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SERVICE_ROLE_KEY && !ANON_KEY) {
  console.error('❌ Error: Need either SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  console.error('\nPlease set one of these environment variables:');
  console.error('  $env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
  console.error('  OR');
  console.error('  $env:NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"');
  process.exit(1);
}

const supabase = createClient(
  SUPABASE_URL, 
  SERVICE_ROLE_KEY || ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const OUTPUT_DIR = path.join(__dirname, '..', 'supabase', 'tables');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Execute SQL via RPC (requires a function to be created first)
 */
async function executeSQL(query) {
  // Try to use a generic SQL execution function if it exists
  try {
    const { data, error } = await supabase.rpc('exec_sql', { query });
    if (error) throw error;
    return data;
  } catch (err) {
    // If exec_sql doesn't exist, we'll need to create helper functions
    return null;
  }
}

/**
 * Get tables by querying pg_catalog directly via a view or function
 */
async function getTablesDirect() {
  console.log('🔍 Attempting to fetch tables...\n');
  
  // Try multiple approaches
  const approaches = [
    // Approach 1: Try to query information_schema via a custom view
    async () => {
      try {
        const { data, error } = await supabase
          .from('information_schema.tables')
          .select('table_name, table_type')
          .eq('table_schema', 'public')
          .eq('table_type', 'BASE TABLE');
        
        if (!error && data) return data;
      } catch (e) {
        // Not accessible via REST API
      }
      return null;
    },
    
    // Approach 2: Try RPC function
    async () => {
      try {
        const { data, error } = await supabase.rpc('get_all_tables');
        if (!error && data) return data;
      } catch (e) {
        // Function doesn't exist
      }
      return null;
    },
    
    // Approach 3: Try to infer tables by attempting to query common table names
    async () => {
      // Common Supabase tables
      const commonTables = [
        'profiles', 'users', 'thumbnails', 'experiments', 'organizations',
        'org_members', 'subscriptions', 'referrals', 'analytics', 'sessions'
      ];
      
      const foundTables = [];
      
      for (const tableName of commonTables) {
        try {
          // Try to query the table (limit 0 to just check if it exists)
          const { error } = await supabase
            .from(tableName)
            .select('*')
            .limit(0);
          
          // If no error or error is about RLS (not "relation does not exist"), table exists
          if (!error || (error.code !== '42P01' && !error.message.includes('does not exist'))) {
            foundTables.push({ table_name: tableName, table_type: 'BASE TABLE' });
          }
        } catch (e) {
          // Table doesn't exist or not accessible
        }
      }
      
      return foundTables.length > 0 ? foundTables : null;
    }
  ];
  
  for (const approach of approaches) {
    const result = await approach();
    if (result && result.length > 0) {
      console.log(`✅ Found ${result.length} tables using direct query\n`);
      return result;
    }
  }
  
  return null;
}

/**
 * Get columns for a table
 */
async function getTableColumns(tableName) {
  try {
    // Try RPC function first
    const { data, error } = await supabase.rpc('get_table_columns', {
      p_table_name: tableName
    });
    
    if (!error && data) return data;
  } catch (e) {
    // Function doesn't exist, continue
  }
  
  // Fallback: Try to infer from a sample query
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (!error && data && data.length > 0) {
      // Infer columns from the first row
      const sample = data[0];
      return Object.keys(sample).map((key, index) => ({
        column_name: key,
        data_type: typeof sample[key] === 'string' ? 'text' : 
                   typeof sample[key] === 'number' ? 'numeric' :
                   typeof sample[key] === 'boolean' ? 'boolean' :
                   sample[key] instanceof Date ? 'timestamp' : 'unknown',
        ordinal_position: index + 1,
        is_nullable: sample[key] === null ? 'YES' : 'NO'
      }));
    }
  } catch (e) {
    console.error(`  ⚠️  Could not infer columns for ${tableName}:`, e.message);
  }
  
  return [];
}

/**
 * Get RLS policies for a table
 */
async function getRLSPolicies(tableName) {
  try {
    const { data, error } = await supabase.rpc('get_table_rls_policies', {
      p_table_name: tableName
    });
    
    if (!error && data) return data;
  } catch (e) {
    // Function doesn't exist
  }
  
  return [];
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Fetching Supabase schema directly...\n');
  console.log(`📡 Project: ${PROJECT_REF}`);
  console.log(`🔑 Using: ${SERVICE_ROLE_KEY ? 'Service Role Key' : 'Anon Key'}\n`);

  // Get tables
  const tables = await getTablesDirect();
  
  if (!tables || tables.length === 0) {
    console.log('❌ Could not fetch tables automatically.');
    console.log('\n📝 Please use one of these methods:');
    console.log('1. Run SQL queries from supabase/queries/ in Supabase SQL Editor');
    console.log('2. Set up helper functions (see supabase/queries/setup-helper-functions.sql)');
    console.log('3. Use Supabase CLI: npx supabase db dump --project-ref eqxagfhgfgrcdbtmxepl\n');
    return;
  }

  console.log(`📊 Processing ${tables.length} tables...\n`);

  // Process each table
  for (const table of tables) {
    const tableName = table.table_name;
    console.log(`📋 ${tableName}...`);
    
    const columns = await getTableColumns(tableName);
    const policies = await getRLSPolicies(tableName);
    
    const tableInfo = {
      table_name: tableName,
      table_type: table.table_type || 'BASE TABLE',
      schema: {
        columns: columns,
        constraints: [], // Would need SQL query for this
        indexes: [] // Would need SQL query for this
      },
      rls_policies: policies,
      exported_at: new Date().toISOString(),
      project_ref: PROJECT_REF,
      note: columns.length === 0 
        ? 'Columns could not be automatically detected. Please run SQL queries to get complete schema.'
        : 'Some schema details may be incomplete. Run SQL queries for full information.'
    };
    
    const filename = `${tableName}.json`;
    const filepath = path.join(OUTPUT_DIR, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(tableInfo, null, 2));
    console.log(`   ✅ Saved (${columns.length} columns, ${policies.length} policies)`);
  }
  
  console.log(`\n✅ Exported ${tables.length} tables to: ${OUTPUT_DIR}`);
  console.log('\n💡 For complete schema details, run SQL queries from supabase/queries/');
}

main().catch(console.error);
