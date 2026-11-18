/**
 * Attempt to fetch schema using available methods
 */

const https = require('https');

const PROJECT_REF = 'eqxagfhgfgrcdbtmxepl';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error('Error: SUPABASE_ACCESS_TOKEN environment variable is required');
  process.exit(1);
}

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.supabase.com',
      path: path,
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
          resolve({
            status: res.statusCode,
            data: JSON.parse(data),
            raw: data
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data,
            raw: data,
            error: e.message
          });
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('Trying to fetch project information...\n');

  // Try to get project info
  const project = await makeRequest(`/v1/projects/${PROJECT_REF}`);
  console.log('Project Info:', project.status);
  if (project.status === 200) {
    console.log('Project Name:', project.data.name);
    console.log('Database URL:', project.data.db_url ? 'Found' : 'Not in response');
  } else {
    console.log('Error:', project.raw);
  }

  // Try to get database metadata (if endpoint exists)
  console.log('\nTrying database metadata endpoint...');
  const dbMeta = await makeRequest(`/v1/projects/${PROJECT_REF}/database`);
  console.log('Database Metadata:', dbMeta.status);
  if (dbMeta.status === 200) {
    console.log('Response:', JSON.stringify(dbMeta.data, null, 2));
  } else {
    console.log('Response:', dbMeta.raw.substring(0, 200));
  }

  console.log('\n✅ Check complete. Use SQL Editor method for full schema export.');
}

main().catch(console.error);
