import { ollama } from "ollama-ai-provider";

interface Document {
	pageContent: string;
	metadata: { key: string };
	embedding?: number[];
}

export class MemoryVectorStore {
	private documents: Document[] = [];
	private embeddingModel: ReturnType<typeof ollama.embedding>;

	constructor() {
		this.embeddingModel = ollama.embedding("llama3-gradient");
	}

	async storeVectors(key: string, texts: string[]): Promise<void> {
		console.log(`Storing vectors for ${key}`);
		const { embeddings } = await this.embeddingModel.doEmbed({
			values: texts,
		});

		const documents = texts.map((text, index) => ({
			pageContent: text,
			metadata: { key },
			embedding: embeddings[index],
		}));

		this.documents.push(...documents);
	}

	async getRelevantChunks(key: string, query: string, limit: number = 5): Promise<string[]> {
		console.log(`Retrieving relevant chunks for ${key}`);

		// Get query embedding
		const {
			embeddings: [queryEmbedding],
		} = await this.embeddingModel.doEmbed({
			values: [query],
		});

		// Filter documents by key and compute cosine similarity
		const results = this.documents
			.filter((doc) => doc.metadata.key === key)
			.map((doc) => ({
				document: doc,
				score: this.cosineSimilarity(queryEmbedding, doc.embedding!),
			}))
			.sort((a, b) => b.score - a.score)
			.slice(0, limit);

		return results.map((result) => result.document.pageContent);
	}

	private cosineSimilarity(a: number[], b: number[]): number {
		const dotProduct = a.reduce((sum, value, i) => sum + value * b[i], 0);
		const magnitudeA = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
		const magnitudeB = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));
		return dotProduct / (magnitudeA * magnitudeB);
	}
}
