import { ollama } from "ollama-ai-provider";

export class EmbeddingsGenerator {
	private embeddingModel: ReturnType<typeof ollama.embedding>;

	constructor() {
		this.embeddingModel = ollama.embedding("llama3-gradient");
	}

	async generateEmbeddings(text: string): Promise<number[]> {
		console.log("Generating embeddings");
		try {
			const { embeddings } = await this.embeddingModel.doEmbed({
				values: [text],
			});
			return embeddings[0];
		} catch (error) {
			console.error("Error generating embeddings:", error);
			throw new Error("Failed to generate embeddings");
		}
	}
}
