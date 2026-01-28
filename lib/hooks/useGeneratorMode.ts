"use client";

import { useState, useRef, useCallback } from "react";
import type { GeneratorMode } from "@/app/components/GeneratorModeSwitcher";
import type { AssistantChatInterfaceRef } from "@/app/components/AssistantChatInterface";

export interface UseGeneratorModeReturn {
  mode: GeneratorMode;
  isControlsExpanded: boolean;
  chatInterfaceRef: React.RefObject<AssistantChatInterfaceRef>;
  setMode: (mode: GeneratorMode) => void;
  setIsControlsExpanded: (expanded: boolean) => void;
  resetChat: (onResetSettings?: () => void) => void;
}

/**
 * Custom hook to manage generator mode (Manual vs Assistant)
 * Handles mode switching and related state
 */
export function useGeneratorMode(
  initialMode: GeneratorMode = "manual"
): UseGeneratorModeReturn {
  const [mode, setMode] = useState<GeneratorMode>(initialMode);
  const [isControlsExpanded, setIsControlsExpanded] = useState(true);
  const chatInterfaceRef = useRef<AssistantChatInterfaceRef>(null);

  const resetChat = useCallback((onResetSettings?: () => void) => {
    chatInterfaceRef.current?.resetChat();
    onResetSettings?.();
  }, []);

  return {
    mode,
    isControlsExpanded,
    chatInterfaceRef,
    setMode,
    setIsControlsExpanded,
    resetChat,
  };
}
