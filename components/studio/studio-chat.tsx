"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquare, Send, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CloseButton } from "@/components/ui/close-button";
import { Input } from "@/components/ui/input";
import { useStudio } from "./studio-provider";
import { useStyles } from "@/lib/hooks/useStyles";
import { usePalettes } from "@/lib/hooks/usePalettes";
import { ChatMessage } from "./chat-message";
import { ThinkingMessage, type ThinkingState } from "./thinking-message";
import { DynamicUIRenderer, type UIComponentName } from "./dynamic-ui-renderer";
import { cn } from "@/lib/utils";

const CHAT_HISTORY_KEY = "thumbnail-assistant-chat-history";

const WELCOME_MESSAGE: ChatPanelMessage = {
  role: "assistant",
  content:
    "Hi! I'm here to help you create amazing thumbnails. Tell me what you have in mind—for example, a title, style, or aspect ratio—and I'll guide you through the options and surface the right controls.",
  timestamp: new Date(),
};

export interface ChatPanelMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
  uiComponents?: UIComponentName[];
  suggestions?: string[];
}

function loadHistoryFromStorage(): ChatPanelMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{
      role: "user" | "assistant";
      content: string;
      timestamp?: string;
      uiComponents?: UIComponentName[];
      suggestions?: string[];
    }>;
    return parsed.map((m) => ({
      ...m,
      timestamp: m.timestamp ? new Date(m.timestamp) : undefined,
    }));
  } catch {
    return [];
  }
}

function saveHistoryToStorage(messages: ChatPanelMessage[]) {
  if (typeof window === "undefined") return;
  try {
    const toSave = messages.map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp?.toISOString(),
      uiComponents: m.uiComponents,
      suggestions: m.suggestions,
    }));
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(toSave));
  } catch {
    // ignore
  }
}

/**
 * StudioChatPanel
 * In-sidebar chat interface for thumbnail creation: messages, suggestions,
 * DynamicUIRenderer per assistant message, thinking state, localStorage persistence, reset.
 */
export function StudioChatPanel() {
  const {
    state: {
      thumbnailText,
      includeFaces,
      selectedFaces,
      faceExpression,
      facePose,
      includeStyleReferences,
      styleReferences,
      selectedStyle,
      selectedPalette,
      selectedAspectRatio,
      selectedResolution,
      variations,
      customInstructions,
    },
    actions: { applyFormStateUpdates, resetChat },
  } = useStudio();

  const { styles, defaultStyles } = useStyles({ autoFetch: true });
  const { palettes, defaultPalettes } = usePalettes({ includeDefaults: true, autoFetch: true });

  const [messages, setMessages] = useState<ChatPanelMessage[]>(() => {
    const loaded = loadHistoryFromStorage();
    if (loaded.length === 0) {
      const initial = [WELCOME_MESSAGE];
      saveHistoryToStorage(initial);
      return initial;
    }
    return loaded;
  });
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thinkingState, setThinkingState] = useState<ThinkingState | null>(null);
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isInitializedRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      return;
    }
    saveHistoryToStorage(messages);
  }, [messages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, thinkingState, scrollToBottom]);

  const availableStyles = React.useMemo(() => {
    const all = [...(defaultStyles || []), ...(styles || [])].filter(Boolean);
    return all.map((s) => ({ id: s.id, name: s.name ?? "" }));
  }, [styles, defaultStyles]);

  const availablePalettes = React.useMemo(() => {
    const all = [...(defaultPalettes || []), ...(palettes || [])].filter(Boolean);
    return all.map((p) => ({ id: p.id, name: p.name ?? "" }));
  }, [palettes, defaultPalettes]);

  const formState = React.useMemo(
    () => ({
      thumbnailText: thumbnailText ?? "",
      includeFace: includeFaces ?? false,
      selectedFaces: selectedFaces ?? [],
      expression: faceExpression !== "None" ? faceExpression : null,
      pose: facePose !== "None" ? facePose : null,
      includeStyleReferences: includeStyleReferences ?? false,
      styleReferences: styleReferences ?? [],
      selectedStyle: selectedStyle ?? null,
      selectedColor: selectedPalette ?? null,
      selectedAspectRatio: selectedAspectRatio ?? "16:9",
      selectedResolution: selectedResolution ?? "1K",
      variations: variations ?? 1,
      customInstructions: customInstructions ?? "",
    }),
    [
      thumbnailText,
      includeFaces,
      selectedFaces,
      faceExpression,
      facePose,
      includeStyleReferences,
      styleReferences,
      selectedStyle,
      selectedPalette,
      selectedAspectRatio,
      selectedResolution,
      variations,
      customInstructions,
    ]
  );

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;

    setInputValue("");
    setError(null);
    const userMessage: ChatPanelMessage = {
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setThinkingState({ status: "analyzing", message: "Analyzing conversation..." });

    const conversationHistory = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: text },
    ];

    try {
      const res = await fetch("/api/assistant/chat?stream=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationHistory,
          formState,
          availableStyles,
          availablePalettes,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error ?? "Failed to send message");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let toolCalls: Array<{ function: string; status: "calling" | "complete" }> = [];

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() ?? "";
          for (const chunk of chunks) {
            let event = "";
            let dataStr = "";
            for (const line of chunk.split("\n")) {
              if (line.startsWith("event:")) {
                event = line.slice(6).trim();
              } else if (line.startsWith("data:")) {
                dataStr = line.slice(5).trim();
              }
            }
            if (!event || !dataStr) continue;
            try {
              const data = JSON.parse(dataStr);
              if (event === "status") {
                setThinkingState((prev) => ({
                  ...prev,
                  status: data.type,
                  message: data.message ?? prev?.message,
                }));
              } else if (event === "tool_call") {
                if (data.status === "calling") {
                  toolCalls = [...(toolCalls.filter((t) => t.function !== data.function)), { function: data.function, status: "calling" as const }];
                } else {
                  toolCalls = toolCalls.map((t) =>
                    t.function === data.function ? { ...t, status: "complete" as const } : t
                  );
                }
                setThinkingState((prev) => ({ ...prev, toolCalls: [...toolCalls] }));
              } else if (event === "text_chunk") {
                setThinkingState((prev) => ({
                  ...prev,
                  streamedText: (prev?.streamedText ?? "") + (data.chunk ?? ""),
                }));
              } else if (event === "complete") {
                if (data.form_state_updates) {
                  const updates = { ...data.form_state_updates };
                  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                  if (updates.selectedStyle != null && !uuidLike.test(String(updates.selectedStyle))) {
                    const byName = availableStyles.find(
                      (s) => s.name?.toLowerCase() === String(updates.selectedStyle).toLowerCase()
                    );
                    if (byName) updates.selectedStyle = byName.id;
                  }
                  if (updates.selectedColor != null && !uuidLike.test(String(updates.selectedColor))) {
                    const byName = availablePalettes.find(
                      (p) => p.name?.toLowerCase() === String(updates.selectedColor).toLowerCase()
                    );
                    if (byName) updates.selectedColor = byName.id;
                  }
                  applyFormStateUpdates(updates);
                }
                const assistantMessage: ChatPanelMessage = {
                  role: "assistant",
                  content: data.human_readable_message ?? "",
                  timestamp: new Date(),
                  uiComponents: Array.isArray(data.ui_components) ? data.ui_components : [],
                  suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
                };
                setMessages((prev) => [...prev, assistantMessage]);
                setThinkingState(null);
              } else if (event === "error") {
                setError(data.error ?? "Something went wrong");
                setMessages((prev) => [
                  ...prev,
                  {
                    role: "assistant",
                    content: data.error ?? "Sorry, something went wrong. Please try again.",
                    timestamp: new Date(),
                  },
                ]);
                setThinkingState(null);
              }
            } catch {
              // ignore parse errors for non-JSON data
            }
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send message";
      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I couldn't process that. Please try again.",
          timestamp: new Date(),
        },
      ]);
      setThinkingState(null);
    } finally {
      setIsLoading(false);
    }
  }, [
    inputValue,
    isLoading,
    messages,
    formState,
    availableStyles,
    availablePalettes,
    applyFormStateUpdates,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setInputValue(suggestion);
    inputRef.current?.focus();
  }, []);

  const handleReset = useCallback(() => {
    setMessages([WELCOME_MESSAGE]);
    setInputValue("");
    setError(null);
    setThinkingState(null);
    saveHistoryToStorage([WELCOME_MESSAGE]);
    resetChat(true);
  }, [resetChat]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header - fixed at top */}
      <div className="flex shrink-0 items-center justify-between border-b border-border p-2 mb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Chat</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground">
          <RotateCcw className="mr-1 h-3 w-3" />
          Reset
        </Button>
      </div>

      {/* Messages - scrollable; fills space above input */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto hide-scrollbar">
        {messages.map((msg, index) => (
          <div key={index}>
            <ChatMessage
              role={msg.role}
              content={msg.content}
              timestamp={msg.timestamp}
            />
            {msg.role === "assistant" && (
              <>
                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {msg.suggestions.map((s, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleSuggestionClick(s)}
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                )}
                {msg.uiComponents && msg.uiComponents.length > 0 && (
                  <DynamicUIRenderer components={msg.uiComponents} />
                )}
              </>
            )}
          </div>
        ))}
        {thinkingState && (
          <ThinkingMessage
            thinkingState={thinkingState}
            isExpanded={isThinkingExpanded}
            onToggleExpanded={() => setIsThinkingExpanded((b) => !b)}
          />
        )}
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input - fixed at bottom of section */}
      <div className="shrink-0 border-t border-border pt-3 mt-3">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * StudioChatAssistant
 * Floating chat assistant (legacy); use StudioChatPanel in sidebar for main chat.
 */
export function StudioChatAssistant() {
  const {
    state: { chatAssistant, mode },
    actions: { openChatAssistant, closeChatAssistant, sendChatMessage },
  } = useStudio();

  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatAssistant.conversationHistory]);

  const handleSend = async () => {
    if (!inputValue.trim() || chatAssistant.isProcessing) return;
    const message = inputValue.trim();
    setInputValue("");
    await sendChatMessage(message);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!chatAssistant.isOpen && mode !== "chat") {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col">
      <div className="flex h-[600px] w-[400px] flex-col rounded-lg border border-border bg-card shadow-lg">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <h3 className="font-semibold">AI Assistant</h3>
          </div>
          <CloseButton onClick={closeChatAssistant} />
        </div>
        <div className="flex-1 overflow-y-auto p-4 hide-scrollbar">
          {chatAssistant.conversationHistory.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">Start a conversation</p>
            </div>
          ) : (
            <div className="space-y-4">
              {chatAssistant.conversationHistory.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    <p>{message.content}</p>
                  </div>
                </div>
              ))}
              {chatAssistant.isProcessing && (
                <div className="flex justify-start">
                  <div className="rounded-lg bg-muted px-3 py-2 text-sm">
                    <div className="flex gap-1">
                      <div className="h-2 w-2 animate-bounce rounded-full bg-foreground [animation-delay:-0.3s]" />
                      <div className="h-2 w-2 animate-bounce rounded-full bg-foreground [animation-delay:-0.15s]" />
                      <div className="h-2 w-2 animate-bounce rounded-full bg-foreground" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
        <div className="border-t border-border p-4">
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={chatAssistant.isProcessing}
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={!inputValue.trim() || chatAssistant.isProcessing}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * StudioChatToggle
 * Button to open the floating chat assistant.
 */
export function StudioChatToggle() {
  const {
    state: { chatAssistant },
    actions: { openChatAssistant },
  } = useStudio();

  if (chatAssistant.isOpen) {
    return null;
  }

  return (
    <Button
      onClick={openChatAssistant}
      size="lg"
      className="fixed bottom-4 right-4 z-50 rounded-full shadow-lg"
    >
      <MessageSquare className="mr-2 h-4 w-4" />
      Chat with Assistant
    </Button>
  );
}
