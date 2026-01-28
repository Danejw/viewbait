# Supabase Database Schema Documentation

This directory contains the database schema and RLS policies for the ViewBait project.

## Project Information

- **Project Reference**: eqxagfhgfgrcdbtmxepl
- **Project URL**: https://eqxagfhgfgrcdbtmxepl.supabase.co
- **Last Updated**: 2026-01-28T06:45:13.297Z

## How to Generate Schema Files

### Option 1: Using Supabase SQL Editor (Recommended)

1. Go to your Supabase Dashboard → SQL Editor
2. Run the queries from `supabase/queries/`:
   - `get-schema.sql` - Get all tables
   - `get-rls-policies.sql` - Get all RLS policies
   - `get-indexes.sql` - Get all indexes
   - For each table, run `get-table-columns.sql` and `get-table-constraints.sql`
3. Export results as JSON
4. Save each table's information to `supabase/tables/<table-name>.json`

### Option 2: Using Supabase CLI

```bash
# Dump entire schema
npx supabase db dump --project-ref eqxagfhgfgrcdbtmxepl --schema public > supabase/schema.sql

# Generate TypeScript types (includes schema info)
npx supabase gen types typescript --project-id eqxagfhgfgrcdbtmxepl > types/database.ts
```

### Option 3: Using Management API

The Management API can be used to fetch database metadata programmatically.

## File Structure

Each table should have a JSON file with the following structure:

```json
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
```

## Notes

- All tables in the `public` schema are documented here
- RLS policies are critical for security - ensure all policies are documented
- Keep this documentation up to date when making schema changes
