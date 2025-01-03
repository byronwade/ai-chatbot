import { nanoid } from "nanoid";
import { ResearchCrawler } from "./ResearchCrawler";
import { SEOAnalyzer } from "./SEOAnalyzer";
import { StructuredDataGenerator } from "./StructuredDataGenerator";
import { EmbeddingsGenerator } from "./EmbeddingsGenerator";
import { MemoryVectorStore } from "./MemoryVectorStore";

interface BlogPostRequirements {
	targetWordCount: number;
	minSections: number;
	keywordsPerSection: number;
	sourcesPerSection: number;
	style: "academic" | "conversational" | "technical" | "professional";
	tone: "formal" | "informal" | "balanced";
	audience: "beginner" | "intermediate" | "advanced" | "expert";
	seoOptimization?: boolean;
	plagiarismCheck?: boolean;
	humanReadability?: boolean;
	includeImages?: boolean;
	includeStats?: boolean;
	includeExamples?: boolean;
}

interface BlogPostSection {
	title: string;
	content: string;
	keywords: string[];
	sources: string[];
	readabilityScore?: number;
	uniquenessScore?: number;
}

interface BlogPost {
	title: string;
	sections: BlogPostSection[];
	seoScore: number;
	totalWordCount: number;
	metadata: BlogPostMetadata;
}

interface BlogPostMetadata {
	readabilityScore: number;
	uniquenessScore: number;
	keywordDensity: Record<string, number>;
	lastModified: string;
	version: number;
}

interface BlogPostDraft extends Omit<BlogPost, "metadata"> {
	metadata?: BlogPostMetadata;
}

interface SEOAnalysis {
	overall: {
		score: number;
		suggestions: string[];
	};
}

interface BlogEditRequest {
	documentId: string;
	changes: {
		type: "add" | "remove" | "modify";
		section?: number;
		content?: string;
		reason?: string;
	}[];
}

export class DocumentBlogGenerator {
	private researchCrawler: ResearchCrawler;
	private seoAnalyzer: SEOAnalyzer;
	private structuredDataGenerator: StructuredDataGenerator;
	private embeddingsGenerator: EmbeddingsGenerator;
	private memoryStore: MemoryVectorStore;

	constructor() {
		this.researchCrawler = new ResearchCrawler();
		this.seoAnalyzer = new SEOAnalyzer();
		this.structuredDataGenerator = new StructuredDataGenerator();
		this.embeddingsGenerator = new EmbeddingsGenerator();
		this.memoryStore = new MemoryVectorStore();
	}

	async generateBlogPost(topic: string, requirements: BlogPostRequirements) {
		const documentId = nanoid();
		const research = await this.researchCrawler.researchTopic(topic);

		// Generate initial blog post draft
		const blogPostDraft = (await this.researchCrawler.generateBlogPost(topic, requirements)) as BlogPostDraft;

		// Initialize metadata
		const metadata: BlogPostMetadata = {
			readabilityScore: 0,
			uniquenessScore: 0,
			keywordDensity: {},
			lastModified: new Date().toISOString(),
			version: 1,
		};

		// Create full blog post with metadata
		const blogPost: BlogPost = {
			...blogPostDraft,
			metadata,
		};

		// Check for plagiarism if required
		if (requirements.plagiarismCheck) {
			await this.checkPlagiarism(blogPost);
		}

		// Enhance human readability if required
		if (requirements.humanReadability) {
			await this.enhanceReadability(blogPost);
		}

		// Analyze SEO
		const seoAnalysis = await this.seoAnalyzer.analyze(topic, blogPost.sections.map((s) => s.content).join("\n\n"));

		// Generate structured data
		const structuredData = await this.structuredDataGenerator.generate(topic, blogPost.sections.map((s) => s.content).join("\n\n"));

		// Store embeddings for future similarity checks
		await this.storeEmbeddings(documentId, blogPost);

		// Format the content for the document
		const formattedContent = this.formatBlogPost(blogPost, seoAnalysis, structuredData);

		return {
			documentId,
			title: blogPost.title,
			content: formattedContent,
			seoScore: blogPost.seoScore,
			wordCount: blogPost.totalWordCount,
			research: {
				sources: research.sources.length,
				keyFindings: research.keyFindings,
			},
			metadata: blogPost.metadata,
			structuredData,
		};
	}

	async editBlogPost(request: BlogEditRequest) {
		// Fetch the existing document
		const response = await fetch(`/api/document?id=${request.documentId}`);
		if (!response.ok) {
			throw new Error("Failed to fetch document");
		}

		const document = await response.json();
		const blogPost = this.parseBlogPost(document.content);

		// Apply the requested changes
		for (const change of request.changes) {
			switch (change.type) {
				case "add":
					if (change.content) {
						blogPost.sections.push({
							title: "New Section",
							content: change.content,
							keywords: [],
							sources: [],
						});
					}
					break;
				case "remove":
					if (typeof change.section === "number") {
						blogPost.sections.splice(change.section, 1);
					}
					break;
				case "modify":
					if (typeof change.section === "number" && change.content) {
						blogPost.sections[change.section].content = change.content;
					}
					break;
			}
		}

		// Re-analyze and update metadata
		const seoAnalysis = await this.seoAnalyzer.analyze(blogPost.title, blogPost.sections.map((s) => s.content).join("\n\n"));

		// Update the document
		const updateResponse = await fetch(`/api/document?id=${request.documentId}`, {
			method: "POST",
			body: JSON.stringify({
				title: blogPost.title,
				content: this.formatBlogPost(blogPost, seoAnalysis, null),
				kind: "text" as const,
			}),
		});

		if (!updateResponse.ok) {
			throw new Error("Failed to update document");
		}

		return {
			documentId: request.documentId,
			title: blogPost.title,
			content: blogPost.sections.map((s) => s.content).join("\n\n"),
			changes: request.changes.length,
		};
	}

	private async checkPlagiarism(blogPost: BlogPost) {
		// Generate embeddings for each section
		const embeddings = await this.embeddingsGenerator.generateEmbeddings(blogPost.sections.map((s) => s.content));

		// Check similarity against stored content
		for (let i = 0; i < blogPost.sections.length; i++) {
			const similar = await this.memoryStore.getRelevantChunks("blog_content", blogPost.sections[i].content, 5);

			// Calculate uniqueness score
			blogPost.sections[i].uniquenessScore = 1 - (similar.length > 0 ? 0.2 * similar.length : 0);
		}
	}

	private async enhanceReadability(blogPost: BlogPost) {
		for (const section of blogPost.sections) {
			// Add transition phrases
			section.content = this.addTransitions(section.content);

			// Break long paragraphs
			section.content = this.breakLongParagraphs(section.content);

			// Calculate readability score
			section.readabilityScore = this.calculateReadabilityScore(section.content);
		}
	}

	private async storeEmbeddings(documentId: string, blogPost: BlogPost) {
		const texts = blogPost.sections.map((s) => s.content);
		await this.memoryStore.storeVectors(documentId, texts);
	}

	private addTransitions(content: string): string {
		const transitions = ["Furthermore,", "Moreover,", "In addition,", "However,", "Consequently,"];

		// Add transitions between paragraphs
		const paragraphs = content.split("\n\n");
		return paragraphs.map((p, i) => (i > 0 ? `${transitions[i % transitions.length]} ${p}` : p)).join("\n\n");
	}

	private breakLongParagraphs(content: string): string {
		const maxWords = 150;
		const paragraphs = content.split("\n\n");

		return paragraphs
			.map((p) => {
				const words = p.split(" ");
				if (words.length <= maxWords) return p;

				// Break into smaller paragraphs
				const chunks = [];
				for (let i = 0; i < words.length; i += maxWords) {
					chunks.push(words.slice(i, i + maxWords).join(" "));
				}
				return chunks.join("\n\n");
			})
			.join("\n\n");
	}

	private calculateReadabilityScore(text: string): number {
		// Simple readability score based on sentence and word length
		const sentences = text.split(/[.!?]+/);
		const words = text.split(/\s+/);

		const avgWordsPerSentence = words.length / sentences.length;
		const avgWordLength = words.join("").length / words.length;

		// Score from 0-1, lower is more readable
		return Math.min(1, (avgWordsPerSentence / 20 + avgWordLength / 5) / 2);
	}

	private parseBlogPost(content: string): BlogPost {
		const sections = content.split("##").slice(1);
		const metadata: BlogPostMetadata = {
			readabilityScore: 0,
			uniquenessScore: 0,
			keywordDensity: {},
			lastModified: new Date().toISOString(),
			version: 1,
		};

		return {
			title: content.split("\n")[0].replace("# ", ""),
			sections: sections.map((section) => {
				const [title, ...contentParts] = section.trim().split("\n");
				return {
					title: title.trim(),
					content: contentParts.join("\n").trim(),
					keywords: [],
					sources: [],
				};
			}),
			seoScore: 0,
			totalWordCount: content.split(/\s+/).length,
			metadata,
		};
	}

	private formatBlogPost(blogPost: BlogPost, seoAnalysis: SEOAnalysis, structuredData: Record<string, any> | null): string {
		let content = `# ${blogPost.title}\n\n`;

		// Add SEO metadata
		content += `<!-- SEO Score: ${blogPost.seoScore}/100 -->\n`;
		content += `<!-- Keywords: ${blogPost.sections.flatMap((s) => s.keywords).join(", ")} -->\n\n`;

		// Add structured data if available
		if (structuredData) {
			content += `<script type="application/ld+json">\n${JSON.stringify(structuredData.BlogPosting, null, 2)}\n</script>\n\n`;
		}

		// Add sections
		blogPost.sections.forEach((section) => {
			content += `## ${section.title}\n\n`;
			content += `${section.content}\n\n`;

			if (section.sources.length > 0) {
				content += `Sources:\n`;
				section.sources.forEach((source) => {
					content += `- ${source}\n`;
				});
				content += "\n";
			}

			if (section.readabilityScore !== undefined) {
				content += `<!-- Readability Score: ${section.readabilityScore.toFixed(2)} -->\n`;
			}
			if (section.uniquenessScore !== undefined) {
				content += `<!-- Uniqueness Score: ${section.uniquenessScore.toFixed(2)} -->\n`;
			}
		});

		// Add SEO recommendations
		content += `\n---\nSEO Recommendations:\n`;
		seoAnalysis.overall.suggestions.forEach((suggestion) => {
			content += `- ${suggestion}\n`;
		});

		// Add metadata
		content += `\n---\nMetadata:\n`;
		content += `Last Modified: ${blogPost.metadata.lastModified}\n`;
		content += `Version: ${blogPost.metadata.version}\n`;
		content += `Total Word Count: ${blogPost.totalWordCount}\n`;
		content += `Overall Readability Score: ${blogPost.metadata.readabilityScore.toFixed(2)}\n`;
		content += `Overall Uniqueness Score: ${blogPost.metadata.uniquenessScore.toFixed(2)}\n`;

		return content;
	}
}
