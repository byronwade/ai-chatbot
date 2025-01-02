import { createOllama } from 'ollama-ai-provider';
import { logWithTimestamp } from "../utils";

// Constants for performance tuning
const OLLAMA_BASE_URL = "http://localhost:11434/api";
const OLLAMA_TIMEOUT = 30000; // 30 seconds

// Initialize Ollama provider with optimized configuration
export const ollama = createOllama({
	baseURL: OLLAMA_BASE_URL,
	headers: {
		"Content-Type": "application/json",
		Accept: "application/x-ndjson",
		"Cache-Control": "no-cache",
		Connection: "keep-alive",
	},
	fetch: async (url, init) => {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT);

		try {
			const response = await fetch(url, {
				...init,
				signal: controller.signal,
				keepalive: true,
				headers: {
					...init?.headers,
					Accept: "application/x-ndjson",
					"Cache-Control": "no-cache",
					Connection: "keep-alive",
				},
			});

			if (!response.ok) {
				throw new Error(`Ollama HTTP error! status: ${response.status}`);
			}

			return response;
		} finally {
			clearTimeout(timeoutId);
		}
	},
});

// Helper function to check Ollama connection
async function checkOllamaConnection(): Promise<boolean> {
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for health check

		const response = await fetch(`${OLLAMA_BASE_URL}/version`, {
			signal: controller.signal,
			headers: {
				Connection: "keep-alive",
			},
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			logWithTimestamp("[Ollama] Service check failed:", response.statusText);
			return false;
		}
		const data = await response.json();
		logWithTimestamp("[Ollama] Service version:", data.version);
		return true;
	} catch (error) {
		logWithTimestamp("[Ollama] Connection check error:", error);
		return false;
	}
}

// Perform initial connection check
checkOllamaConnection()
	.then((isAvailable) => {
		if (!isAvailable) {
			logWithTimestamp("[Ollama] Warning: Ollama service is not available");
		} else {
			logWithTimestamp("[Ollama] Successfully connected to Ollama service");
		}
	})
	.catch((error) => {
		logWithTimestamp("[Ollama] Error checking connection:", error);
	}); 