import { ollama } from "ollama-ai-provider";
import { generateText, type CoreMessage } from "ai";
import { tools } from "./tools";
import { getModel, type ModelId, type AIModel } from "./models";

export interface SEOAgentOptions {
	modelId: string;
	chatId: string;
	userId: string;
}

export class SEOAgent {
	private model: AIModel;

	constructor(options: SEOAgentOptions) {
		this.model = getModel(options.modelId as ModelId);
	}

	async chat(messages: CoreMessage[]) {
		try {
			// Use streamText for proper streaming support
			const result = await generateText({
				model: ollama(this.model.apiIdentifier),
				messages,
				tools,
				maxSteps: 5,
				temperature: 0.7,
				system: `You are an advanced AI agent specializing in SEO analysis and content optimization.

Your capabilities:
1. Analyze websites and provide SEO insights when requested using the 'analyze' tool
2. Analyze keywords using the 'analyzeKeywords' tool
3. Check meta tags using the 'analyzeMeta' tool
4. Generate meta tags using the 'generateMetaTags' tool

Guidelines:
- For SEO/website analysis: Use the appropriate analysis tools
- For content requests: Provide clear, actionable advice
- For general questions: Respond naturally without using tools
- Always explain your reasoning before and after using tools

Available tools and their JSON formats:
- analyze: { "url": "https://example.com" }
- analyzeKeywords: { "keywords": ["keyword1", "keyword2"] }  // MUST be a JSON array
- analyzeMeta: { "url": "https://example.com" }
- generateMetaTags: {
    "title": "Page Title",
    "description": "Page description",
    "keywords": ["keyword1", "keyword2"]  // MUST be a JSON array
  }

Important: When using tools that require keywords, ALWAYS provide them in proper JSON array format.
CORRECT: { "keywords": ["seo", "optimization"] }
INCORRECT: { "keywords": "['seo', 'optimization']" }

DO NOT try to use any other tools besides these four.`,
			});

			// Log for debugging
			console.log("AI Response started");
			console.log("AI Response:", result.text);

			// Return the stream response
			return result.response;
		} catch (error: unknown) {
			console.error("Error in chat:", error);
			throw error;
		}
	}
}
