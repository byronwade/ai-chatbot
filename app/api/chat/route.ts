import { auth } from '@/app/(auth)/auth';
import { logWithTimestamp } from '@/lib/utils';
import { type CoreMessage } from "ai";
import { getModel, type ModelId } from "@/lib/ai/models";
import { SEOAgent } from "@/lib/ai/agent";
import { saveMessages, deleteChatById, saveChat } from "@/lib/db/queries";
import { generateId } from "ai";
import { eq, and } from "drizzle-orm";
import { message } from "@/lib/db/schema";
import { db } from "@/lib/db";

export async function POST(request: Request) {
	try {
		const json = await request.json();
		const { messages, modelId, chatId } = json;

		// Get the session
		const session = await auth();
		if (!session?.user?.id) {
			return new Response("Unauthorized", { status: 401 });
		}

		// Save chat if new
		try {
			await saveChat({
				id: chatId,
				title: "New Chat",
				userId: session.user.id,
			});
		} catch (error: any) {
			if (error?.code !== "SQLITE_CONSTRAINT_PRIMARYKEY") {
				throw error;
			}
		}

		// Save user message
		const latestMessage = messages[messages.length - 1];
		if (latestMessage?.role === "user") {
			await saveMessages({
				messages: [
					{
						id: generateId(),
						chatId,
						content: latestMessage.content,
						role: latestMessage.role,
						createdAt: new Date(),
						userId: session.user.id,
					},
				],
			});
		}

		// Create message ID for streaming
		const messageId = generateId();

		// Initialize empty assistant message
		await saveMessages({
			messages: [
				{
					id: messageId,
					chatId,
					content: "",
					role: "assistant",
					createdAt: new Date(),
					userId: session.user.id,
				},
			],
		});

		// Create agent and get response
		const agent = new SEOAgent({ modelId: modelId as ModelId, chatId, userId: session.user.id });
		const stream = await agent.chat(messages as CoreMessage[]);

		// Return streaming response
		return stream.response;
	} catch (error) {
		console.error("Error in chat route:", error);
		return new Response(
			JSON.stringify({
				error: error instanceof Error ? error.message : "An unexpected error occurred",
			}),
			{ status: 500 }
		);
	}
}

export async function DELETE(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const id = searchParams.get("id");

		if (!id) {
			return new Response("Chat ID is required", { status: 400 });
		}

		// Get the session
		const session = await auth();
		if (!session?.user?.id) {
			return new Response("Unauthorized", { status: 401 });
		}

		logWithTimestamp("Deleting chat:", { chatId: id });
		await deleteChatById({ id });
		logWithTimestamp("Chat deleted successfully:", { chatId: id });

		return new Response("Chat deleted successfully", { status: 200 });
	} catch (error) {
		logWithTimestamp("Error deleting chat:", error);
		return new Response(
			JSON.stringify({
				error: error instanceof Error ? error.message : "An unexpected error occurred",
				type: "DELETE_ERROR",
			}),
			{
				status: 500,
				headers: {
					"Content-Type": "application/json",
				},
			}
		);
	}
} 