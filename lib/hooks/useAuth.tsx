"use client";

/**
 * Authentication Hook and Provider
 * 
 * Provides authentication state and methods throughout the app.
 * Listens to auth state changes and auto-fetches user profile.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types/database";
import { logClientError, logClientWarn } from "@/lib/utils/client-logger";

// ============================================================================
// Types
// ============================================================================

export interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    metadata?: { full_name?: string }
  ) => Promise<{ error: Error | null }>;
  signInWithGoogle: (redirectTo?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

// ============================================================================
// Context
// ============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================================================
// Helper to check if Supabase is configured
// ============================================================================

function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

// ============================================================================
// Provider
// ============================================================================

interface AuthProviderProps {
  children: ReactNode;
  // Initial state from server (prevents flicker)
  initialUser?: User | null;
  initialSession?: Session | null;
  initialProfile?: Profile | null;
}

export function AuthProvider({ 
  children,
  initialUser,
  initialSession,
  initialProfile,
}: AuthProviderProps) {
  // Initialize with server-provided state if available, otherwise null
  const [user, setUser] = useState<User | null>(initialUser ?? null);
  const [profile, setProfile] = useState<Profile | null>(initialProfile ?? null);
  const [session, setSession] = useState<Session | null>(initialSession ?? null);
  // If initial state is provided, we're not loading (server already checked)
  // Otherwise, start with loading=true until client-side initialization completes
  const [isLoading, setIsLoading] = useState(initialUser === undefined && initialSession === undefined);
  const [isConfigured] = useState(isSupabaseConfigured());

  /**
   * Fetch user profile from database
   */
  const fetchProfile = useCallback(async () => {
    if (!isConfigured) return;
    
    try {
      const profilesService = await import("@/lib/services/profiles");
      const { profile: fetchedProfile, error } =
        await profilesService.getProfile();

      if (error) {
        logClientError(error, {
          operation: "fetch-profile",
          component: "useAuth",
        });
        return;
      }

      setProfile(fetchedProfile);
    } catch (error) {
      logClientError(error, {
        operation: "fetch-profile",
        component: "useAuth",
      });
    }
  }, [isConfigured]);
  
  // Stable reference to fetchProfile to avoid dependency issues
  const fetchProfileRef = useRef(fetchProfile);
  useEffect(() => {
    fetchProfileRef.current = fetchProfile;
  }, [fetchProfile]);
  
  // Track if we just logged out to prevent SIGNED_IN events from restoring state
  const justLoggedOutRef = useRef(false);

  /**
   * Handle auth state changes
   */
  useEffect(() => {
    if (!isConfigured) {
      setIsLoading(false);
      return;
    }

    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    // If initial state was provided from server, skip client-side initialization
    // but still set up the auth state listener for future changes
    if (initialUser !== undefined || initialSession !== undefined) {
      // Server already provided initial state - no need to fetch again
      setIsLoading(false);
    } else {
      // No initial state provided - perform client-side initialization
      const initializeAuth = async () => {
        try {
          const { createClient } = await import("@/lib/supabase/client");
          const supabase = createClient();
          
          const {
            data: { session: initialSession },
          } = await supabase.auth.getSession();

          if (!mounted) return;

          setSession(initialSession);
          setUser(initialSession?.user ?? null);

          if (initialSession?.user) {
            await fetchProfileRef.current();
          }
        } catch (error) {
          logClientError(error, {
            operation: "initialize-auth",
            component: "useAuth",
          });
        } finally {
          if (mounted) {
            setIsLoading(false);
          }
        }
      };

      initializeAuth();
    }

    // Set up auth state listener (always needed for future auth changes)
    const setupListener = async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event: string, newSession: Session | null) => {
          if (!mounted) return;
          
          // If we just logged out, ignore SIGNED_IN events for 5 seconds
          // This prevents the middleware from restoring the session after logout
          if (event === "SIGNED_IN" && justLoggedOutRef.current) {
            return;
          }
          
          // Clear the flag if we see a SIGNED_OUT event
          if (event === "SIGNED_OUT") {
            justLoggedOutRef.current = false;
          }
          
          setSession(newSession);
          setUser(newSession?.user ?? null);

          if (event === "SIGNED_IN" && newSession?.user) {
            await fetchProfileRef.current();
          } else if (event === "SIGNED_OUT") {
            setProfile(null);
          }
        });

        unsubscribe = () => subscription.unsubscribe();
      } catch (error) {
        logClientError(error, {
          operation: "setup-auth-listener",
          component: "useAuth",
        });
      }
    };

    setupListener();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [isConfigured, initialUser, initialSession, fetchProfile]);

  /**
   * Sign in with email/password
   */
  const signIn = useCallback(
    async (
      email: string,
      password: string
    ): Promise<{ error: Error | null }> => {
      if (!isConfigured) {
        return { error: new Error("Supabase not configured") };
      }
      
      try {
        const authService = await import("@/lib/services/auth");
        const { user, session, error } = await authService.signInWithEmail(email, password);
        
        // Immediately update auth state if sign-in was successful
        // This ensures isAuthenticated updates right away, triggering redirects
        if (!error && user && session) {
          setUser(user);
          setSession(session);
          // Fetch profile in the background
          fetchProfileRef.current().catch((err) => {
            logClientError(err, {
              operation: "fetch-profile-after-signin",
              component: "useAuth",
            });
          });
        }
        
        return { error: error as Error | null };
      } catch (error) {
        return { error: error as Error };
      }
    },
    [isConfigured, user, session]
  );

  /**
   * Sign up with email/password
   */
  const signUp = useCallback(
    async (
      email: string,
      password: string,
      metadata?: { full_name?: string }
    ): Promise<{ error: Error | null }> => {
      if (!isConfigured) {
        return { error: new Error("Supabase not configured") };
      }
      
      try {
        const authService = await import("@/lib/services/auth");
        const { user, session, error } = await authService.signUpWithEmail(
          email,
          password,
          metadata
        );
        
        // Immediately update auth state if sign-up was successful
        // Note: Some Supabase configs require email confirmation, so session might be null
        // In that case, the onAuthStateChange listener will handle it when email is confirmed
        if (!error && user && session) {
          setUser(user);
          setSession(session);
          // Fetch profile in the background
          fetchProfileRef.current().catch((err) => {
            logClientError(err, {
              operation: "fetch-profile-after-signup",
              component: "useAuth",
            });
          });
        }
        
        return { error: error as Error | null };
      } catch (error) {
        return { error: error as Error };
      }
    },
    [isConfigured]
  );

  /**
   * Sign in with Google OAuth
   * @param redirectTo - Optional URL to redirect to after successful authentication
   */
  const signInWithGoogle = useCallback(async (redirectTo?: string): Promise<{
    error: Error | null;
  }> => {
    if (!isConfigured) {
      return { error: new Error("Supabase not configured") };
    }
    
    try {
      const authService = await import("@/lib/services/auth");
      const { error } = await authService.signInWithGoogle(redirectTo);
      return { error: error as Error | null };
    } catch (error) {
      return { error: error as Error };
    }
  }, [isConfigured]);

  /**
   * Sign out
   */
  const signOut = useCallback(async (): Promise<{ error: Error | null }> => {
    if (!isConfigured) {
      return { error: new Error("Supabase not configured") };
    }
    
    try {
      // Set flag to ignore SIGNED_IN events after logout
      justLoggedOutRef.current = true;
      // Clear the flag after 5 seconds
      setTimeout(() => {
        justLoggedOutRef.current = false;
      }, 5000);
      
      // Clear state IMMEDIATELY for instant UI feedback
      // The Supabase call may hang, but we want the user to see they're logged out right away
      setSession(null);
      setUser(null);
      setProfile(null);
      
      const authService = await import("@/lib/services/auth");
      
      // Add timeout to prevent hanging - if signOut hangs, we'll timeout after 3 seconds
      const signOutPromise = authService.signOut();
      const timeoutPromise = new Promise<{ error: Error }>((resolve) => {
        setTimeout(() => {
          resolve({ error: new Error("Sign out timed out") });
        }, 3000); // 3 second timeout
      });
      
      const result = await Promise.race([signOutPromise, timeoutPromise]);
      const error = result.error;
      const isTimeout = error?.message === "Sign out timed out";
      
      // If there was a timeout, manually clear cookies as fallback
      if (isTimeout) {
        const { clearSupabaseCookies } = await import("@/lib/utils/cookies");
        clearSupabaseCookies();
      }
      
      // If there was a timeout error, still return success since we already cleared the state and cookies
      return { error: isTimeout ? null : (error as Error | null) };
    } catch (error) {
      return { error: error as Error };
    }
  }, [isConfigured, user, session]);

  /**
   * Reset password
   */
  const resetPassword = useCallback(
    async (email: string): Promise<{ error: Error | null }> => {
      if (!isConfigured) {
        return { error: new Error("Supabase not configured") };
      }
      
      try {
        const authService = await import("@/lib/services/auth");
        const { error } = await authService.resetPassword(email);
        return { error: error as Error | null };
      } catch (error) {
        return { error: error as Error };
      }
    },
    [isConfigured]
  );

  /**
   * Update password
   */
  const updatePassword = useCallback(
    async (newPassword: string): Promise<{ error: Error | null }> => {
      if (!isConfigured) {
        return { error: new Error("Supabase not configured") };
      }
      
      try {
        const authService = await import("@/lib/services/auth");
        const { error } = await authService.updatePassword(newPassword);
        return { error: error as Error | null };
      } catch (error) {
        return { error: error as Error };
      }
    },
    [isConfigured]
  );

  /**
   * Refresh profile data
   */
  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfileRef.current();
    }
  }, [user]);

  // ============================================================================
  // Context Value
  // ============================================================================

  const value: AuthContextType = useMemo(() => {
    const isAuthenticated = !!user;
    return {
      user,
      profile,
      session,
      isLoading,
      isAuthenticated,
      isConfigured,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      resetPassword,
      updatePassword,
      refreshProfile,
    };
  }, [
    user,
    profile,
    session,
    isLoading,
    isConfigured,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    resetPassword,
    updatePassword,
    refreshProfile,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Use authentication context
 * Must be used within an AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

/**
 * Require authentication - redirects to login if not authenticated
 * Returns user info if authenticated
 */
export function useRequireAuth(): AuthContextType & { user: User } {
  const auth = useAuth();

  if (!auth.isLoading && !auth.isAuthenticated) {
    // In a real app, you might redirect here
    logClientWarn("Authentication required but user is not authenticated", {
      operation: "require-auth",
      component: "useRequireAuth",
    });
  }

  return auth as AuthContextType & { user: User };
}
