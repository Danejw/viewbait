"use client";

import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useStudio } from "./studio-provider";
import { cn } from "@/lib/utils";

/**
 * StudioChatAssistant
 * Chat assistant component that can be opened/closed within the studio
 * The assistant can pull up information and surface components dynamically
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
      <Card className="flex h-[600px] w-[400px] flex-col shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <h3 className="font-semibold">AI Assistant</h3>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={closeChatAssistant}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 hide-scrollbar">
          {chatAssistant.conversationHistory.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <MessageSquare className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Start a conversation to generate thumbnails
                </p>
              </div>
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
                    {message.uiComponents && message.uiComponents.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {message.uiComponents.map((component, i) => (
                          <div
                            key={i}
                            className="rounded bg-background/50 px-2 py-1 text-xs"
                          >
                            {component}
                          </div>
                        ))}
                      </div>
                    )}
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

        {/* Input */}
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
      </Card>
    </div>
  );
}

/**
 * StudioChatToggle
 * Button to open the chat assistant
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
