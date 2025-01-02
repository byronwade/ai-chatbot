import { ollama } from "ollama-ai-provider";
import { streamText } from "ai";

export class NLUEnhancer {
	private model: ReturnType<typeof ollama>;

	constructor() {
		this.model = ollama("llama3-gradient");
	}

	async enhanceContent(content: string): Promise<string> {
		console.log("Enhancing content with NLU");

		const result = await streamText({
			model: this.model,
			system: `You are an AI assistant specialized in natural language understanding and enhancement.
      Your task is to improve the given content by:
      1. Enhancing clarity and readability
      2. Adding natural transitions
      3. Improving sentence structure
      4. Maintaining the original meaning and tone`,
			messages: [
				{
					role: "user",
					content: `Please enhance this content while keeping its core message intact: "${content}"`,
				},
			],
		});

		// Convert stream to text
		let enhancedText = "";
		for await (const chunk of result.textStream) {
			enhancedText += chunk;
		}

		return enhancedText;
	}

	async analyzeReadability(content: string): Promise<{
		score: number;
		suggestions: string[];
	}> {
		const result = await streamText({
			model: this.model,
			system: `You are an AI assistant specialized in analyzing text readability.
      Analyze the given content and provide:
      1. A readability score from 0-100
      2. Specific suggestions for improvement`,
			messages: [
				{
					role: "user",
					content: `Analyze the readability of this content: "${content}"`,
				},
			],
		});

		// Convert stream to text
		let analysisText = "";
		for await (const chunk of result.textStream) {
			analysisText += chunk;
		}

		// Parse the analysis
		const lines = analysisText.split("\n");
		const score = parseInt(lines[0]) || 70; // Default to 70 if parsing fails
		const suggestions = lines.slice(1).filter((line) => line.trim().length > 0);

		return {
			score,
			suggestions,
		};
	}
}
