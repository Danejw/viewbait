"use client";

/**
 * Theme Toggle
 *
 * A button that cycles through light, dark, and system themes.
 * Uses dropdown menu for explicit theme selection.
 */

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  /** Show tooltip on hover */
  showTooltip?: boolean;
  /** Button size variant */
  size?: "icon-sm" | "icon" | "icon-lg";
  /** Additional class names */
  className?: string;
}

export function ThemeToggle({
  showTooltip = false,
  size = "icon-sm",
  className,
}: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by only rendering theme-dependent UI after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Get the current icon based on resolved theme
  const getIcon = () => {
    if (!mounted) {
      // Show a neutral icon during SSR/hydration
      return <Sun className="h-4 w-4" />;
    }

    if (theme === "system") {
      return <Monitor className="h-4 w-4" />;
    }

    return resolvedTheme === "dark" ? (
      <Moon className="h-4 w-4" />
    ) : (
      <Sun className="h-4 w-4" />
    );
  };

  const getThemeLabel = () => {
    if (!mounted) return "Toggle theme";

    switch (theme) {
      case "light":
        return "Light mode";
      case "dark":
        return "Dark mode";
      case "system":
        return "System theme";
      default:
        return "Toggle theme";
    }
  };

  const button = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={size}
          className={cn("transition-colors", className)}
          aria-label={getThemeLabel()}
        >
          {getIcon()}
          <span className="sr-only">{getThemeLabel()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className={cn(theme === "light" && "bg-accent")}
        >
          <Sun className="mr-2 h-4 w-4" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className={cn(theme === "dark" && "bg-accent")}
        >
          <Moon className="mr-2 h-4 w-4" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className={cn(theme === "system" && "bg-accent")}
        >
          <Monitor className="mr-2 h-4 w-4" />
          <span>System</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (showTooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right">{getThemeLabel()}</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
