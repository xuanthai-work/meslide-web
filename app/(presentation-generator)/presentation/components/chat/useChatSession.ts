"use client";

import { useEffect, useRef, useState } from "react";
import { notify } from "@/components/ui/sonner";
import type { ChatHistoryMessage } from "../../../services/api/chat";
import type { ChatApiAdapter, ChatMessage } from "./chat-types";
import {
  conversationStorageKey,
  historyMessagesToChatMessages,
  readStoredConversationId,
  removeStoredConversationId,
  storeConversationId,
} from "./chat-utils";

export { historyMessagesToChatMessages };

export async function loadChatConversation({
  resourceId,
  conversationStorageScope,
  chatAdapter,
  isCancelled,
}: {
  resourceId: string;
  conversationStorageScope: string;
  chatAdapter: ChatApiAdapter;
  isCancelled: () => boolean;
}): Promise<{ conversationId: string; messages: ChatMessage[] } | null> {
  const storageKey = conversationStorageKey(
    conversationStorageScope,
    resourceId,
  );
  const storedId = readStoredConversationId(storageKey);
  let conversations = null;
  let conversationListError: unknown = null;

  try {
    const listedConversations = await chatAdapter.listConversations(resourceId);
    conversations = Array.isArray(listedConversations)
      ? listedConversations
      : [];
  } catch (error) {
    conversationListError = error;
  }

  if (isCancelled()) {
    return null;
  }

  const listedIds = (conversations ?? [])
    .map((conversation) => conversation.conversation_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const candidateIds = Array.from(
    new Set([...(storedId ? [storedId] : []), ...listedIds]),
  );

  if (candidateIds.length === 0) {
    removeStoredConversationId(storageKey);
    if (conversationListError) {
      throw conversationListError;
    }
    return null;
  }

  let historyError: unknown = null;
  let loadedHistory:
    | { conversationId: string; messages: ChatHistoryMessage[] }
    | null = null;

  for (const candidateId of candidateIds) {
    try {
      const data = await chatAdapter.getHistory(
        resourceId,
        candidateId,
      );
      if (isCancelled()) {
        return null;
      }
      const rows = Array.isArray(data?.messages) ? data.messages : [];
      if (rows.length > 0) {
        loadedHistory = {
          conversationId: candidateId,
          messages: rows,
        };
        break;
      }
    } catch (error) {
      historyError = error;
    }
  }

  if (!loadedHistory) {
    removeStoredConversationId(storageKey);
    if (historyError || conversationListError) {
      throw historyError ?? conversationListError;
    }
    return null;
  }

  if (isCancelled()) {
    return null;
  }

  storeConversationId(storageKey, loadedHistory.conversationId);
  return {
    conversationId: loadedHistory.conversationId,
    messages: historyMessagesToChatMessages(loadedHistory.messages),
  };
}

export function useChatSession({
  activeResourceId,
  chatAdapter,
  conversationStorageScope,
  onSessionReset,
}: {
  activeResourceId: string | undefined;
  chatAdapter: ChatApiAdapter;
  conversationStorageScope: string;
  onSessionReset: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const onSessionResetRef = useRef(onSessionReset);

  useEffect(() => {
    onSessionResetRef.current = onSessionReset;
  }, [onSessionReset]);

  useEffect(() => {
    let cancelled = false;
    onSessionResetRef.current();
    setMessages([]);
    setConversationId(null);

    if (!activeResourceId) {
      return;
    }

    setIsHistoryLoading(true);
    const run = async () => {
      try {
        const loaded = await loadChatConversation({
          resourceId: activeResourceId,
          conversationStorageScope,
          chatAdapter,
          isCancelled: () => cancelled,
        });
        if (cancelled || !loaded) {
          return;
        }
        setConversationId(loaded.conversationId);
        setMessages(loaded.messages);
      } catch (error) {
        console.error("Failed to load chat history:", error);
        const detail =
          error instanceof Error
            ? error.message
            : "Không thể tải cuộc trò chuyện trước đó";
        notify.error("Không thể tải cuộc trò chuyện", detail);
      } finally {
        if (!cancelled) {
          setIsHistoryLoading(false);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [
    activeResourceId,
    chatAdapter,
    conversationStorageScope,
  ]);

  return {
    messages,
    setMessages,
    conversationId,
    setConversationId,
    isHistoryLoading,
  };
}
