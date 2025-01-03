'use client';

import type { Attachment, Message } from 'ai';
import { useChat } from 'ai/react';
import { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';

import { ChatHeader } from '@/components/chat-header';
import type { Vote } from '@/lib/db/schema';
import { fetcher, logWithTimestamp } from '@/lib/utils';

import { Block } from './block';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import { VisibilityType } from './visibility-selector';
import { useBlockSelector } from '@/hooks/use-block';

function getErrorMessage(error: Error | { error: string; type: string; message?: string }) {
  if (error instanceof Error) {
    return error.message;
  }
  
  // Handle structured errors from the API
  if ('type' in error) {
    switch (error.type) {
      case 'TOOL_SUPPORT_ERROR':
        return error.message || 'The selected model does not support advanced tools';
      case 'GENERAL_ERROR':
        return error.error || 'An unexpected error occurred';
      default:
        return error.error || 'An unexpected error occurred';
    }
  }
  
  return 'An unexpected error occurred';
}

export const Chat = memo(function Chat({
  id,
  initialMessages,
  selectedModelId,
  selectedVisibilityType,
  isReadonly,
}: {
  id: string;
  initialMessages: Array<Message>;
  selectedModelId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  const { mutate } = useSWRConfig();

  // Track model config initialization
  const modelConfigInitialized = useRef(false);

  // Memoize chat configuration to prevent unnecessary re-renders
  const chatConfig = useMemo(
		() => ({
			id,
			body: {
				chatId: id,
				modelId: selectedModelId,
				// Add configuration to prevent multiple model initializations
				cacheConfig: true,
			},
			initialMessages,
			streamProtocol: "text" as const,
			maxSteps: 25,
		}),
		[id, selectedModelId, initialMessages]
  );

  const {
    messages,
    setMessages,
    handleSubmit,
    input,
    setInput,
    append,
    isLoading,
    stop,
    reload,
    error,
  } = useChat(chatConfig);

  // Memoize votes query key
  const votesKey = useMemo(() => `/api/vote?chatId=${id}`, [id]);
  const { data: votes } = useSWR<Array<Vote>>(votesKey, fetcher);

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const isBlockVisible = useBlockSelector((state) => state.isVisible);

  // Memoize handlers
  const handleFinish = useCallback(() => {
    logWithTimestamp('[Chat] Finished processing message:', {
      chatId: id,
      selectedModelId,
      messageCount: messages.length
    });
    mutate('/api/history');
  }, [id, selectedModelId, messages.length, mutate]);

  const handleError = useCallback((error: Error) => {
    logWithTimestamp('[Chat] Error:', {
      error,
      chatId: id,
      selectedModelId,
      messageCount: messages.length,
      lastMessage: messages[messages.length - 1]
    });
  }, [id, selectedModelId, messages]);

  const handleFormSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    logWithTimestamp('[Chat] Submitting message');
    try {
      await handleSubmit(e);
      logWithTimestamp('[Chat] Message submitted successfully');
    } catch (error) {
      logWithTimestamp('[Chat] Error submitting message:', error);
    }
  }, [handleSubmit]);

  // Cleanup effect
  useEffect(() => {
    logWithTimestamp('[Chat] Initializing with:', {
      chatId: id,
      selectedModelId,
      initialMessagesCount: initialMessages.length,
      selectedVisibilityType,
      isReadonly
    });

    return () => {
      setAttachments([]);
      setInput('');
      logWithTimestamp('[Chat] Cleaning up chat:', { chatId: id });
    };
  }, [id, selectedModelId, initialMessages.length, selectedVisibilityType, isReadonly, setInput]);

  // Error effect
  useEffect(() => {
    if (error) {
      logWithTimestamp('[Chat] Chat error:', error);
    }
  }, [error]);

  useEffect(() => {
    modelConfigInitialized.current = true;
    return () => {
      modelConfigInitialized.current = false;
    };
  }, [selectedModelId]);

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-background" suppressHydrationWarning>
        <ChatHeader
          chatId={id}
          selectedModelId={selectedModelId}
          selectedVisibilityType={selectedVisibilityType}
          isReadonly={isReadonly}
        />

        <Messages
          chatId={id}
          isLoading={isLoading}
          votes={votes}
          messages={messages}
          setMessages={setMessages}
          reload={reload}
          isReadonly={isReadonly}
          isBlockVisible={isBlockVisible}
          error={error}
        />

        <form 
          className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl" 
          suppressHydrationWarning
          autoComplete="off"
          onSubmit={handleFormSubmit}
        >
          {!isReadonly && (
            <MultimodalInput
              chatId={id}
              input={input}
              setInput={setInput}
              handleSubmit={handleSubmit}
              isLoading={isLoading}
              stop={stop}
              attachments={attachments}
              setAttachments={setAttachments}
              messages={messages}
              setMessages={setMessages}
              append={append}
            />
          )}
        </form>
      </div>

      <Block
        chatId={id}
        input={input}
        setInput={setInput}
        handleSubmit={handleSubmit}
        isLoading={isLoading}
        stop={stop}
        attachments={attachments}
        setAttachments={setAttachments}
        append={append}
        messages={messages}
        setMessages={setMessages}
        reload={reload}
        votes={votes}
        isReadonly={isReadonly}
      />
    </>
  );
}, (prevProps, nextProps) => {
  // Optimized comparison function for memo
  return (
    prevProps.id === nextProps.id &&
    prevProps.selectedModelId === nextProps.selectedModelId &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
    prevProps.isReadonly === nextProps.isReadonly &&
    prevProps.initialMessages === nextProps.initialMessages && // Compare reference only
    prevProps.initialMessages.length === nextProps.initialMessages.length
  );
});
