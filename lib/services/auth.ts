/**
 * Authentication Service
 * 
 * Handles all authentication operations using Supabase Auth.
 * Supports email/password and Google OAuth authentication.
 */

import { createClient } from '@/lib/supabase/client'
import type { User, Session, AuthError } from '@supabase/supabase-js'

export interface AuthResult {
  user: User | null
  session: Session | null
  error: AuthError | null
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  const supabase = createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  const result = {
    user: data.user,
    session: data.session,
    error,
  };
  return result;
}

/**
 * Sign up with email and password
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  metadata?: { full_name?: string }
): Promise<AuthResult> {
  const supabase = createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      data: metadata,
    },
  })

  return {
    user: data.user,
    session: data.session,
    error,
  }
}

/**
 * YouTube OAuth scopes for channel data and analytics access
 */
const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
].join(' ')

/**
 * Sign in with Google OAuth
 * Redirects to Google for authentication
 * Requests YouTube scopes for channel and analytics access
 * 
 * @param redirectTo - Optional URL to redirect to after successful authentication (defaults to /studio)
 */
export async function signInWithGoogle(redirectTo?: string): Promise<{ error: AuthError | null }> {
  const supabase = createClient()

  // Build the callback URL with the redirect parameter
  const callbackUrl = new URL('/auth/callback', window.location.origin)
  if (redirectTo) {
    callbackUrl.searchParams.set('next', redirectTo)
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl.toString(),
      scopes: YOUTUBE_SCOPES,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })

  return { error }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<{ error: AuthError | null }> {
  const supabase = createClient()
  const { error } = await supabase.auth.signOut()
  return { error }
}

/**
 * Send password reset email
 */
export async function resetPassword(
  email: string
): Promise<{ error: AuthError | null }> {
  const supabase = createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  })

  return { error }
}

/**
 * Update password (for logged-in users or from reset link)
 */
export async function updatePassword(
  newPassword: string
): Promise<{ error: AuthError | null }> {
  const supabase = createClient()

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  return { error }
}

/**
 * Get the current session
 */
export async function getSession(): Promise<Session | null> {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session
}

/**
 * Get the current user
 */
export async function getUser(): Promise<User | null> {
  const supabase = createClient()
  const { data } = await supabase.auth.getUser()
  return data.user
}

/**
 * Refresh the current session
 */
export async function refreshSession(): Promise<AuthResult> {
  const supabase = createClient()
  const { data, error } = await supabase.auth.refreshSession()

  return {
    user: data.user,
    session: data.session,
    error,
  }
}

/**
 * Subscribe to auth state changes
 * Returns an unsubscribe function
 */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
): () => void {
  const supabase = createClient()

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event: string, session: Session | null) => {
    callback(event, session)
  })

  return () => {
    subscription.unsubscribe()
  }
}
