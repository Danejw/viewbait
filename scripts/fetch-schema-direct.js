/**
 * Script to fetch Supabase database schema and RLS policies directly
 * Uses Supabase REST API and Management API
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const PROJECT_REF = 'eqxagfhgfgrcdbtmxepl';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || 'sbp_3c62169bd93781c729cba05986669d6b1b5a336e';
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;

const OUTPUT_DIR = path.join(__dirname, '..', 'supabase', 'tables');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Make HTTPS request
 */
function httpsRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
          } else {
            resolve({ statusCode: res.statusCode, data: data, error: true });
          }
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: data, error: true });
        }
      });
    });

    req.on('error', reject);
    
    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

/**
 * Get project information from Management API
 */
async function getProjectInfo() {
  const options = {
    hostname: 'api.supabase.com',
    path: `/v1/projects/${PROJECT_REF}`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };

  return await httpsRequest(options);
}

/**
 * Execute SQL query via Supabase REST API (if RPC function exists)
 * Note: This requires a custom RPC function to execute SQL
 */
async function executeSQL(query) {
  // This would require a custom RPC function in the database
  // For now, we'll return instructions
  return null;
}

/**
 * Main function - creates documentation structure
 */
async function main() {
  console.log('Fetching Supabase schema for project:', PROJECT_REF);
  console.log('Using Management API and SQL queries...\n');

  // Get project info
  console.log('Fetching project information...');
  const projectInfo = await getProjectInfo();
  
  if (projectInfo.error || projectInfo.statusCode !== 200) {
    console.error('Could not fetch project info. Status:', projectInfo.statusCode);
    console.error('Response:', projectInfo.data);
    console.log('\nPlease ensure:');
    console.log('1. SUPABASE_ACCESS_TOKEN is set correctly');
    console.log('2. The access token has proper permissions');
    console.log('3. The project reference is correct\n');
    
    // Create a template structure anyway
    createTemplateStructure();
    return;
  }

  console.log('Project found:', projectInfo.data.name || PROJECT_REF);
  
  // Create README with instructions
  createReadme();
  
  // Create template files for each query result
  createTemplateStructure();
  
  console.log('\n✅ Schema documentation structure created!');
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
  console.log('\n📝 Next steps:');
  console.log('1. Run the SQL queries in supabase/queries/ in your Supabase SQL Editor');
  console.log('2. Export the results as JSON');
  console.log('3. Save each result to the corresponding file in supabase/tables/');
  console.log('\nOr use Supabase CLI:');
  console.log(`  npx supabase db dump --project-ref ${PROJECT_REF} --schema public > supabase/schema.sql`);
}

/**
 * Create README with instructions
 */
function createReadme() {
  const readmePath = path.join(OUTPUT_DIR, 'README.md');
  const readmeContent = `# Supabase Database Schema Documentation

This directory contains the database schema and RLS policies for the ViewBait project.

## Project Information

- **Project Reference**: ${PROJECT_REF}
- **Project URL**: ${SUPABASE_URL}
- **Last Updated**: ${new Date().toISOString()}

## How to Generate Schema Files

### Option 1: Using Supabase SQL Editor (Recommended)

1. Go to your Supabase Dashboard → SQL Editor
2. Run the queries from \`supabase/queries/\`:
   - \`get-schema.sql\` - Get all tables
   - \`get-rls-policies.sql\` - Get all RLS policies
   - \`get-indexes.sql\` - Get all indexes
   - For each table, run \`get-table-columns.sql\` and \`get-table-constraints.sql\`
3. Export results as JSON
4. Save each table's information to \`supabase/tables/<table-name>.json\`

### Option 2: Using Supabase CLI

\`\`\`bash
# Dump entire schema
npx supabase db dump --project-ref ${PROJECT_REF} --schema public > supabase/schema.sql

# Generate TypeScript types (includes schema info)
npx supabase gen types typescript --project-id ${PROJECT_REF} > types/database.ts
\`\`\`

### Option 3: Using Management API

The Management API can be used to fetch database metadata programmatically.

## File Structure

Each table should have a JSON file with the following structure:

\`\`\`json
{
  "table_name": "table_name",
  "schema": {
    "columns": [...],
    "constraints": [...],
    "indexes": [...]
  },
  "rls_policies": [...],
  "exported_at": "2026-01-27T00:00:00.000Z"
}
\`\`\`

## Notes

- All tables in the \`public\` schema are documented here
- RLS policies are critical for security - ensure all policies are documented
- Keep this documentation up to date when making schema changes
`;

  fs.writeFileSync(readmePath, readmeContent);
  console.log('Created README.md');
}

/**
 * Create template structure
 */
function createTemplateStructure() {
  // Create a template JSON file showing the expected structure
  const templatePath = path.join(OUTPUT_DIR, '_template.json');
  const template = {
    table_name: "example_table",
    schema: {
      columns: [
        {
          column_name: "id",
          data_type: "uuid",
          is_nullable: "NO",
          column_default: "gen_random_uuid()",
          ordinal_position: 1
        },
        {
          column_name: "created_at",
          data_type: "timestamp with time zone",
          is_nullable: "NO",
          column_default: "now()",
          ordinal_position: 2
        }
      ],
      constraints: [
        {
          constraint_name: "example_table_pkey",
          constraint_type: "PRIMARY KEY",
          column_name: "id"
        }
      ],
      indexes: [
        {
          index_name: "example_table_created_at_idx",
          column_name: "created_at",
          is_unique: false
        }
      ]
    },
    rls_policies: [
      {
        policyname: "Users can view own rows",
        cmd: "SELECT",
        qual: "(user_id = auth.uid())",
        with_check: null
      }
    ],
    exported_at: new Date().toISOString()
  };

  fs.writeFileSync(templatePath, JSON.stringify(template, null, 2));
  console.log('Created _template.json (example structure)');
}

main().catch(console.error);
