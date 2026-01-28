/**
 * Final script to fetch complete Supabase schema using service role key
 * Queries the database directly using SQL functions
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const PROJECT_REF = 'eqxagfhgfgrcdbtmxepl';
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const OUTPUT_DIR = path.join(__dirname, '..', 'supabase', 'tables');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Create helper SQL functions if they don't exist
 */
async function setupHelperFunctions() {
  console.log('🔧 Setting up helper functions...\n');
  
  const setupSQL = `
-- Function to get all tables
CREATE OR REPLACE FUNCTION get_all_tables()
RETURNS TABLE(table_name text, table_type text, table_comment text) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.tablename::text,
    'BASE TABLE'::text,
    COALESCE(obj_description(c.oid, 'pg_class'), '')::text
  FROM pg_catalog.pg_tables t
  LEFT JOIN pg_class c ON c.relname = t.tablename
  LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  WHERE t.schemaname = 'public'
  ORDER BY t.tablename;
END;
$$;

-- Function to get table columns
CREATE OR REPLACE FUNCTION get_table_columns(p_table_name text)
RETURNS TABLE(
  column_name text,
  data_type text,
  udt_name text,
  is_nullable text,
  column_default text,
  character_maximum_length integer,
  numeric_precision integer,
  numeric_scale integer,
  ordinal_position integer,
  column_comment text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.column_name::text,
    c.data_type::text,
    c.udt_name::text,
    c.is_nullable::text,
    COALESCE(c.column_default::text, '')::text,
    c.character_maximum_length::integer,
    c.numeric_precision::integer,
    c.numeric_scale::integer,
    c.ordinal_position::integer,
    COALESCE(pgd.description::text, '')::text
  FROM information_schema.columns c
  LEFT JOIN pg_catalog.pg_statio_all_tables st 
    ON st.schemaname = c.table_schema AND st.relname = c.table_name
  LEFT JOIN pg_catalog.pg_description pgd 
    ON pgd.objoid = st.relid AND pgd.objsubid = c.ordinal_position
  WHERE c.table_schema = 'public'
    AND c.table_name = p_table_name
  ORDER BY c.ordinal_position;
END;
$$;

-- Function to get table constraints
CREATE OR REPLACE FUNCTION get_table_constraints(p_table_name text)
RETURNS TABLE(
  constraint_name text,
  constraint_type text,
  column_name text,
  foreign_table_name text,
  foreign_column_name text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    tc.constraint_name::text,
    tc.constraint_type::text,
    COALESCE(kcu.column_name::text, '')::text,
    COALESCE(ccu.table_name::text, '')::text,
    COALESCE(ccu.column_name::text, '')::text
  FROM information_schema.table_constraints tc
  LEFT JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  LEFT JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = p_table_name
  ORDER BY tc.constraint_type, tc.constraint_name;
END;
$$;

-- Function to get RLS policies
CREATE OR REPLACE FUNCTION get_table_rls_policies(p_table_name text)
RETURNS TABLE(
  policyname text,
  permissive text,
  roles text[],
  cmd text,
  qual text,
  with_check text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.policyname::text,
    p.permissive::text,
    p.roles::text[],
    p.cmd::text,
    COALESCE(p.qual::text, '')::text,
    COALESCE(p.with_check::text, '')::text
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename = p_table_name
  ORDER BY p.policyname;
END;
$$;

-- Function to get indexes
CREATE OR REPLACE FUNCTION get_table_indexes(p_table_name text)
RETURNS TABLE(
  index_name text,
  column_name text,
  is_unique boolean,
  is_primary_key boolean,
  index_definition text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    i.relname::text,
    a.attname::text,
    ix.indisunique,
    ix.indisprimary,
    pg_get_indexdef(ix.indexrelid)::text
  FROM pg_class t
  JOIN pg_index ix ON t.oid = ix.indrelid
  JOIN pg_class i ON i.oid = ix.indexrelid
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relkind = 'r'
    AND t.relname = p_table_name
  ORDER BY i.relname, a.attnum;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_all_tables() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_table_columns(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_table_constraints(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_table_rls_policies(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_table_indexes(text) TO anon, authenticated, service_role;
`;

  // Execute the SQL to create functions
  // We'll need to do this via a direct SQL execution
  // For now, we'll try to call them and if they fail, provide instructions
  
  try {
    // Try to call the function - if it fails, functions don't exist
    const { error } = await supabase.rpc('get_all_tables');
    if (error && error.message.includes('does not exist')) {
      console.log('⚠️  Helper functions not found.');
      console.log('📝 Please run this SQL in Supabase SQL Editor first:\n');
      console.log(setupSQL);
      console.log('\nOr save it to: supabase/queries/setup-helper-functions.sql\n');
      return false;
    }
    return true;
  } catch (e) {
    console.log('⚠️  Helper functions not found.');
    console.log('📝 Please run the setup SQL first (see above)\n');
    return false;
  }
}

/**
 * Get all tables
 */
async function getAllTables() {
  const { data, error } = await supabase.rpc('get_all_tables');
  
  if (error) {
    throw error;
  }
  
  return data || [];
}

/**
 * Get columns for a table
 */
async function getTableColumns(tableName) {
  const { data, error } = await supabase.rpc('get_table_columns', {
    p_table_name: tableName
  });
  
  if (error) {
    console.error(`  ⚠️  Error getting columns: ${error.message}`);
    return [];
  }
  
  return data || [];
}

/**
 * Get constraints for a table
 */
async function getTableConstraints(tableName) {
  const { data, error } = await supabase.rpc('get_table_constraints', {
    p_table_name: tableName
  });
  
  if (error) {
    console.error(`  ⚠️  Error getting constraints: ${error.message}`);
    return [];
  }
  
  return data || [];
}

/**
 * Get RLS policies for a table
 */
async function getRLSPolicies(tableName) {
  const { data, error } = await supabase.rpc('get_table_rls_policies', {
    p_table_name: tableName
  });
  
  if (error) {
    console.error(`  ⚠️  Error getting RLS policies: ${error.message}`);
    return [];
  }
  
  return data || [];
}

/**
 * Get indexes for a table
 */
async function getTableIndexes(tableName) {
  const { data, error } = await supabase.rpc('get_table_indexes', {
    p_table_name: tableName
  });
  
  if (error) {
    console.error(`  ⚠️  Error getting indexes: ${error.message}`);
    return [];
  }
  
  return data || [];
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Fetching Supabase schema...\n');
  console.log(`📡 Project: ${PROJECT_REF}`);
  console.log(`🔑 Using Service Role Key\n`);

  // Check if helper functions exist
  const functionsExist = await setupHelperFunctions();
  
  if (!functionsExist) {
    // Save the setup SQL to a file
    const setupSQLPath = path.join(__dirname, '..', 'supabase', 'queries', 'setup-helper-functions.sql');
    const setupSQL = fs.readFileSync(setupSQLPath, 'utf8').includes('CREATE OR REPLACE FUNCTION get_all_tables')
      ? fs.readFileSync(setupSQLPath, 'utf8')
      : `-- Helper functions for schema export
-- Run this in Supabase SQL Editor first

CREATE OR REPLACE FUNCTION get_all_tables()
RETURNS TABLE(table_name text, table_type text, table_comment text) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.tablename::text,
    'BASE TABLE'::text,
    COALESCE(obj_description(c.oid, 'pg_class'), '')::text
  FROM pg_catalog.pg_tables t
  LEFT JOIN pg_class c ON c.relname = t.tablename
  LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  WHERE t.schemaname = 'public'
  ORDER BY t.tablename;
END;
$$;

GRANT EXECUTE ON FUNCTION get_all_tables() TO anon, authenticated, service_role;
`;

    if (!fs.existsSync(setupSQLPath) || !fs.readFileSync(setupSQLPath, 'utf8').includes('get_all_tables')) {
      fs.writeFileSync(setupSQLPath, setupSQL);
      console.log(`✅ Saved setup SQL to: ${setupSQLPath}\n`);
    }
    
    console.log('Please run the setup SQL in Supabase SQL Editor, then run this script again.\n');
    return;
  }

  // Get all tables
  console.log('📋 Fetching tables...');
  const tables = await getAllTables();
  
  if (!tables || tables.length === 0) {
    console.log('❌ No tables found.');
    return;
  }

  console.log(`✅ Found ${tables.length} tables\n`);

  // Process each table
  for (const table of tables) {
    const tableName = table.table_name;
    console.log(`📊 Processing: ${tableName}...`);
    
    const [columns, constraints, policies, indexes] = await Promise.all([
      getTableColumns(tableName),
      getTableConstraints(tableName),
      getRLSPolicies(tableName),
      getTableIndexes(tableName)
    ]);
    
    const tableInfo = {
      table_name: tableName,
      table_type: table.table_type || 'BASE TABLE',
      table_comment: table.table_comment || null,
      schema: {
        columns: columns.map(col => ({
          column_name: col.column_name,
          data_type: col.data_type,
          udt_name: col.udt_name || col.data_type,
          is_nullable: col.is_nullable === 'YES',
          column_default: col.column_default || null,
          character_maximum_length: col.character_maximum_length,
          numeric_precision: col.numeric_precision,
          numeric_scale: col.numeric_scale,
          ordinal_position: col.ordinal_position,
          column_comment: col.column_comment || null
        })),
        constraints: constraints.map(con => ({
          constraint_name: con.constraint_name,
          constraint_type: con.constraint_type,
          column_name: con.column_name || null,
          foreign_table_name: con.foreign_table_name || null,
          foreign_column_name: con.foreign_column_name || null
        })),
        indexes: indexes.map(idx => ({
          index_name: idx.index_name,
          column_name: idx.column_name,
          is_unique: idx.is_unique,
          is_primary_key: idx.is_primary_key,
          index_definition: idx.index_definition
        }))
      },
      rls_policies: policies.map(pol => ({
        policyname: pol.policyname,
        permissive: pol.permissive,
        roles: Array.isArray(pol.roles) ? pol.roles : [pol.roles].filter(Boolean),
        cmd: pol.cmd,
        qual: pol.qual || null,
        with_check: pol.with_check || null
      })),
      exported_at: new Date().toISOString(),
      project_ref: PROJECT_REF
    };
    
    const filename = `${tableName}.json`;
    const filepath = path.join(OUTPUT_DIR, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(tableInfo, null, 2));
    console.log(`   ✅ Saved: ${filename}`);
    console.log(`      - ${columns.length} columns`);
    console.log(`      - ${constraints.length} constraints`);
    console.log(`      - ${indexes.length} indexes`);
    console.log(`      - ${policies.length} RLS policies`);
  }
  
  console.log(`\n✅ Successfully exported ${tables.length} tables to: ${OUTPUT_DIR}`);
}

main().catch(console.error);
