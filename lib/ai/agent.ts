import { ollama } from "ollama-ai-provider";
import { openai } from "./openai";
import { google } from "./gemini";
import { generateText, type CoreMessage } from "ai";
import { tools } from "./tools/index";
import { getModel, type ModelId, type AIModel } from "./models";

interface ToolResult {
	toolName: string;
	args: Record<string, unknown>;
	result: unknown;
}

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

			let finalText = "";
			const toolResults: ToolResult[] = [];

			const result = await generateText({
				model: this.getProviderModel(),
				messages: [
					{
						role: "system",
						content: `You are an SEO expert assistant. You have access to powerful tools that you must use to provide accurate information:

1. ALWAYS use the analyze tool when asked about a website
2. When asked to write a blog post, ALWAYS use the generateBlogPost tool like this:
   generateBlogPost({
     topic: "your topic here",
     requirements: {
       targetWordCount: 1500,
       minSections: 4,
       keywordsPerSection: 5,
       sourcesPerSection: 2,
       style: "professional",  // Must be one of: "academic", "conversational", "technical", "professional"
       tone: "balanced",      // Must be one of: "formal", "informal", "balanced"
       audience: "intermediate", // Must be one of: "beginner", "intermediate", "advanced", "expert"
       seoOptimization: true,
       plagiarismCheck: true,
       humanReadability: true,
       includeImages: false,
       includeStats: true,
       includeExamples: true
     }
   })
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
				onStepFinish(step) {
					if (step.text) {
						finalText = step.text;
					}
					if (step.toolResults) {
						toolResults.push(...(step.toolResults as ToolResult[]));
					}
					console.log("Step completed:", {
						text: step.text || "[No text yet]",
						toolCalls:
							step.toolCalls?.map((t) => ({
								name: t.toolName,
								args: t.args,
							})) || [],
						results: step.toolResults || [],
					});
				},
			});

			// Format the response with tool results if any
			const content = toolResults.length > 0 ? `${finalText || result.text}\n\nTool Results:\n\`\`\`json\n${JSON.stringify(toolResults, null, 2)}\n\`\`\`` : finalText || result.text;

			// Return the response in the format expected by useChat
			return {
				role: "assistant" as const,
				content,
				function_call:
					toolResults.length > 0
						? {
								name: toolResults[0].toolName,
								arguments: JSON.stringify(toolResults[0].args),
						  }
						: undefined,
			};
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

