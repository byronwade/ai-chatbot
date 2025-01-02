'use client';

import { ChatRequestOptions, Message } from 'ai';
import { Button } from './ui/button';
import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import { Textarea } from './ui/textarea';
import { deleteTrailingMessages } from '@/app/(chat)/actions';
import { toast } from 'sonner';
import { useUserMessageId } from '@/hooks/use-user-message-id';

export type MessageEditorProps = {
  message: Message;
  setMode: Dispatch<SetStateAction<'view' | 'edit'>>;
  setMessages: (
    messages: Message[] | ((messages: Message[]) => Message[]),
  ) => void;
  reload: (
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
};

export function MessageEditor({
  message,
  setMode,
  setMessages,
  reload,
}: MessageEditorProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftContent, setDraftContent] = useState(message.content);
  const { userMessageIdFromServer } = useUserMessageId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [draftContent]);

  return (
    <div className="flex flex-col gap-2 w-full max-w-2xl mx-auto">
      <Textarea
        ref={textareaRef}
        value={draftContent}
        onChange={(e) => setDraftContent(e.target.value)}
        placeholder="Type your message..."
        className="resize-none overflow-hidden"
        rows={1}
      />
      <div className="flex flex-row gap-2 justify-end" suppressHydrationWarning>
        <Button
          variant="outline"
          className="h-fit py-2 px-3"
          onClick={() => {
            setMode('view');
          }}
        >
          Cancel
        </Button>
        <Button
          variant="default"
          className="h-fit py-2 px-3"
          disabled={isSubmitting}
          onClick={async () => {
            try {
              setIsSubmitting(true);
              const messageId = userMessageIdFromServer ?? message.id;

              if (!messageId) {
                toast.error('Message ID not found. Please try again.');
                return;
              }

              try {
                await deleteTrailingMessages({
                  id: messageId,
                });
              } catch (error) {
                console.warn('Failed to delete trailing messages:', error);
                // Continue with message update even if deletion fails
              }

              setMessages((messages) => {
                const index = messages.findIndex((m) => m.id === message.id);
                if (index === -1) {
                  return messages;
                }

                const updatedMessage = {
                  ...message,
                  content: draftContent,
                };

                return [...messages.slice(0, index), updatedMessage];
              });

              setMode('view');
              await reload();
            } catch (error) {
              console.error('Error updating message:', error);
              toast.error('Failed to update message. Please try again.');
            } finally {
              setIsSubmitting(false);
            }
          }}
        >
          {isSubmitting ? 'Sending...' : 'Send'}
        </Button>
      </div>
    </div>
  );
}
