"use client";

/**
 * ChatDropHandlerContext
 *
 * Provides a ref-based handler so StudioDndContext can notify StudioChatPanel
 * when a style/face/thumbnail/snapshot is dropped on the chat input zone.
 * The panel registers its handler; the DnD context invokes it on drop.
 */

import React, { createContext, useContext, useRef, useCallback } from "react";
import type { DragItemType } from "./studio-dnd-context";

export interface ChatDropPayload {
  type: DragItemType;
  imageUrl?: string;
  blob?: Blob;
}

export type ChatDropHandler = (payload: ChatDropPayload) => void;

interface ChatDropHandlerContextValue {
  chatDropHandlerRef: React.MutableRefObject<ChatDropHandler | null>;
}

const ChatDropHandlerContext = createContext<ChatDropHandlerContextValue | null>(null);

export function ChatDropHandlerProvider({ children }: { children: React.ReactNode }) {
  const chatDropHandlerRef = useRef<ChatDropHandler | null>(null);
  const value = useRef<ChatDropHandlerContextValue>({ chatDropHandlerRef }).current;

  return (
    <ChatDropHandlerContext.Provider value={value}>
      {children}
    </ChatDropHandlerContext.Provider>
  );
}

export function useChatDropHandler() {
  const ctx = useContext(ChatDropHandlerContext);
  if (!ctx) return null;
  return ctx.chatDropHandlerRef;
}
