/**
 * Cookie Utilities
 * 
 * Helper functions for managing browser cookies, particularly for Supabase auth.
 */

/**
 * Manually clears all Supabase authentication cookies
 * This is used as a fallback when supabase.auth.signOut() hangs or fails
 */
export function clearSupabaseCookies(): void {
  // Extract project ref from Supabase URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    console.warn('NEXT_PUBLIC_SUPABASE_URL not found, cannot clear cookies');
    return;
  }

  // Extract project ref from URL (e.g., https://xyzabc.supabase.co -> xyzabc)
  const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
  if (!urlMatch) {
    console.warn('Could not extract project ref from Supabase URL');
    return;
  }

  const projectRef = urlMatch[1];
  
  // Supabase cookie patterns
  const cookiePatterns = [
    `sb-${projectRef}-auth-token`,
    `sb-${projectRef}-auth-token-code-verifier`,
  ];

  // Clear all matching cookies
  cookiePatterns.forEach((cookieName) => {
    // Clear for current path
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    // Clear for root path
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
    // Clear without domain (for localhost)
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=;`;
  });
}
