"use client";

/**
 * Theme Provider
 *
 * Wraps the application with next-themes ThemeProvider for light/dark mode support.
 * Uses the "class" attribute strategy to toggle themes via CSS classes.
 */

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ThemeProviderProps } from "next-themes";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
