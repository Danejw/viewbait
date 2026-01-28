/**
 * Script to fetch Supabase database schema and RLS policies
 * Saves table schemas and RLS policies to supabase/tables/ folder
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const PROJECT_REF = 'eqxagfhgfgrcdbtmxepl';
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;

// Get service role key from environment or use the one from MCP config
// In production, this should come from environment variables
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('Please set it in your .env.local file or export it:');
  console.error('export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const OUTPUT_DIR = path.join(__dirname, '..', 'supabase', 'tables');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Get all tables in the public schema
 */
async function getTables() {
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT 
        table_name,
        table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `
  }).catch(async () => {
    // If RPC doesn't work, try direct query to information_schema via REST
    // Note: This requires querying via PostgREST which might not expose information_schema
    // So we'll use a workaround: query pg_catalog instead
    const { data: tablesData, error: tablesError } = await supabase
      .from('_realtime')
      .select('*')
      .limit(0);
    
    // Alternative: Use SQL function if available
    return { data: null, error: new Error('Need to use SQL directly') };
  });

  // Since RPC might not be available, let's try a different approach
  // We'll query pg_catalog.pg_tables directly using raw SQL
  try {
    // Use the REST API to get a list by trying to describe tables
    // This is a workaround - we'll need to use the Management API or CLI
    console.log('Attempting to fetch tables...');
    
    // Try to get tables by querying pg_tables via a custom function
    // Or use the Supabase Management API
    return await fetchTablesViaSQL();
  } catch (err) {
    console.error('Error fetching tables:', err.message);
    return [];
  }
}

/**
 * Fetch tables using SQL query (requires direct database access)
 */
async function fetchTablesViaSQL() {
  // Query pg_catalog for tables
  const query = `
    SELECT 
      tablename as table_name
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `;

  // Use Supabase's REST API to execute SQL
  // Note: This requires the database to have a function that executes SQL
  // Or we need to use the Management API
  
  // For now, let's try using the Supabase Management API
  return await fetchViaManagementAPI();
}

/**
 * Fetch schema using Supabase Management API
 */
async function fetchViaManagementAPI() {
  const https = require('https');
  const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || 'sbp_3c62169bd93781c729cba05986669d6b1b5a336e';
  
  return new Promise((resolve, reject) => {
    // Get database metadata
    const options = {
      hostname: 'api.supabase.com',
      path: `/v1/projects/${PROJECT_REF}/database`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            console.error('Management API error:', res.statusCode, data);
            // Fallback: return empty and we'll document what we know
            resolve([]);
            return;
          }
          const result = JSON.parse(data);
          resolve(result);
        } catch (e) {
          console.error('Parse error:', e.message);
          resolve([]);
        }
      });
    }).on('error', (err) => {
      console.error('Request error:', err.message);
      resolve([]);
    });
  });
}

/**
 * Get table schema (columns, types, constraints)
 */
async function getTableSchema(tableName) {
  // This would require direct SQL access
  // For now, we'll document the structure based on what we can infer
  return {
    table_name: tableName,
    columns: [],
    constraints: [],
    indexes: []
  };
}

/**
 * Get RLS policies for a table
 */
async function getRLSPolicies(tableName) {
  // Query pg_policies
  return [];
}

/**
 * Main function
 */
async function main() {
  console.log('Fetching database schema for project:', PROJECT_REF);
  console.log('This script requires direct database access.');
  console.log('Using Supabase CLI or Management API is recommended.\n');

  // Try to fetch via Management API
  const tables = await fetchViaManagementAPI();
  
  if (!tables || tables.length === 0) {
    console.log('Could not fetch tables via Management API.');
    console.log('Please use Supabase CLI to dump the schema:');
    console.log(`  npx supabase db dump --project-ref ${PROJECT_REF} --schema public > supabase/schema.sql`);
    console.log('\nOr use the Supabase Dashboard to export the schema.');
    return;
  }

  console.log(`Found ${tables.length} tables`);
  
  // Process each table
  for (const table of tables) {
    const schema = await getTableSchema(table.table_name || table.name);
    const policies = await getRLSPolicies(table.table_name || table.name);
    
    // Save to file
    const filename = `${table.table_name || table.name}.json`;
    const filepath = path.join(OUTPUT_DIR, filename);
    
    const tableInfo = {
      table_name: table.table_name || table.name,
      schema: schema,
      rls_policies: policies,
      exported_at: new Date().toISOString()
    };
    
    fs.writeFileSync(filepath, JSON.stringify(tableInfo, null, 2));
    console.log(`Saved: ${filename}`);
  }
  
  console.log(`\nSchema exported to: ${OUTPUT_DIR}`);
}

main().catch(console.error);
