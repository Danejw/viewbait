"use client";

import React, { createContext, useContext } from "react";

export interface OnboardingContextValue {
  isOnboarding: boolean;
}

const defaultValue: OnboardingContextValue = {
  isOnboarding: false,
};

const OnboardingContext = createContext<OnboardingContextValue>(defaultValue);

export function useOnboarding(): OnboardingContextValue {
  return useContext(OnboardingContext);
}

export interface OnboardingProviderProps {
  children: React.ReactNode;
  isOnboarding?: boolean;
}

/**
 * Provides onboarding mode to child components (e.g. generator sections).
 * When isOnboarding is true, generator components hide navigation (Manage styles, Add face)
 * and show onboarding-specific CTAs.
 */
export function OnboardingProvider({
  children,
  isOnboarding = false,
}: OnboardingProviderProps) {
  const value: OnboardingContextValue = { isOnboarding };
  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}
