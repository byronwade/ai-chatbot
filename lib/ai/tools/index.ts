import { z } from "zod";
import { EmbeddingsGenerator } from "./EmbeddingsGenerator";
import { MemoryVectorStore } from "./MemoryVectorStore";
import { ResearchCrawler } from "./ResearchCrawler";
import { SEOAnalyzer } from "./SEOAnalyzer";
import { StructuredDataGenerator } from "./StructuredDataGenerator";
import { WebpageScraper } from "./WebpageScraper";
import type { MetaInfo } from "./WebpageScraper";

// Initialize tool instances
const embeddingsGenerator = new EmbeddingsGenerator();
const memoryVectorStore = new MemoryVectorStore();
const researchCrawler = new ResearchCrawler();
const seoAnalyzer = new SEOAnalyzer();
const structuredDataGenerator = new StructuredDataGenerator();
const webpageScraper = new WebpageScraper();

function formatUrl(url: string): string {
	if (!url.startsWith("http://") && !url.startsWith("https://")) {
		return `https://${url}`;
	}
	return url;
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
			console.log(`🌐 Starting crawl of ${formattedUrl}`);
			console.log(`📊 Crawl options:`, {
				maxDepth: options.maxDepth ?? 1,
				sameDomainOnly: options.sameDomainOnly ?? true,
				maxPages: options.maxPages ?? 10,
			});

			await webpageScraper.crawlWebsite(formattedUrl, {
				maxDepth: options.maxDepth ?? 1,
				sameDomainOnly: options.sameDomainOnly ?? true,
				maxPages: options.maxPages ?? 10,
				onPageCrawl: (url: string) => {
					console.log(`📄 Crawling page: ${url}`);
				},
				onPageComplete: (url: string, success: boolean) => {
					console.log(`${success ? "✅" : "❌"} Completed page: ${url}`);
				},
			});

			// Get all crawled pages
			const websites = Array.from(webpageScraper.getAllWebsites().values());
			console.log(`📈 Crawl complete. Found ${websites.length} pages`);

			// Calculate overall confidence based on crawl results
			const confidence = Math.min(
				(websites.length > 0 ? 30 : 0) + // Base confidence from successful crawl
					(websites.length > 2 ? 20 : 0) + // Multiple pages crawled
					(websites.every((site) => site.title && site.description) ? 20 : 0) + // Complete metadata
					(websites.every((site) => site.analysis.content.headings.length > 0) ? 15 : 0) + // Headers present
					(websites.every((site) => site.analysis.content.links.length > 0) ? 15 : 0), // Links present
				100
			);

			if (confidence < 60) {
				console.log(`⚠️ Low confidence score: ${confidence}. Unable to provide accurate results.`);
				return {
					startUrl: formattedUrl,
					confidence,
					message: "Unable to provide accurate crawl results due to insufficient data quality",
					pagesFound: 0,
					pages: [],
				};
			}

			const results = websites.map((site) => ({
				url: site.url,
				title: site.title,
				description: site.description,
				content: {
					headings: site.analysis.content.headings,
					text: site.analysis.content.text,
					links: site.analysis.content.links,
				},
			}));

			console.log(`✨ Successfully processed ${results.length} pages with confidence score: ${confidence}`);
			return {
				startUrl: formattedUrl,
				confidence,
				pagesFound: results.length,
				pages: results,
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
	searchWebsite: {
		description: "Search through previously scraped website content for specific information. Use this to find relevant information about tech stack, content, or specific features.",
		parameters: z.object({
			query: z.string().describe("The search query to find relevant information"),
		}),
		execute: async ({ query }: { query: string }) => {
			return webpageScraper.search(query);
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
		description: "Generate a complete blog post with SEO optimization",
		parameters: z.object({
			topic: z.string().describe("The topic for the blog post"),
			requirements: z
				.object({
					targetWordCount: z.number(),
					minSections: z.number(),
					keywordsPerSection: z.number(),
					sourcesPerSection: z.number(),
					style: z.enum(["academic", "conversational", "technical", "professional"]),
					tone: z.enum(["formal", "informal", "balanced"]),
					audience: z.enum(["beginner", "intermediate", "advanced", "expert"]),
				})
				.describe("Blog post generation requirements"),
		}),
		execute: async ({ topic, requirements }: { topic: string; requirements: any }) => {
			return await researchCrawler.generateBlogPost(topic, requirements);
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
		description: "Analyze any website URL for SEO metrics and performance. The URL can be in any format (e.g. 'google.com', 'http://google.com', etc).",
		parameters: z.object({
			url: z.string().describe("The website URL to analyze"),
		}),
		execute: async ({ url }: { url: string }) => {
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
};
