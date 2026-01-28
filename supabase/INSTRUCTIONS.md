# How to Export Supabase Schema and RLS Policies

This guide will help you export all table schemas and RLS policies from your ViewBait Supabase project.

## Project Information

- **Project Reference**: `eqxagfhgfgrcdbtmxepl`
- **Project URL**: `https://eqxagfhgfgrcdbtmxepl.supabase.co`

## Method 1: Using Supabase SQL Editor (Recommended)

### Step 1: Get All Tables

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/eqxagfhgfgrcdbtmxepl)
2. Navigate to **SQL Editor**
3. Run the query from `supabase/queries/get-schema.sql`
4. Click **Export** → **Export as JSON**
5. Save the file as `supabase/raw-data/tables.json`

### Step 2: Get Table Columns

For each table found in Step 1:

1. Open `supabase/queries/get-table-columns.sql`
2. Replace `'your_table_name'` with the actual table name
3. Run the query in SQL Editor
4. Export as JSON
5. Save as `supabase/raw-data/columns-<table_name>.json`

**Tip**: You can modify the query to get all columns at once:

```sql
SELECT 
    c.table_name,
    c.column_name,
    c.ordinal_position,
    c.column_default,
    c.is_nullable,
    c.data_type,
    c.character_maximum_length,
    c.numeric_precision,
    c.numeric_scale,
    c.udt_name,
    pgd.description as column_comment
FROM information_schema.columns c
LEFT JOIN pg_catalog.pg_statio_all_tables st ON st.schemaname = c.table_schema AND st.relname = c.table_name
LEFT JOIN pg_catalog.pg_description pgd ON pgd.objoid = st.relid AND pgd.objsubid = c.ordinal_position
WHERE c.table_schema = 'public'
ORDER BY c.table_name, c.ordinal_position;
```

Save this as `supabase/raw-data/all-columns.json` and the processing script can handle it.

### Step 3: Get Table Constraints

1. Open `supabase/queries/get-table-constraints.sql`
2. Replace `'your_table_name'` with the actual table name
3. Run the query in SQL Editor
4. Export as JSON
5. Save as `supabase/raw-data/constraints-<table_name>.json`

Or get all constraints at once:

```sql
SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
LEFT JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type;
```

### Step 4: Get RLS Policies

1. Run the query from `supabase/queries/get-rls-policies.sql`
2. Export as JSON
3. Save as `supabase/raw-data/rls-policies.json`

### Step 5: Get Indexes

1. Run the query from `supabase/queries/get-indexes.sql`
2. Export as JSON
3. Save as `supabase/raw-data/indexes.json`

### Step 6: Process the Data

Once you have all the JSON files in `supabase/raw-data/`:

```bash
node supabase/scripts/process-schema.js
```

This will create organized JSON files in `supabase/tables/` for each table.

## Method 2: Using Supabase CLI

### Step 1: Link Your Project

```bash
cd a:\viewbait_v2\viewbait
npx supabase link --project-ref eqxagfhgfgrcdbtmxepl
```

You'll need to authenticate with your Supabase access token.

### Step 2: Dump the Schema

```bash
npx supabase db dump --schema public --file supabase/schema-dump.sql
```

### Step 3: Parse the SQL Dump

The SQL dump contains CREATE TABLE statements and RLS policies. You can parse it manually or use a script to extract the information.

## Method 3: Using Management API (Programmatic)

If you have the service role key, you can use the script:

```bash
# Set your service role key
$env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Run the script
node scripts/fetch-schema-complete.js
```

**Note**: This requires setting up helper functions in your database first (see `supabase/queries/setup-helper-functions.sql`).

## Quick All-in-One SQL Query

You can also run this comprehensive query to get most information at once:

```sql
-- Get comprehensive schema information
WITH table_info AS (
  SELECT 
    t.table_name,
    COUNT(DISTINCT c.column_name) as column_count,
    COUNT(DISTINCT tc.constraint_name) as constraint_count,
    COUNT(DISTINCT p.policyname) as policy_count
  FROM information_schema.tables t
  LEFT JOIN information_schema.columns c ON c.table_name = t.table_name AND c.table_schema = 'public'
  LEFT JOIN information_schema.table_constraints tc ON tc.table_name = t.table_name AND tc.table_schema = 'public'
  LEFT JOIN pg_policies p ON p.tablename = t.table_name AND p.schemaname = 'public'
  WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
  GROUP BY t.table_name
)
SELECT * FROM table_info ORDER BY table_name;
```

## File Structure

After processing, you should have:

```
supabase/
├── queries/           # SQL queries to run
├── raw-data/         # Exported JSON from SQL Editor
│   ├── tables.json
│   ├── columns-*.json
│   ├── constraints-*.json
│   ├── rls-policies.json
│   └── indexes.json
└── tables/           # Processed table schemas
    ├── table1.json
    ├── table2.json
    └── ...
```

Each table JSON file contains:
- Table name and metadata
- Complete column definitions
- Constraints (PK, FK, unique, check)
- Indexes
- RLS policies
- Export timestamp

## Troubleshooting

### Permission Errors

If you get permission errors:
1. Ensure you're using the correct access token
2. Check that your token has the right scopes
3. Try using the Supabase Dashboard SQL Editor instead

### Missing Tables

If some tables are missing:
1. Check that you're querying the `public` schema
2. Verify table names are correct
3. Ensure RLS isn't blocking your queries (use service role if needed)

### RLS Policies Not Showing

RLS policies are stored in `pg_policies`. If they're not showing:
1. Ensure you're querying with appropriate permissions
2. Check that RLS is enabled on the tables
3. Verify you're querying the correct schema
