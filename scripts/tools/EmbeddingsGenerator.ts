import { ollama } from "ollama-ai-provider";

export class EmbeddingsGenerator {
	private model = ollama.embedding("llama2");

	async generateEmbeddings(texts: string[]): Promise<number[][]> {
		try {
			const { embeddings } = await this.model.doEmbed({
				values: texts,
			});
			return embeddings;
		} catch (error) {
			console.warn("Warning: Embeddings generation failed, using fallback similarity", error);
			// Return simple fallback embeddings based on text length as a backup
			return texts.map(text => [text.length / 100]); 
		}
	}
}
