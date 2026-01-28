-- Helper functions for schema export
-- Run this in Supabase SQL Editor first, then run the fetch script

-- Function to get all tables
CREATE OR REPLACE FUNCTION get_all_tables()
RETURNS TABLE(table_name text, table_type text, table_comment text) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.tablename::text,
    'BASE TABLE'::text,
    COALESCE(obj_description(c.oid, 'pg_class'), '')::text
  FROM pg_catalog.pg_tables t
  LEFT JOIN pg_class c ON c.relname = t.tablename
  LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  WHERE t.schemaname = 'public'
  ORDER BY t.tablename;
END;
$$;

-- Function to get table columns
CREATE OR REPLACE FUNCTION get_table_columns(p_table_name text)
RETURNS TABLE(
  column_name text,
  data_type text,
  udt_name text,
  is_nullable text,
  column_default text,
  character_maximum_length integer,
  numeric_precision integer,
  numeric_scale integer,
  ordinal_position integer,
  column_comment text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.column_name::text,
    c.data_type::text,
    c.udt_name::text,
    c.is_nullable::text,
    COALESCE(c.column_default::text, '')::text,
    c.character_maximum_length::integer,
    c.numeric_precision::integer,
    c.numeric_scale::integer,
    c.ordinal_position::integer,
    COALESCE(pgd.description::text, '')::text
  FROM information_schema.columns c
  LEFT JOIN pg_catalog.pg_statio_all_tables st 
    ON st.schemaname = c.table_schema AND st.relname = c.table_name
  LEFT JOIN pg_catalog.pg_description pgd 
    ON pgd.objoid = st.relid AND pgd.objsubid = c.ordinal_position
  WHERE c.table_schema = 'public'
    AND c.table_name = p_table_name
  ORDER BY c.ordinal_position;
END;
$$;

-- Function to get table constraints
CREATE OR REPLACE FUNCTION get_table_constraints(p_table_name text)
RETURNS TABLE(
  constraint_name text,
  constraint_type text,
  column_name text,
  foreign_table_name text,
  foreign_column_name text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    tc.constraint_name::text,
    tc.constraint_type::text,
    COALESCE(kcu.column_name::text, '')::text,
    COALESCE(ccu.table_name::text, '')::text,
    COALESCE(ccu.column_name::text, '')::text
  FROM information_schema.table_constraints tc
  LEFT JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  LEFT JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = p_table_name
  ORDER BY tc.constraint_type, tc.constraint_name;
END;
$$;

-- Function to get RLS policies
CREATE OR REPLACE FUNCTION get_table_rls_policies(p_table_name text)
RETURNS TABLE(
  policyname text,
  permissive text,
  roles text[],
  cmd text,
  qual text,
  with_check text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.policyname::text,
    p.permissive::text,
    p.roles::text[],
    p.cmd::text,
    COALESCE(p.qual::text, '')::text,
    COALESCE(p.with_check::text, '')::text
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename = p_table_name
  ORDER BY p.policyname;
END;
$$;

-- Function to get indexes
CREATE OR REPLACE FUNCTION get_table_indexes(p_table_name text)
RETURNS TABLE(
  index_name text,
  column_name text,
  is_unique boolean,
  is_primary_key boolean,
  index_definition text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    i.relname::text,
    a.attname::text,
    ix.indisunique,
    ix.indisprimary,
    pg_get_indexdef(ix.indexrelid)::text
  FROM pg_class t
  JOIN pg_index ix ON t.oid = ix.indrelid
  JOIN pg_class i ON i.oid = ix.indexrelid
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relkind = 'r'
    AND t.relname = p_table_name
  ORDER BY i.relname, a.attnum;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_all_tables() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_table_columns(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_table_constraints(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_table_rls_policies(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_table_indexes(text) TO anon, authenticated, service_role;
