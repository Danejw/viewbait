-- Query to get all columns for a specific table
-- Replace 'your_table_name' with the actual table name
-- Run this for each table

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
    AND c.table_name = 'your_table_name'  -- Replace with actual table name
ORDER BY c.ordinal_position;
