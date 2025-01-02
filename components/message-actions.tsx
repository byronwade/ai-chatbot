import type { Message } from 'ai';
import { toast } from 'sonner';
import { useSWRConfig } from 'swr';
import { useCopyToClipboard } from 'usehooks-ts';

import type { Vote } from '@/lib/db/schema';
import { cn, getMessageIdFromAnnotations } from '@/lib/utils';

import { CopyIcon, ThumbDownIcon, ThumbUpIcon } from './icons';
import { Button } from './ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { memo } from 'react';
import equal from 'fast-deep-equal';

export function PureMessageActions({
  chatId,
  message,
  vote,
  isLoading,
}: {
  chatId: string;
  message: Message;
  vote: Vote | undefined;
  isLoading: boolean;
}) {
  const { mutate } = useSWRConfig();
  const [_, copyToClipboard] = useCopyToClipboard();

  if (isLoading) return null;
  if (message.role === 'user') return null;
  if (message.toolInvocations && message.toolInvocations.length > 0)
    return null;

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-row gap-2" suppressHydrationWarning>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="py-1 px-2 h-fit text-muted-foreground"
              variant="outline"
              onClick={async () => {
                await copyToClipboard(message.content as string);
                toast.success('Copied to clipboard!');
              }}
              suppressHydrationWarning
            >
              <CopyIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className={cn('py-1 px-2 h-fit text-muted-foreground', {
                'text-green-500': vote?.isUpvoted,
              })}
              variant="outline"
              onClick={async () => {
                const messageId = getMessageIdFromAnnotations(message);
                if (!messageId) {
                  toast.error('Something went wrong, please try again!');
                  return;
                }

                await fetch('/api/vote', {
                  method: 'POST',
                  body: JSON.stringify({
                    chatId,
                    messageId,
                    isUpvoted: true,
                  }),
                });

                mutate(`/api/vote?chatId=${chatId}`);
              }}
              suppressHydrationWarning
            >
              <ThumbUpIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Upvote</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className={cn('py-1 px-2 h-fit text-muted-foreground', {
                'text-red-500': vote && !vote.isUpvoted,
              })}
              variant="outline"
              onClick={async () => {
                const messageId = getMessageIdFromAnnotations(message);
                if (!messageId) {
                  toast.error('Something went wrong, please try again!');
                  return;
                }

                await fetch('/api/vote', {
                  method: 'POST',
                  body: JSON.stringify({
                    chatId,
                    messageId,
                    isUpvoted: false,
                  }),
                });

                mutate(`/api/vote?chatId=${chatId}`);
              }}
              suppressHydrationWarning
            >
              <ThumbDownIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Downvote</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

export const MessageActions = memo(
  PureMessageActions,
  (prevProps, nextProps) => {
    if (!equal(prevProps.vote, nextProps.vote)) return false;
    if (prevProps.isLoading !== nextProps.isLoading) return false;

    return true;
  },
);
