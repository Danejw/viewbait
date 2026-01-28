-- Query to get all indexes for tables in the public schema

SELECT
    t.relname AS table_name,
    i.relname AS index_name,
    a.attname AS column_name,
    ix.indisunique AS is_unique,
    ix.indisprimary AS is_primary_key,
    pg_get_indexdef(ix.indexrelid) AS index_definition
FROM pg_class t
JOIN pg_index ix ON t.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
    AND t.relkind = 'r'  -- Only regular tables
ORDER BY t.relname, i.relname, a.attnum;
