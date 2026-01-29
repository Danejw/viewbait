"use client";

import React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ViewBaitLogo } from "@/components/ui/viewbait-logo";

export interface ThinkingState {
  status?: string;
  message?: string;
  toolCalls?: Array<{ function: string; status: "calling" | "complete" }>;
  streamedText?: string;
}

export interface ThinkingMessageProps {
  thinkingState: ThinkingState;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
}

/**
 * ThinkingMessage
 * Shows "thinking" state while waiting for assistant response: status line,
 * expandable tool call progress, and optional streamed text preview.
 */
export function ThinkingMessage({
  thinkingState,
  isExpanded = true,
  onToggleExpanded,
}: ThinkingMessageProps) {
  const { status, message, toolCalls = [], streamedText } = thinkingState;
  const displayMessage = message ?? status ?? "Thinking...";

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
        <div className="flex items-center gap-2">
          <ViewBaitLogo className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">{displayMessage}</span>
        </div>
        {toolCalls.length > 0 && (
          <div className="mt-2 border-t border-border pt-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onToggleExpanded}
              className="w-full justify-start gap-1 text-left text-xs text-muted-foreground hover:text-foreground"
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              <span>Tool calls</span>
            </Button>
            {isExpanded && (
              <ul className="mt-1 space-y-1 pl-4 text-xs text-muted-foreground">
                {toolCalls.map((tc, i) => (
                  <li key={i} className="flex items-center gap-2">
                    {tc.status === "calling" ? (
                      <ViewBaitLogo className="h-3 w-3 animate-spin" />
                    ) : (
                      <span className="h-3 w-3 rounded-full bg-green-500/50" />
                    )}
                    <span>{tc.function}</span>
                    <span className="text-[10px]">({tc.status})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {streamedText && streamedText.length > 0 && (
          <div className="mt-2 border-t border-border pt-2">
            <p className="text-xs text-muted-foreground line-clamp-3">
              {streamedText}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
