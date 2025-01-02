import { ollama } from "ollama-ai-provider";
import { generateText, tool } from "ai";
import { z } from "zod";
import { WebpageScraper } from "./tools/WebpageScraper";
import { ResearchCrawler } from "./tools/ResearchCrawler";
import { StructuredDataGenerator } from "./tools/StructuredDataGenerator";

const scraper = new WebpageScraper(3, 20);
const researcher = new ResearchCrawler();
const structuredDataGen = new StructuredDataGenerator();

// Test functions for each tool
const testTools = {
	async testScraper(url: string, depth = 0) {
		console.log(`\nAnalyzing website: ${url} with depth ${depth}...`);
		try {
			const result = await scraper.scrapeWebsite(url, "test_user", depth);
			console.log("✓ Analysis successful");
			console.log(`SEO Score: ${result.seoAnalysis?.score || 'N/A'}/100`);
			console.log("\nKey Metrics:");
			console.log("Title:", result.title);
			console.log("Description:", result.description);
			if (result.seoAnalysis?.content?.keywordDensity) {
				console.log("Top Keywords:", Object.entries(result.seoAnalysis.content.keywordDensity)
					.slice(0, 5)
					.map(([word, density]) => `${word} (${density}%)`)
					.join(", ")
				);
			}
			return result;
		} catch (error) {
			console.error("✗ Analysis failed:", error.message);
			throw error;
		}
	},

	async testResearch(topic: string) {
		console.log(`\nResearching topic: "${topic}"`);
		try {
			const result = await researcher.researchTopic(topic);
			console.log("✓ Research completed");
			console.log("\nKey Findings:");
			result.keyFindings.forEach((finding, i) => console.log(`${i + 1}. ${finding}`));
			console.log("\nTrends:");
			console.log("Emerging:", result.trendAnalysis.emerging.join(", "));
			console.log("Established:", result.trendAnalysis.established.join(", "));
			return result;
		} catch (error) {
			console.error("✗ Research failed:", error.message);
			throw error;
		}
	}
};

async function runAgent(userInput: string) {
	const streamOutput = (message: string) => {
		process.stdout.write(message);
	};

	try {
		const { text: response, steps } = await generateText({
			model: ollama("llama3.1"),
			tools: {
				analyzeWebsite: tool({
					description: "Analyze a website to understand its content, structure, and SEO performance",
					parameters: z.object({
						url: z.string().url().describe("The URL of the website to analyze"),
						depth: z.coerce.number().gte(0).lte(3).default(0).describe("How deep to analyze (0-3)"),
					}),
					execute: async ({ url, depth = 0 }) => {
						streamOutput(`\nAnalyzing website: ${url} (depth ${depth})\n`);
						try {
							const result = await scraper.scrapeWebsite(url, "AI Assistant", depth);
							streamOutput(`✓ Analysis complete\n`);
							streamOutput(`  SEO Score: ${result.seoAnalysis?.score || 'N/A'}/100\n`);
							return JSON.stringify(result, null, 2);
						} catch (error) {
							const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
							streamOutput(`✗ Analysis failed: ${errorMessage}\n`);
							throw error;
						}
					},
				}),

				generateBlogPost: tool({
					description: "Generate a comprehensive blog post with research and SEO optimization",
					parameters: z.object({
						topic: z.string().describe("The topic to write about"),
						wordCount: z.number().min(100).max(10000).default(3000).describe("Target word count"),
						style: z.enum(['academic', 'conversational', 'technical', 'professional']).default('professional'),
						tone: z.enum(['formal', 'informal', 'balanced']).default('balanced'),
						audience: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).default('intermediate'),
						seedUrls: z.array(z.string().url()).optional().describe("Optional list of URLs to start research from")
					}),
					execute: async ({ topic, wordCount, style, tone, audience, seedUrls = [] }) => {
						streamOutput(`\nGenerating ${wordCount}-word blog post about: ${topic}\n`);
						try {
							const requirements = {
								targetWordCount: wordCount,
								minSections: Math.max(3, Math.ceil(wordCount / 500)),
								keywordsPerSection: 3,
								sourcesPerSection: 2,
								style,
								tone,
								audience
							};

							const post = await researcher.generateBlogPost(topic, requirements);
							
							streamOutput(`✓ Blog post generated\n`);
							streamOutput(`  Title: ${post.title}\n`);
							streamOutput(`  Sections: ${post.sections.length}\n`);
							streamOutput(`  Word count: ${post.totalWordCount}\n`);
							streamOutput(`  SEO score: ${post.seoScore}/100\n\n`);
							
							return JSON.stringify(post, null, 2);
						} catch (error) {
							const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
							streamOutput(`✗ Blog post generation failed: ${errorMessage}\n`);
							throw error;
						}
					},
				}),

				generateStructuredData: tool({
					description: "Generate SEO-optimized structured data markup for content",
					parameters: z.object({
						topic: z.string().describe("The main topic or title of the content"),
						content: z.string().describe("The main content to generate structured data for"),
					}),
					execute: async ({ topic, content }) => {
						streamOutput(`\nGenerating structured data for: ${topic}\n`);
						const result = await structuredDataGen.generate(topic, content);
						streamOutput(`✓ Generated structured data schemas\n`);
						return JSON.stringify(result, null, 2);
					},
				}),
			},
			maxSteps: 10,
			system: `You are an expert AI blog post writer and SEO specialist. Your capabilities include:

					Research & Analysis:
					- Deep website analysis for content and SEO insights
					- Comprehensive topic research across authoritative sources
					- Trend analysis and key findings extraction
					- Source verification and authority scoring
					
					Blog Post Generation:
					1. Analyze the user's website to understand their style and topics
					2. Research the topic thoroughly using multiple sources
					3. Generate well-structured, SEO-optimized blog posts
					4. Include relevant statistics and quotes from research
					5. Add appropriate structured data markup
					
					When generating blog posts:
					- Maintain consistent style with the website
					- Include relevant statistics and quotes
					- Optimize for search engines
					- Structure content with proper headings
					- Add meta descriptions and structured data
					
					Always provide:
					- Research-backed content
					- Proper citations and sources
					- SEO optimization suggestions
					- Structured data recommendations
					
					When analyzing a website and generating a blog post:
					1. First analyze the website to understand its style and existing content
					2. Choose a relevant topic based on the website's focus and gaps
					3. Research the topic thoroughly
					4. Generate a comprehensive blog post that matches the site's style
					5. Optimize for SEO and provide structured data`,
			prompt: userInput,
		});

		// Log all steps with streaming output
		steps?.forEach((step, index) => {
			streamOutput(`\nStep ${index + 1}:\n`);
			if (step.toolCalls) {
				streamOutput(JSON.stringify(step.toolCalls, null, 2) + '\n');
			}
		});

		streamOutput("\nAI Response:\n" + response + "\n");
		return response;
	} catch (error) {
		console.error("Error:", error);
		return "Sorry, there was an error processing your request.";
	}
}

// Parse command line arguments
const args = process.argv.slice(2);
const isTestMode = args[0] === "--test";

if (isTestMode) {
	const [_, tool, ...toolArgs] = args;
	
	switch (tool) {
		case "analyze":
			testTools.testScraper(toolArgs[0], parseInt(toolArgs[1] || "0"))
				.catch(console.error);
			break;
		case "research":
			testTools.testResearch(toolArgs.join(" "))
				.catch(console.error);
			break;
		default:
			console.log(`
Available test commands:
  npx tsx node.ts --test analyze <url> [depth]     Test website analysis
  npx tsx node.ts --test research <topic>          Test topic research
            `);
	}
} else {
	const userInput = args[0] || "Please analyze my website at https://example.com and suggest a blog post topic";
	console.log("User Input:", userInput);
	runAgent(userInput).catch(console.error);
}
