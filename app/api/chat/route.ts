import { auth } from '@/app/(auth)/auth';
import { logWithTimestamp } from '@/lib/utils';
import { type CoreMessage, generateText } from "ai";
import { getModel, type ModelId } from "@/lib/ai/models";
import { SEOAgent } from "@/lib/ai/agent";
import { saveMessages, deleteChatById, saveChat } from "@/lib/db/queries";
import { generateId } from "ai";
import { eq, and } from "drizzle-orm";
import { message } from "@/lib/db/schema";
import { db } from "@/lib/db";

// Force the route to be dynamic
export const dynamic = "force-dynamic";
export const maxDuration = 30;

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

		// Create message ID
		const messageId = generateId();

		// Create agent and get response
		const agent = new SEOAgent({ modelId: modelId as ModelId, chatId, userId: session.user.id });
		const result = await agent.chat(messages as CoreMessage[]);

		// Save assistant message
		await saveMessages({
			messages: [
				{
					id: messageId,
					chatId,
					content: result.text,
					role: "assistant",
					createdAt: new Date(),
					userId: session.user.id,
				},
			],
		});

		// Return response in the format expected by useChat
		return Response.json({
			id: messageId,
			role: "assistant",
			content: result.text,
			createdAt: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Error in chat route:", error);
		return new Response(JSON.stringify({ error: "Error processing chat" }), {
			status: 500,
			headers: {
				"Content-Type": "application/json",
			},
		});
	}
}

export async function DELETE(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const id = searchParams.get("id");

		if (!id) {
			return new Response("Missing chat ID", { status: 400 });
		}

		// Get the session
		const session = await auth();
		if (!session?.user?.id) {
			return new Response("Unauthorized", { status: 401 });
		}

		// Delete messages
		await deleteChatById({ id });

		return new Response(null, { status: 204 });
	} catch (error) {
		console.error("Error in chat route:", error);
		return new Response(JSON.stringify({ error: "Error deleting chat" }), {
			status: 500,
			headers: {
				"Content-Type": "application/json",
			},
		});
	}
} 