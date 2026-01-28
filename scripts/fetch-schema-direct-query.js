/**
 * Fetch schema by querying system tables directly via REST API
 * Uses service role to access pg_catalog and information_schema
 */

const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Load environment
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const PROJECT_REF = 'eqxagfhgfgrcdbtmxepl';
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
 * Execute SQL via PostgREST using a custom approach
 * We'll try to query common system views that might be exposed
 */
async function querySystemTable(query, tableName) {
  // Try to access via REST API - this usually doesn't work for system tables
  // But we can try common table names and infer schema
  return null;
}

/**
 * Try to discover tables by attempting to query them
 */
async function discoverTables() {
  console.log('🔍 Discovering tables...\n');
  
  // Common Supabase/ViewBait table names based on the codebase
  const possibleTables = [
    // Auth related
    'profiles', 'users', 'user_profiles',
    // Core app tables
    'thumbnails', 'experiments', 'analytics', 'sessions',
    // Organization/team
    'organizations', 'org_members', 'org_invites',
    // Billing
    'subscriptions', 'subscription_items', 'payments', 'invoices',
    // Referrals
    'referrals', 'referral_codes',
    // YouTube integration
    'youtube_channels', 'youtube_videos',
    // Other
    'audit_logs', 'settings', 'notifications'
  ];
  
  const foundTables = [];
  
  for (const tableName of possibleTables) {
    try {
      // Try to query with limit 0 to check if table exists
      const { error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      
      // If no error or error is RLS-related (not "does not exist"), table exists
      if (!error || (error.code !== '42P01' && !error.message.includes('does not exist'))) {
        foundTables.push(tableName);
        console.log(`  ✅ Found: ${tableName}`);
      }
    } catch (e) {
      // Table doesn't exist or not accessible
    }
  }
  
  return foundTables;
}

/**
 * Get table structure by querying a sample row
 */
async function getTableStructure(tableName) {
  try {
    // Get a sample row to infer structure
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (error) {
      // Try with different permissions or return empty
      return { columns: [], sample: null };
    }
    
    if (data && data.length > 0) {
      const sample = data[0];
      const columns = Object.keys(sample).map((key, index) => {
        const value = sample[key];
        let dataType = 'text';
        
        if (value === null) {
          dataType = 'unknown';
        } else if (typeof value === 'string') {
          // Check if it's a UUID
          if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
            dataType = 'uuid';
          } else if (value.match(/^\d{4}-\d{2}-\d{2}T/)) {
            dataType = 'timestamp';
          } else {
            dataType = 'text';
          }
        } else if (typeof value === 'number') {
          dataType = Number.isInteger(value) ? 'integer' : 'numeric';
        } else if (typeof value === 'boolean') {
          dataType = 'boolean';
        } else if (value instanceof Array) {
          dataType = 'array';
        } else if (typeof value === 'object') {
          dataType = 'jsonb';
        }
        
        return {
          column_name: key,
          data_type: dataType,
          is_nullable: value === null,
          ordinal_position: index + 1,
          sample_value: value
        };
      });
      
      return { columns, sample };
    }
    
    return { columns: [], sample: null };
  } catch (e) {
    return { columns: [], sample: null };
  }
}

/**
 * Try to get RLS policies (this is harder without SQL access)
 */
async function getRLSPolicies(tableName) {
  // Without direct SQL access, we can't easily get RLS policies
  // This would require querying pg_policies which isn't exposed via REST
  return [];
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Fetching Supabase schema (discovery mode)...\n');
  console.log(`📡 Project: ${PROJECT_REF}\n`);

  // Discover tables
  const tables = await discoverTables();
  
  if (tables.length === 0) {
    console.log('❌ No tables found via discovery.');
    console.log('\n💡 Please run the setup SQL first:');
    console.log('   1. Go to Supabase Dashboard → SQL Editor');
    console.log('   2. Run: supabase/queries/setup-helper-functions.sql');
    console.log('   3. Then run: node scripts/fetch-schema-final.js\n');
    return;
  }

  console.log(`\n📊 Processing ${tables.length} tables...\n`);

  // Process each table
  for (const tableName of tables) {
    console.log(`📋 ${tableName}...`);
    
    const { columns, sample } = await getTableStructure(tableName);
    const policies = await getRLSPolicies(tableName);
    
    const tableInfo = {
      table_name: tableName,
      table_type: 'BASE TABLE',
      schema: {
        columns: columns.map(col => ({
          column_name: col.column_name,
          data_type: col.data_type,
          is_nullable: col.is_nullable,
          ordinal_position: col.ordinal_position,
          inferred: true,
          note: 'Schema inferred from sample data. Run SQL queries for complete information.'
        })),
        constraints: [],
        indexes: []
      },
      rls_policies: policies,
      exported_at: new Date().toISOString(),
      project_ref: PROJECT_REF,
      note: 'This schema was inferred by querying the table. For complete schema with constraints, indexes, and RLS policies, please run the SQL queries from supabase/queries/ in Supabase SQL Editor.'
    };
    
    const filename = `${tableName}.json`;
    const filepath = path.join(OUTPUT_DIR, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(tableInfo, null, 2));
    console.log(`   ✅ Saved (${columns.length} columns inferred)`);
  }
  
  console.log(`\n✅ Exported ${tables.length} tables to: ${OUTPUT_DIR}`);
  console.log('\n💡 For complete schema details, run SQL queries from supabase/queries/');
}

main().catch(console.error);
