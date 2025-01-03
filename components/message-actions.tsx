import type { Message } from 'ai';
import { toast } from 'sonner';
import { useSWRConfig } from 'swr';
import { useCopyToClipboard } from 'usehooks-ts';

import type { Vote } from '@/lib/db/schema';
import { cn, getMessageIdFromAnnotations } from '@/lib/utils';

import { CopyIcon, ThumbDownIcon, ThumbUpIcon, TrashIcon } from "./icons";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { memo } from "react";
import equal from "fast-deep-equal";

export function PureMessageActions({ chatId, message, vote, isLoading }: { chatId: string; message: Message; vote: Vote | undefined; isLoading: boolean }) {
	const { mutate } = useSWRConfig();
	const [_, copyToClipboard] = useCopyToClipboard();

	if (isLoading) return null;
	if (message.role === "user") return null;
	if (message.toolInvocations && message.toolInvocations.length > 0) return null;

	return (
		<div className="flex flex-row gap-2 h-[32px] items-center" suppressHydrationWarning>
			<div className="w-[32px] h-[32px]">
				<div
					className="w-full h-full flex items-center justify-center border rounded-md bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer text-muted-foreground"
					onClick={async () => {
						await copyToClipboard(message.content as string);
						toast.success("Copied to clipboard!");
					}}
					suppressHydrationWarning
				>
					<CopyIcon />
				</div>
			</div>

			<div className="w-[32px] h-[32px]">
				<div
					className={cn("w-full h-full flex items-center justify-center border rounded-md bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer text-muted-foreground", {
						"text-green-500": vote?.isUpvoted,
					})}
					onClick={async () => {
						const messageId = getMessageIdFromAnnotations(message);
						if (!messageId) {
							toast.error("Something went wrong, please try again!");
							return;
						}

						await fetch("/api/vote", {
							method: "POST",
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
				</div>
			</div>

			<div className="w-[32px] h-[32px]">
				<div
					className={cn("w-full h-full flex items-center justify-center border rounded-md bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer text-muted-foreground", {
						"text-red-500": vote && !vote.isUpvoted,
					})}
					onClick={async () => {
						const messageId = getMessageIdFromAnnotations(message);
						if (!messageId) {
							toast.error("Something went wrong, please try again!");
							return;
						}

						await fetch("/api/vote", {
							method: "POST",
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
				</div>
			</div>

			<div className="w-[32px] h-[32px]">
				<div
					className="w-full h-full flex items-center justify-center border rounded-md bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer text-muted-foreground"
					onClick={async () => {
						const messageId = getMessageIdFromAnnotations(message);
						if (!messageId) {
							toast.error("Something went wrong, please try again!");
							return;
						}

						try {
							await fetch(`/api/message?id=${messageId}`, {
								method: "DELETE",
							});

							// Refresh the messages
							window.location.reload();

							toast.success("Message deleted successfully");
						} catch (error) {
							console.error("Error deleting message:", error);
							toast.error("Failed to delete message");
						}
					}}
					suppressHydrationWarning
				>
					<TrashIcon />
				</div>
			</div>
		</div>
	);
}

export const MessageActions = memo(PureMessageActions, (prevProps, nextProps) => {
	if (!equal(prevProps.vote, nextProps.vote)) return false;
	if (prevProps.isLoading !== nextProps.isLoading) return false;

	return true;
});
