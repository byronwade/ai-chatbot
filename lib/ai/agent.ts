import { ollama } from "ollama-ai-provider";
import { openai } from "./openai";
import { google } from "./gemini";
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
			// Filter out empty messages
			const filteredMessages = messages.filter((msg) => msg.content && typeof msg.content === "string" && msg.content.trim() !== "");

			console.log("Filtered messages:", JSON.stringify(filteredMessages, null, 2));

			const result = await generateText({
				model: this.getProviderModel(),
				messages: [
					{
						role: "system",
						content: `You are an SEO expert assistant. You have access to powerful tools that you must use to provide accurate information:

1. ALWAYS use the analyze tool when asked about a website
2. ALWAYS use the generateBlogPost tool when asked to write content
3. ALWAYS use the crawlWebsite tool for deep website analysis
4. ALWAYS use the getTechStack tool when asked about technologies
5. NEVER make up data or statistics - only use data from tool results
6. When a tool returns results, you MUST use those exact results in your response. Format them like this:

Tool Results:
\`\`\`json
{tool results here}
\`\`\`

Analysis:
[Your analysis based on the tool results]

7. Format your responses in a clear, structured way using markdown

Remember: You must NEVER make up information. Only use data returned by the tools.`,
					},
					...filteredMessages,
				],
				tools,
				toolChoice: "auto",
				maxSteps: 25,
				temperature: 0.7,
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

			return result;
		} catch (error: unknown) {
			console.error("Error in chat:", error);
			// If it's a Google API error, try to provide more specific error information
			if (this.model.provider === "google") {
				const googleError = error as any;
				if (googleError.status) {
					throw new Error(`Google API Error (${googleError.status}): ${googleError.message}`);
				}
			}
			throw error;
		}
	}

	private getProviderModel() {
		switch (this.model.provider) {
			case "ollama":
				return ollama(this.model.apiIdentifier);
			case "openai":
				return openai(this.model.apiIdentifier);
			case "google":
				return google(this.model.apiIdentifier);
			default:
				throw new Error(`Unsupported provider: ${this.model.provider}`);
		}
	}
}

