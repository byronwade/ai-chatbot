import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db";
import { message } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logWithTimestamp } from "@/lib/utils";

export async function DELETE(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const messageId = searchParams.get("id");

		if (!messageId) {
			return new Response("Message ID is required", { status: 400 });
		}

		// Get the session
		const session = await auth();
		if (!session?.user?.id) {
			return new Response("Unauthorized", { status: 401 });
		}

		logWithTimestamp("Deleting message:", { messageId });
		await db.delete(message).where(eq(message.id, messageId));
		logWithTimestamp("Message deleted successfully:", { messageId });

		return new Response("Message deleted successfully", { status: 200 });
	} catch (error) {
		logWithTimestamp("Error deleting message:", error);
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
