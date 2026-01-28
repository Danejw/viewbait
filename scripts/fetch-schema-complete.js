/**
 * Complete script to fetch Supabase database schema and RLS policies
 * Uses Supabase JavaScript client with service role key
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const PROJECT_REF = 'eqxagfhgfgrcdbtmxepl';
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('\nPlease set it:');
  console.error('  $env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
  console.error('  node scripts/fetch-schema-complete.js\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

const OUTPUT_DIR = path.join(__dirname, '..', 'supabase', 'tables');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Get all tables using a custom RPC function or direct query
 */
async function getAllTables() {
  try {
    // Try to query pg_tables via a custom function
    // First, let's try to create a simple function if it doesn't exist
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION get_all_tables()
      RETURNS TABLE(table_name text, table_type text) 
      LANGUAGE sql
      SECURITY DEFINER
      AS $$
        SELECT tablename::text, 'BASE TABLE'::text
        FROM pg_catalog.pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename;
      $$;
    `;

    // Execute the function creation (this requires direct SQL access)
    // For now, we'll try to use the REST API to call an existing function
    // or we'll need to manually create this function first
    
    // Alternative: Try to query information_schema via REST if exposed
    // This typically doesn't work, so we'll need another approach
    
    console.log('⚠️  Direct SQL queries require database access.');
    console.log('Creating SQL file to set up helper functions...\n');
    
    return null;
  } catch (error) {
    console.error('Error getting tables:', error.message);
    return null;
  }
}

/**
 * Create SQL setup file for helper functions
 */
function createHelperFunctionsSQL() {
  const sqlPath = path.join(__dirname, '..', 'supabase', 'queries', 'setup-helper-functions.sql');
  const sql = `-- Helper functions to query schema information
-- Run this in Supabase SQL Editor first, then use the fetch script

-- Function to get all tables
CREATE OR REPLACE FUNCTION get_all_tables()
RETURNS TABLE(table_name text, table_type text) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT tablename::text, 'BASE TABLE'::text
  FROM pg_catalog.pg_tables
  WHERE schemaname = 'public'
  ORDER BY tablename;
$$;

-- Function to get table columns
CREATE OR REPLACE FUNCTION get_table_columns(p_table_name text)
RETURNS TABLE(
  column_name text,
  data_type text,
  is_nullable text,
  column_default text,
  ordinal_position integer
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    c.column_name::text,
    c.data_type::text,
    c.is_nullable::text,
    COALESCE(c.column_default::text, '')::text,
    c.ordinal_position::integer
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = p_table_name
  ORDER BY c.ordinal_position;
$$;

-- Function to get RLS policies for a table
CREATE OR REPLACE FUNCTION get_table_rls_policies(p_table_name text)
RETURNS TABLE(
  policyname text,
  cmd text,
  qual text,
  with_check text,
  roles text[]
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    p.policyname::text,
    p.cmd::text,
    COALESCE(p.qual::text, '')::text,
    COALESCE(p.with_check::text, '')::text,
    p.roles::text[]
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename = p_table_name
  ORDER BY p.policyname;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_all_tables() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_table_columns(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_table_rls_policies(text) TO anon, authenticated;
`;

  fs.writeFileSync(sqlPath, sql);
  console.log('✅ Created setup-helper-functions.sql');
  console.log('   Run this in Supabase SQL Editor first!\n');
}

/**
 * Fetch tables using RPC function
 */
async function fetchTablesViaRPC() {
  try {
    const { data, error } = await supabase.rpc('get_all_tables');
    
    if (error) {
      if (error.message.includes('function') && error.message.includes('does not exist')) {
        console.log('⚠️  Helper functions not found. Creating setup SQL...\n');
        createHelperFunctionsSQL();
        return null;
      }
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching tables via RPC:', error.message);
    return null;
  }
}

/**
 * Fetch table columns via RPC
 */
async function fetchTableColumns(tableName) {
  try {
    const { data, error } = await supabase.rpc('get_table_columns', {
      p_table_name: tableName
    });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error(`Error fetching columns for ${tableName}:`, error.message);
    return [];
  }
}

/**
 * Fetch RLS policies via RPC
 */
async function fetchRLSPolicies(tableName) {
  try {
    const { data, error } = await supabase.rpc('get_table_rls_policies', {
      p_table_name: tableName
    });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error(`Error fetching RLS policies for ${tableName}:`, error.message);
    return [];
  }
}

/**
 * Fetch constraints for a table (requires direct SQL)
 */
async function fetchConstraints(tableName) {
  // This would require a more complex query
  // For now, return empty array
  return [];
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Fetching Supabase schema for project:', PROJECT_REF);
  console.log('📡 Using Supabase REST API with service role key\n');

  // Try to fetch tables
  let tables = await fetchTablesViaRPC();
  
  if (!tables || tables.length === 0) {
    console.log('📝 Instructions:');
    console.log('1. Go to Supabase Dashboard → SQL Editor');
    console.log('2. Run the SQL from: supabase/queries/setup-helper-functions.sql');
    console.log('3. Then run this script again\n');
    
    // Still create the structure
    createHelperFunctionsSQL();
    return;
  }

  console.log(`✅ Found ${tables.length} tables\n`);

  // Process each table
  for (const table of tables) {
    const tableName = table.table_name;
    console.log(`📋 Processing: ${tableName}...`);
    
    const columns = await fetchTableColumns(tableName);
    const policies = await fetchRLSPolicies(tableName);
    const constraints = await fetchConstraints(tableName);
    
    const tableInfo = {
      table_name: tableName,
      schema: {
        columns: columns,
        constraints: constraints,
        indexes: [] // Would need another function for this
      },
      rls_policies: policies,
      exported_at: new Date().toISOString(),
      project_ref: PROJECT_REF
    };
    
    const filename = `${tableName}.json`;
    const filepath = path.join(OUTPUT_DIR, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(tableInfo, null, 2));
    console.log(`   ✅ Saved: ${filename} (${columns.length} columns, ${policies.length} policies)`);
  }
  
  console.log(`\n✅ Schema exported to: ${OUTPUT_DIR}`);
  console.log(`📊 Total tables: ${tables.length}`);
}

main().catch(console.error);
