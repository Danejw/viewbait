-- Query to get all tables in the public schema
-- Run this in Supabase SQL Editor to get table information

-- Get all tables
SELECT 
    t.table_name,
    t.table_type,
    obj_description(c.oid, 'pg_class') as table_comment
FROM information_schema.tables t
LEFT JOIN pg_class c ON c.relname = t.table_name
LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name;
