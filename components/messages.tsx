import { ChatRequestOptions, Message } from 'ai';
import { PreviewMessage, ThinkingMessage } from './message';
import { useScrollToBottom } from './use-scroll-to-bottom';
import { Overview } from './overview';
import { memo } from 'react';
import { Vote } from '@/lib/db/schema';
import equal from 'fast-deep-equal';

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

interface MessagesProps {
  chatId: string;
  isLoading: boolean;
  votes: Array<Vote> | undefined;
  messages: Array<Message>;
  setMessages: (
    messages: Message[] | ((messages: Message[]) => Message[]),
  ) => void;
  reload: (
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  isReadonly: boolean;
  isBlockVisible: boolean;
  error: Error | undefined;
}

function PureMessages({
  chatId,
  isLoading,
  votes,
  messages,
  setMessages,
  reload,
  isReadonly,
  error,
}: MessagesProps) {
  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();

  return (
    <div
      ref={messagesContainerRef}
      className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4"
      suppressHydrationWarning
    >
      {messages.length === 0 && !error && <Overview />}

      {error && (
        <div className="mx-auto w-full max-w-3xl px-4">
          <div className="p-4 mb-4 text-sm rounded-lg bg-red-50 dark:bg-red-900/50 text-red-500 dark:text-red-200 border border-red-200 dark:border-red-800">
            <p className="font-medium">Error: {getErrorMessage(error)}</p>
            {error && 'type' in error && error.type === 'TOOL_SUPPORT_ERROR' && (
              <div className="mt-2 text-xs space-y-1">
                <p>Try switching to one of these supported models:</p>
                <ul className="list-disc list-inside pl-2">
                  {(error as any).supportedModels?.map((model: string) => (
                    <li key={model} className="capitalize">{model}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {messages.map((message, index) => (
        <PreviewMessage
          key={message.id}
          chatId={chatId}
          message={message}
          isLoading={isLoading && messages.length - 1 === index}
          vote={
            votes
              ? votes.find((vote) => vote.messageId === message.id)
              : undefined
          }
          setMessages={setMessages}
          reload={reload}
          isReadonly={isReadonly}
        />
      ))}

      {isLoading &&
        messages.length > 0 &&
        messages[messages.length - 1].role === 'user' && <ThinkingMessage />}

      <div
        ref={messagesEndRef}
        className="shrink-0 min-w-[24px] min-h-[24px]"
      />
    </div>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  return (
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.isReadonly === nextProps.isReadonly &&
    prevProps.isBlockVisible === nextProps.isBlockVisible &&
    equal(prevProps.messages, nextProps.messages) &&
    equal(prevProps.votes, nextProps.votes) &&
    equal(prevProps.error, nextProps.error)
  );
});
