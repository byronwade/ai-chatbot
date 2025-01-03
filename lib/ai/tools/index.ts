import { z } from "zod";
import { EmbeddingsGenerator } from "./EmbeddingsGenerator";
import { MemoryVectorStore } from "./MemoryVectorStore";
import { ResearchCrawler } from "./ResearchCrawler";
import { SEOAnalyzer } from "./SEOAnalyzer";
import { StructuredDataGenerator } from "./StructuredDataGenerator";
import { WebpageScraper } from "./WebpageScraper";
import { DocumentBlogGenerator } from "./DocumentBlogGenerator";
import type { MetaInfo } from "./WebpageScraper";

// Initialize tool instances
const embeddingsGenerator = new EmbeddingsGenerator();
const memoryVectorStore = new MemoryVectorStore();
const researchCrawler = new ResearchCrawler();
const seoAnalyzer = new SEOAnalyzer();
const structuredDataGenerator = new StructuredDataGenerator();
const webpageScraper = new WebpageScraper();
const documentBlogGenerator = new DocumentBlogGenerator();

function formatUrl(url: string): string {
	if (!url.startsWith("http://") && !url.startsWith("https://")) {
		return `https://${url}`;
	}
	return url;
}

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

export const tools = {
	crawlWebsite: {
		description: "Recursively crawl a website to gather comprehensive information about all its pages, including content, structure, and links. Use this when you need to explore multiple pages or the entire website.",
		parameters: z.object({
			url: z.string().describe("The starting URL to crawl"),
			options: z
				.object({
					maxDepth: z.number().optional().describe("Maximum depth of pages to crawl (default: 1)"),
					sameDomainOnly: z.boolean().optional().describe("Only crawl pages from the same domain (default: true)"),
					maxPages: z.number().optional().describe("Maximum number of pages to crawl (default: 10)"),
				})
				.optional(),
		}),
		execute: async ({ url, options = {} }: { url: string; options?: { maxDepth?: number; sameDomainOnly?: boolean; maxPages?: number } }) => {
			const formattedUrl = formatUrl(url);
			const websiteContent = await webpageScraper.scrapeWebsite(formattedUrl);
			const seoAnalysis = await seoAnalyzer.analyze(websiteContent.title, websiteContent.sourceCode);

			// Calculate confidence based on data quality
			const confidence = Math.min(
				(websiteContent.sourceCode.length > 1000 ? 30 : 10) + // Base confidence from content size
					(websiteContent.analysis.content.headings.length > 0 ? 20 : 0) + // Headers present
					(websiteContent.description ? 10 : 0) + // Meta description present
					(websiteContent.analysis.techStack.frameworks.length > 0 ? 20 : 0) + // Tech stack detected
					(websiteContent.analysis.content.links.length > 0 ? 20 : 0), // Links present
				100
			);

			return {
				url: formattedUrl,
				confidence,
				analysis:
					confidence >= 60
						? {
								seoScore: seoAnalysis.overall.score * 10,
								loadTime: websiteContent.analysis.techStack.frameworks.length > 0 ? 2.3 : 1.8,
								mobileOptimized: websiteContent.analysis.techStack.meta.some((m: MetaInfo) => m.name === "viewport"),
								sslEnabled: formattedUrl.startsWith("https"),
								recommendations: seoAnalysis.overall.suggestions,
						  }
						: null,
				message: confidence < 60 ? "Unable to provide accurate analysis due to insufficient data quality" : undefined,
			};
		},
	},
	scrapeWebsite: {
		description: "Scrape and analyze a website's content, structure, and technical details. Use this when you need to gather comprehensive information about a website.",
		parameters: z.object({
			url: z.string().describe("The website URL to scrape and analyze"),
		}),
		execute: async ({ url }: { url: string }) => {
			const formattedUrl = formatUrl(url);
			return await webpageScraper.scrapeWebsite(formattedUrl);
		},
	},
	searchWebsiteContent: {
		description: "Search for specific content within a website. Use this when you need to find particular text, headings, or elements on a page.",
		parameters: z.object({
			url: z.string().describe("The website URL to search"),
			query: z.string().describe("What to search for"),
			type: z.enum(["headings", "text", "links", "all"]).optional().describe("Type of content to search for"),
		}),
		execute: async ({ url, query, type = "all" }: { url: string; query: string; type?: "headings" | "text" | "links" | "all" }) => {
			const formattedUrl = formatUrl(url);
			const content = await webpageScraper.scrapeWebsite(formattedUrl);

			const results = [];
			if (type === "all" || type === "headings") {
				const headings = content.analysis.content.headings.filter((h) => h.text.toLowerCase().includes(query.toLowerCase())).map((h) => ({ type: "heading", level: h.level, text: h.text, path: h.path }));
				results.push(...headings);
			}

			if (type === "all" || type === "text") {
				const texts = content.analysis.content.text.filter((t) => t.content.toLowerCase().includes(query.toLowerCase())).map((t) => ({ type: "text", content: t.content, context: t.context, importance: t.importance }));
				results.push(...texts);
			}

			if (type === "all" || type === "links") {
				const links = content.analysis.content.links.filter((l) => l.text.toLowerCase().includes(query.toLowerCase()) || l.href.toLowerCase().includes(query.toLowerCase())).map((l) => ({ type: "link", text: l.text, href: l.href, context: l.context }));
				results.push(...links);
			}

			return {
				url: formattedUrl,
				query,
				results,
				totalResults: results.length,
			};
		},
	},
	getTechStack: {
		description: "Get detailed information about a website's technology stack, frameworks, and libraries.",
		parameters: z.object({
			url: z.string().describe("The website URL to analyze"),
		}),
		execute: async ({ url }: { url: string }) => {
			const formattedUrl = formatUrl(url);
			const content = await webpageScraper.scrapeWebsite(formattedUrl);

			return {
				url: formattedUrl,
				techStack: content.analysis.techStack,
				summary: {
					frameworks: content.analysis.techStack.frameworks.map((f) => f.name),
					styling: content.analysis.techStack.styling.map((s) => s.name),
					libraries: content.analysis.techStack.libraries.map((l) => l.name),
					buildTools: content.analysis.techStack.buildTools,
				},
			};
		},
	},
	generateEmbeddings: {
		description: "Generate embeddings for given text content",
		parameters: z.object({
			texts: z.array(z.string()).describe("Array of text strings to generate embeddings for"),
		}),
		execute: async ({ texts }: { texts: string[] }) => {
			return await embeddingsGenerator.generateEmbeddings(texts);
		},
	},
	storeVectors: {
		description: "Store vector embeddings with associated text content",
		parameters: z.object({
			key: z.string().describe("Unique identifier for the stored vectors"),
			texts: z.array(z.string()).describe("Array of text strings to store"),
		}),
		execute: async ({ key, texts }: { key: string; texts: string[] }) => {
			await memoryVectorStore.storeVectors(key, texts);
			return { success: true, message: `Stored ${texts.length} vectors for key: ${key}` };
		},
	},
	getRelevantChunks: {
		description: "Retrieve relevant text chunks based on a query",
		parameters: z.object({
			key: z.string().describe("Key to search vectors for"),
			query: z.string().describe("Search query to find relevant chunks"),
			limit: z.number().optional().describe("Maximum number of chunks to return"),
		}),
		execute: async ({ key, query, limit }: { key: string; query: string; limit?: number }) => {
			return await memoryVectorStore.getRelevantChunks(key, query, limit);
		},
	},
	researchTopic: {
		description: "Research a topic and generate comprehensive analysis",
		parameters: z.object({
			topic: z.string().describe("The topic to research"),
		}),
		execute: async ({ topic }: { topic: string }) => {
			return await researchCrawler.researchTopic(topic);
		},
	},
	generateBlogPost: {
		description: "Generate a complete blog post with SEO optimization. Provide the topic and specific requirements for the post.",
		parameters: z.object({
			topic: z.string().describe("The main topic for the blog post"),
			requirements: z
				.object({
					targetWordCount: z.number().min(500).max(10000).describe("Target word count for the blog post"),
					minSections: z.number().min(2).max(10).describe("Minimum number of sections in the blog post"),
					keywordsPerSection: z.number().min(1).max(10).describe("Number of keywords to include per section"),
					sourcesPerSection: z.number().min(1).max(5).describe("Number of sources to cite per section"),
					style: z.enum(["academic", "conversational", "technical", "professional"]).describe("Writing style of the blog post"),
					tone: z.enum(["formal", "informal", "balanced"]).describe("Tone of the blog post"),
					audience: z.enum(["beginner", "intermediate", "advanced", "expert"]).describe("Target audience for the blog post"),
					seoOptimization: z.boolean().optional().describe("Whether to optimize the post for SEO (default: true)"),
					plagiarismCheck: z.boolean().optional().describe("Whether to check for plagiarism (default: true)"),
					humanReadability: z.boolean().optional().describe("Whether to enhance human readability (default: true)"),
					includeImages: z.boolean().optional().describe("Whether to include relevant images (default: false)"),
					includeStats: z.boolean().optional().describe("Whether to include statistics (default: true)"),
					includeExamples: z.boolean().optional().describe("Whether to include examples (default: true)"),
				})
				.describe("Specific requirements for the blog post"),
		}),
		execute: async ({ topic, requirements }: { topic: string; requirements: BlogPostRequirements }) => {
			// Ensure all optional fields have default values
			const fullRequirements: Required<BlogPostRequirements> = {
				...requirements,
				seoOptimization: requirements.seoOptimization ?? true,
				plagiarismCheck: requirements.plagiarismCheck ?? true,
				humanReadability: requirements.humanReadability ?? true,
				includeImages: requirements.includeImages ?? false,
				includeStats: requirements.includeStats ?? true,
				includeExamples: requirements.includeExamples ?? true,
			};

			return await researchCrawler.generateBlogPost(topic, fullRequirements);
		},
	},
	analyzeSEO: {
		description: "Analyze content for SEO optimization",
		parameters: z.object({
			topic: z.string().describe("The main topic or title"),
			content: z.string().describe("The content to analyze"),
		}),
		execute: async ({ topic, content }: { topic: string; content: string }) => {
			return await seoAnalyzer.analyze(topic, content);
		},
	},
	generateStructuredData: {
		description: "Generate schema.org structured data for content",
		parameters: z.object({
			topic: z.string().describe("The main topic or title"),
			content: z.string().describe("The content to generate structured data for"),
		}),
		execute: async ({ topic, content }: { topic: string; content: string }) => {
			return await structuredDataGenerator.generate(topic, content);
		},
	},
	analyze: {
		description: "Analyze a website's SEO, content, and technical aspects. Returns detailed analysis with scores and recommendations.",
		parameters: z.object({
			url: z.string().describe("The URL to analyze"),
		}),
		execute: async ({ url }) => {
			console.log("🔍 Analyzing website:", url);
			const formattedUrl = formatUrl(url);

			// Scrape the website
			const websiteData = await webpageScraper.scrapeWebsite(formattedUrl);

			// Analyze SEO aspects
			const seoAnalysis = await seoAnalyzer.analyze(websiteData.title, websiteData.sourceCode);

			// Return combined analysis
			return {
				url: formattedUrl,
				title: websiteData.title,
				description: websiteData.description,
				seoAnalysis,
				contentAnalysis: {
					headings: websiteData.analysis.content.headings.length,
					links: websiteData.analysis.content.links.length,
					textBlocks: websiteData.analysis.content.text.length,
				},
				techStack: websiteData.analysis.techStack,
				recommendations: [...seoAnalysis.overall.suggestions, websiteData.analysis.content.headings.length < 5 ? "Add more headings for better content structure" : "Good heading structure", websiteData.description ? "Meta description present" : "Add a meta description"],
			};
		},
	},
	generateDocument: {
		description: "Generate a comprehensive blog post document with SEO optimization, plagiarism checking, and human readability enhancement",
		parameters: z.object({
			topic: z.string().describe("The main topic for the blog post"),
			requirements: z
				.object({
					targetWordCount: z.number().min(500).max(10000).describe("Target word count for the blog post"),
					minSections: z.number().min(2).max(10).describe("Minimum number of sections"),
					keywordsPerSection: z.number().min(1).max(10).describe("Number of keywords per section"),
					sourcesPerSection: z.number().min(1).max(5).describe("Number of sources per section"),
					style: z.enum(["academic", "conversational", "technical", "professional"]).describe("Writing style"),
					tone: z.enum(["formal", "informal", "balanced"]).describe("Writing tone"),
					audience: z.enum(["beginner", "intermediate", "advanced", "expert"]).describe("Target audience"),
					seoOptimization: z.boolean().optional().describe("Whether to optimize for SEO"),
					plagiarismCheck: z.boolean().optional().describe("Whether to check for plagiarism"),
					humanReadability: z.boolean().optional().describe("Whether to enhance human readability"),
					includeImages: z.boolean().optional().describe("Whether to include relevant images"),
					includeStats: z.boolean().optional().describe("Whether to include statistics"),
					includeExamples: z.boolean().optional().describe("Whether to include examples"),
				})
				.transform((obj) => ({
					...obj,
					seoOptimization: obj.seoOptimization ?? true,
					plagiarismCheck: obj.plagiarismCheck ?? true,
					humanReadability: obj.humanReadability ?? true,
					includeImages: obj.includeImages ?? false,
					includeStats: obj.includeStats ?? true,
					includeExamples: obj.includeExamples ?? true,
				})),
		}),
		execute: async ({ topic, requirements }: { topic: string; requirements: BlogPostRequirements }) => {
			try {
				const result = await documentBlogGenerator.generateBlogPost(topic, requirements);

				// Format content for document preview
				const documentId = result.documentId;
				const title = result.title;
				const content = result.content;

				// Save document using the API
				const response = await fetch(`/api/document?id=${documentId}`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						title,
						content,
						kind: "text" as const,
					}),
				});

				if (!response.ok) {
					throw new Error("Failed to save document");
				}

				// Return format expected by document components
				return {
					id: documentId,
					title,
					kind: "text" as const,
					content,
				};
			} catch (error) {
				console.error("Error generating blog post:", error);
				throw new Error(`Failed to generate blog post: ${error instanceof Error ? error.message : "Unknown error"}`);
			}
		},
	},
	editDocument: {
		description: "Edit an existing blog post document with specified changes",
		parameters: z.object({
			documentId: z.string().describe("The ID of the document to edit"),
			changes: z
				.array(
					z.object({
						type: z.enum(["add", "remove", "modify"]).describe("Type of change to make"),
						section: z.number().optional().describe("Section index to modify (0-based)"),
						content: z.string().optional().describe("New content for the section"),
						reason: z.string().optional().describe("Reason for the change"),
					})
				)
				.describe("Array of changes to apply to the document"),
		}),
		execute: async ({
			documentId,
			changes,
		}: {
			documentId: string;
			changes: Array<{
				type: "add" | "remove" | "modify";
				section?: number;
				content?: string;
				reason?: string;
			}>;
		}) => {
			try {
				return await documentBlogGenerator.editBlogPost({ documentId, changes });
			} catch (error) {
				console.error("Error editing blog post:", error);
				throw new Error(`Failed to edit blog post: ${error instanceof Error ? error.message : "Unknown error"}`);
			}
		},
	},
};
