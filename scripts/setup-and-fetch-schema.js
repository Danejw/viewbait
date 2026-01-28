/**
 * Complete setup and fetch script
 * First sets up helper functions, then fetches complete schema
 */

const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const PROJECT_REF = 'eqxagfhgfgrcdbtmxepl';
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || 'sbp_3c62169bd93781c729cba05986669d6b1b5a336e';

if (!SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const OUTPUT_DIR = path.join(__dirname, '..', 'supabase', 'tables');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Try to execute SQL via Management API
 */
async function executeSQLViaAPI(sql) {
  return new Promise((resolve) => {
    // Management API doesn't have a direct SQL execution endpoint
    // We'll need to use the Supabase Dashboard or CLI
    resolve({ success: false, message: 'Management API does not support direct SQL execution' });
  });
}

/**
 * Check if helper functions exist
 */
async function checkHelperFunctions() {
  try {
    const { error } = await supabase.rpc('get_all_tables');
    return !error;
  } catch (e) {
    return false;
  }
}

/**
 * Get all tables using helper function
 */
async function getAllTables() {
  const { data, error } = await supabase.rpc('get_all_tables');
  if (error) throw error;
  return data || [];
}

/**
 * Get complete table information
 */
async function getCompleteTableInfo(tableName) {
  const [columnsResult, constraintsResult, policiesResult, indexesResult] = await Promise.all([
    supabase.rpc('get_table_columns', { p_table_name: tableName }),
    supabase.rpc('get_table_constraints', { p_table_name: tableName }),
    supabase.rpc('get_table_rls_policies', { p_table_name: tableName }),
    supabase.rpc('get_table_indexes', { p_table_name: tableName })
  ]);

  return {
    columns: columnsResult.data || [],
    constraints: constraintsResult.data || [],
    policies: policiesResult.data || [],
    indexes: indexesResult.data || []
  };
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Setting up and fetching complete Supabase schema...\n');
  console.log(`📡 Project: ${PROJECT_REF}\n`);

  // Check if helper functions exist
  console.log('🔍 Checking for helper functions...');
  const functionsExist = await checkHelperFunctions();

  if (!functionsExist) {
    console.log('❌ Helper functions not found.\n');
    console.log('📝 To set up helper functions:\n');
    console.log('   1. Go to: https://supabase.com/dashboard/project/' + PROJECT_REF + '/sql/new');
    console.log('   2. Copy and paste the SQL from: supabase/queries/setup-helper-functions.sql');
    console.log('   3. Click "Run"');
    console.log('   4. Then run this script again: node scripts/setup-and-fetch-schema.js\n');
    
    // Show the SQL file path
    const sqlPath = path.join(__dirname, '..', 'supabase', 'queries', 'setup-helper-functions.sql');
    if (fs.existsSync(sqlPath)) {
      console.log('📄 SQL file location:', sqlPath);
      console.log('\n--- SQL to run ---\n');
      console.log(fs.readFileSync(sqlPath, 'utf8').substring(0, 500) + '...\n');
    }
    
    return;
  }

  console.log('✅ Helper functions found!\n');

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
    console.log(`📊 ${tableName}...`);
    
    try {
      const { columns, constraints, policies, indexes } = await getCompleteTableInfo(tableName);
      
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
      console.log(`   ✅ Saved: ${columns.length} cols, ${constraints.length} constraints, ${indexes.length} indexes, ${policies.length} policies`);
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }
  
  console.log(`\n✅ Successfully exported ${tables.length} tables to: ${OUTPUT_DIR}`);
}

main().catch(console.error);
