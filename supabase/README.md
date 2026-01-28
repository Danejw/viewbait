# Supabase Database Schema Documentation

This directory contains tools and documentation for exporting and managing the ViewBait Supabase database schema and RLS policies.

## 📁 Directory Structure

```
supabase/
├── README.md                    # This file
├── INSTRUCTIONS.md              # Detailed instructions for exporting schema
├── queries/                     # SQL queries to run in Supabase SQL Editor
│   ├── get-schema.sql          # Get all tables
│   ├── get-table-columns.sql   # Get columns for a table
│   ├── get-table-constraints.sql # Get constraints for a table
│   ├── get-rls-policies.sql    # Get all RLS policies
│   └── get-indexes.sql         # Get all indexes
├── scripts/                      # Processing scripts
│   └── process-schema.js       # Process exported JSON data
├── tables/                       # Output: Table schema files (one per table)
│   ├── README.md               # Documentation for table files
│   └── _template.json          # Example structure
└── raw-data/                    # Input: Exported JSON from SQL Editor (create this)
```

## 🚀 Quick Start

### Option 1: Using Supabase SQL Editor (Easiest)

1. **Go to Supabase Dashboard** → SQL Editor
2. **Run queries** from `queries/` folder:
   - Start with `get-schema.sql` to get all tables
   - For each table, run `get-table-columns.sql` and `get-table-constraints.sql`
   - Run `get-rls-policies.sql` and `get-indexes.sql` once
3. **Export results** as JSON and save to `raw-data/` folder
4. **Process the data**:
   ```bash
   node supabase/scripts/process-schema.js
   ```

### Option 2: Using Supabase CLI

```bash
# Link project (first time only)
npx supabase link --project-ref eqxagfhgfgrcdbtmxepl

# Dump schema
npx supabase db dump --schema public --file supabase/schema-dump.sql
```

See [INSTRUCTIONS.md](./INSTRUCTIONS.md) for detailed steps.

## 📊 Project Information

- **Project Reference**: `eqxagfhgfgrcdbtmxepl`
- **Project URL**: `https://eqxagfhgfgrcdbtmxepl.supabase.co`
- **Schema**: `public`

## 📝 Table Schema Format

Each table file in `tables/` follows this structure:

```json
{
  "table_name": "example_table",
  "table_type": "BASE TABLE",
  "table_comment": null,
  "schema": {
    "columns": [
      {
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": false,
        "column_default": "gen_random_uuid()",
        "ordinal_position": 1
      }
    ],
    "constraints": [
      {
        "constraint_name": "example_table_pkey",
        "constraint_type": "PRIMARY KEY",
        "column_name": "id"
      }
    ],
    "indexes": []
  },
  "rls_policies": [
    {
      "policyname": "Users can view own rows",
      "cmd": "SELECT",
      "qual": "(user_id = auth.uid())"
    }
  ],
  "exported_at": "2026-01-27T00:00:00.000Z",
  "project_ref": "eqxagfhgfgrcdbtmxepl"
}
```

## 🔒 RLS Policies

All RLS policies are documented in each table's JSON file. This is critical for:
- Understanding security boundaries
- Debugging access issues
- Auditing permissions
- Onboarding new developers

## 🔄 Keeping Schema Updated

When you make database changes:

1. **Update the schema files** by re-running the export process
2. **Commit the changes** to version control
3. **Document any breaking changes** in commit messages

## 🛠️ Troubleshooting

### Permission Errors

If you encounter permission errors:
- Use the Supabase Dashboard SQL Editor (has full access)
- Ensure you're using the correct access token
- Check that your token has the right scopes

### Missing Tables

- Verify you're querying the `public` schema
- Check that tables exist in the database
- Ensure RLS isn't blocking queries (use service role if needed)

See [INSTRUCTIONS.md](./INSTRUCTIONS.md) for more troubleshooting tips.

## 📚 Related Documentation

- [Database Security Principles](../../docs/database_security_principles.md) - RLS and security guidelines
- [Project Architecture](../../agentics/ARCHITECTURE.md) - Overall system architecture
- [Supabase Documentation](https://supabase.com/docs) - Official Supabase docs
