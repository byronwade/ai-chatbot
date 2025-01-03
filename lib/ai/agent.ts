import { ollama } from "ollama-ai-provider";
import { generateText, type CoreMessage } from "ai";
import { tools } from "./tools/index";
import { getModel, type ModelId, type AIModel } from "./models";

export interface SEOAgentOptions {
	modelId: string;
	chatId: string;
	userId: string;
}

export class SEOAgent {
	private model: AIModel;
	private chatId: string;
	private userId: string;

	constructor(options: SEOAgentOptions) {
		this.model = getModel(options.modelId as ModelId);
		this.chatId = options.chatId;
		this.userId = options.userId;
	}

	async chat(messages: CoreMessage[]) {
		try {
			console.log("Incoming messages:", JSON.stringify(messages, null, 2));

			// Primary tool-enabled chat with streaming
			const stream = await generateText({
				model: ollama(this.model.apiIdentifier),
				messages,
				tools,
				toolChoice: "auto",
				maxSteps: 25,
				temperature: 0.7,
				system: "You are a helpful AI assistant with SEO expertise. You can analyze websites, crawl pages, and provide recommendations. IMPORTANT: Never provide fake or made-up data. If you cannot get real data with at least 60% confidence from the tools, inform the user that you cannot provide accurate information for their request. It's better to admit when you don't have enough confidence in the data than to provide potentially incorrect information.",
				onStepFinish({ text, toolCalls, toolResults }) {
					console.log("Step completed:", {
						text: text || "[No text yet]",
						toolCalls:
							toolCalls?.map((t) => ({
								name: t.toolName,
								args: t.args,
							})) || [],
						results: toolResults || [],
					});
				},
			});

			return stream;
		} catch (error: unknown) {
			console.error("Error in chat:", error);

			// Fallback to a non-tool, non-streamed request if something goes wrong
			const fallbackResult = await generateText({
				model: ollama(this.model.apiIdentifier),
				messages,
				temperature: 0.7,
			});
			return fallbackResult;
		}
	}
}
