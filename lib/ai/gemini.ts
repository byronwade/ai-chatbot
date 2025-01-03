import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { logWithTimestamp } from "../utils";

// Initialize Google provider with environment variables
export const google = createGoogleGenerativeAI({
	apiKey: process.env.GEMINI_API_KEY,
	baseURL: "https://generativelanguage.googleapis.com/v1beta",
	headers: {
		"Content-Type": "application/json",
		Accept: "text/event-stream",
		"Cache-Control": "no-cache",
		Connection: "keep-alive",
	},
});

// Helper function to check Gemini connection
async function checkGeminiConnection(): Promise<boolean> {
	try {
		const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
			headers: {
				"x-goog-api-key": process.env.GEMINI_API_KEY!,
				"Content-Type": "application/json",
			},
		});
		if (!response.ok) {
			logWithTimestamp("[Gemini] Service check failed:", response.statusText);
			return false;
		}
		const data = await response.json();
		logWithTimestamp("[Gemini] Service available, models:", data.models?.length);
		return true;
	} catch (error) {
		logWithTimestamp("[Gemini] Connection check error:", error);
		return false;
	}
}

// Perform initial connection check
checkGeminiConnection()
	.then((isAvailable) => {
		if (!isAvailable) {
			logWithTimestamp("[Gemini] Warning: Gemini service is not available");
		} else {
			logWithTimestamp("[Gemini] Successfully connected to Gemini service");
		}
	})
	.catch((error) => {
		logWithTimestamp("[Gemini] Error checking connection:", error);
	});
