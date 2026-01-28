"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

export interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
}

/**
 * ChatMessage
 * Renders a single chat message: user (plain text) or assistant (Markdown).
 */
export function ChatMessage({ role, content, timestamp }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "flex",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[90%] rounded-lg px-3 py-2 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-2 [&_ol]:my-2 [&_pre]:my-2 [&_code]:text-xs [&_pre]:rounded-md [&_pre]:bg-background/50 [&_pre]:p-2 [&_pre]:overflow-x-auto">
            <ReactMarkdown
              components={{
                code({ className, children, ...props }) {
                  const isBlock = className?.startsWith("language-");
                  return isBlock ? (
                    <code
                      className={cn("block text-xs", className)}
                      {...props}
                    >
                      {children}
                    </code>
                  ) : (
                    <code
                      className={cn("rounded bg-background/50 px-1 py-0.5", className)}
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
        {timestamp && (
          <p
            className={cn(
              "mt-1 text-[10px] opacity-80",
              isUser ? "text-primary-foreground/80" : "text-muted-foreground"
            )}
          >
            {timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
    </div>
  );
}
