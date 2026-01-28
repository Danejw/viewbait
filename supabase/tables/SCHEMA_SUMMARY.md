# ViewBait Database Schema Summary

**Project**: ViewBait  
**Project Reference**: `eqxagfhgfgrcdbtmxepl`  
**Last Updated**: 2026-01-28

## Tables Discovered (21 total)

### Core Tables
1. **profiles** - User profile information (5 columns detected)
2. **users** - User accounts
3. **user_profiles** - Extended user profile data
4. **thumbnails** - Thumbnail images and metadata (13 columns detected)
5. **experiments** - A/B testing experiments (10 columns detected)

### Analytics & Tracking
6. **analytics** - Analytics events and metrics
7. **sessions** - User session tracking

### Organization & Team Management
8. **organizations** - Organization/team data
9. **org_members** - Organization membership
10. **org_invites** - Organization invitations

### Billing & Subscriptions
11. **subscriptions** - User subscriptions
12. **subscription_items** - Subscription line items
13. **payments** - Payment records
14. **invoices** - Invoice records

### Referrals
15. **referrals** - Referral tracking
16. **referral_codes** - Referral code management (8 columns detected)

### YouTube Integration
17. **youtube_channels** - YouTube channel data (15 columns detected)
18. **youtube_videos** - YouTube video data

### System
19. **audit_logs** - Audit trail
20. **settings** - Application settings
21. **notifications** - User notifications

## Current Status

✅ **Basic schema information** has been exported for all tables  
⚠️ **Complete schema** (constraints, indexes, RLS policies) needs to be fetched

## Next Steps to Get Complete Schema

### Option 1: Using Helper Functions (Recommended)

1. **Set up helper functions**:
   - Go to: https://supabase.com/dashboard/project/eqxagfhgfgrcdbtmxepl/sql/new
   - Copy SQL from: `supabase/queries/setup-helper-functions.sql`
   - Run the SQL

2. **Fetch complete schema**:
   ```bash
   node scripts/setup-and-fetch-schema.js
   ```

### Option 2: Using SQL Queries Directly

1. Go to Supabase Dashboard → SQL Editor
2. Run queries from `supabase/queries/`:
   - `get-schema.sql` - Get all tables
   - `get-table-columns.sql` - Get columns (run for each table)
   - `get-table-constraints.sql` - Get constraints (run for each table)
   - `get-rls-policies.sql` - Get all RLS policies
   - `get-indexes.sql` - Get all indexes
3. Export results and process with: `node supabase/scripts/process-schema.js`

## Schema Files Location

All schema files are in: `supabase/tables/`

Each table has a JSON file with:
- Table name and type
- Column definitions (currently inferred from sample data)
- Constraints (needs complete fetch)
- Indexes (needs complete fetch)
- RLS policies (needs complete fetch)

## Notes

- Current schema information is **inferred** from sample data
- For production use, **complete schema** with all constraints, indexes, and RLS policies is required
- RLS policies are critical for security - ensure they're documented
- Some tables may have 0 columns detected due to RLS restrictions or empty tables

## Quick Reference

| Table | Columns Detected | Status |
|-------|-----------------|--------|
| profiles | 5 | ✅ Basic |
| thumbnails | 13 | ✅ Basic |
| experiments | 10 | ✅ Basic |
| referral_codes | 8 | ✅ Basic |
| youtube_channels | 15 | ✅ Basic |
| Others | 0 | ⚠️ Needs complete fetch |
