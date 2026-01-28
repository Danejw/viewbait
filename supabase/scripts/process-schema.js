/**
 * Script to process schema data exported from Supabase SQL Editor
 * 
 * Usage:
 * 1. Run the SQL queries from supabase/queries/ in Supabase SQL Editor
 * 2. Export results as JSON
 * 3. Save them in supabase/raw-data/ folder
 * 4. Run this script to process and organize the data
 */

const fs = require('fs');
const path = require('path');

const RAW_DATA_DIR = path.join(__dirname, '..', 'raw-data');
const TABLES_DIR = path.join(__dirname, '..', 'tables');

// Ensure directories exist
[RAW_DATA_DIR, TABLES_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * Process tables data
 */
function processTables() {
  const tablesFile = path.join(RAW_DATA_DIR, 'tables.json');
  if (!fs.existsSync(tablesFile)) {
    console.log('⚠️  tables.json not found in raw-data/');
    return [];
  }
  
  const tables = JSON.parse(fs.readFileSync(tablesFile, 'utf8'));
  return Array.isArray(tables) ? tables : [];
}

/**
 * Process columns for all tables
 */
async function processAllTables() {
  const tables = processTables();
  
  if (tables.length === 0) {
    console.log('No tables found. Please export tables.json from SQL Editor first.');
    return;
  }

  console.log(`Processing ${tables.length} tables...\n`);

  for (const table of tables) {
    const tableName = table.table_name;
    console.log(`Processing: ${tableName}`);

    // Load columns
    const columnsFile = path.join(RAW_DATA_DIR, `columns-${tableName}.json`);
    let columns = [];
    if (fs.existsSync(columnsFile)) {
      columns = JSON.parse(fs.readFileSync(columnsFile, 'utf8'));
      columns = Array.isArray(columns) ? columns : [];
    }

    // Load constraints
    const constraintsFile = path.join(RAW_DATA_DIR, `constraints-${tableName}.json`);
    let constraints = [];
    if (fs.existsSync(constraintsFile)) {
      constraints = JSON.parse(fs.readFileSync(constraintsFile, 'utf8'));
      constraints = Array.isArray(constraints) ? constraints : [];
    }

    // Load indexes
    const indexesFile = path.join(RAW_DATA_DIR, `indexes.json`);
    let indexes = [];
    if (fs.existsSync(indexesFile)) {
      const allIndexes = JSON.parse(fs.readFileSync(indexesFile, 'utf8'));
      indexes = Array.isArray(allIndexes) 
        ? allIndexes.filter(idx => idx.table_name === tableName)
        : [];
    }

    // Load RLS policies (from the global RLS query)
    const rlsFile = path.join(RAW_DATA_DIR, 'rls-policies.json');
    let policies = [];
    if (fs.existsSync(rlsFile)) {
      const allPolicies = JSON.parse(fs.readFileSync(rlsFile, 'utf8'));
      policies = Array.isArray(allPolicies)
        ? allPolicies.filter(p => p.tablename === tableName)
        : [];
    }

    // Create table info object
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
          column_default: col.column_default,
          character_maximum_length: col.character_maximum_length,
          numeric_precision: col.numeric_precision,
          numeric_scale: col.numeric_scale,
          ordinal_position: col.ordinal_position,
          column_comment: col.column_comment || null
        })),
        constraints: constraints.map(con => ({
          constraint_name: con.constraint_name,
          constraint_type: con.constraint_type,
          column_name: con.column_name,
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
        roles: pol.roles,
        cmd: pol.cmd,
        qual: pol.qual,
        with_check: pol.with_check
      })),
      exported_at: new Date().toISOString(),
      project_ref: 'eqxagfhgfgrcdbtmxepl'
    };

    // Save to tables directory
    const outputFile = path.join(TABLES_DIR, `${tableName}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(tableInfo, null, 2));
    console.log(`  ✅ Saved: ${tableName}.json`);
  }

  console.log(`\n✅ Processed ${tables.length} tables`);
  console.log(`📁 Output: ${TABLES_DIR}`);
}

// Run
processAllTables().catch(console.error);
