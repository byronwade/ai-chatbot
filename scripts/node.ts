import { ollama } from "ollama-ai-provider";
import { generateText, tool } from "ai";
import { z } from "zod";
import { WebpageScraper } from "./tools/WebpageScraper";

const scraper = new WebpageScraper();
let scrapedPages = new Map<string, any>();

// Helper function to normalize URLs
function normalizeUrl(url: string): string {
	if (!url.startsWith("http://") && !url.startsWith("https://")) {
		url = "https://" + url;
	}
	return url;
}

async function runAgent(userInput: string) {
	try {
		const response = await generateText({
			model: ollama("llama3.1:latest"),
			messages: [
				{
					role: "user",
					content: userInput,
				},
			],
			maxSteps: 25,
			tools: {
				scrapeAndQuery: tool({
					description: "Scrape a webpage and search for specific information within it. Always indexes the entire page content and replaces any existing data.",
					parameters: z.object({
						url: z.string().transform(normalizeUrl),
						query: z.string().describe("What information to look for in the page"),
					}),
					execute: async ({ url, query }) => {
						try {
							url = normalizeUrl(url);

							// Always scrape and reindex
							console.log(`\nIndexing page: ${url}`);
							const result = await scraper.scrapeWebsite(url);

							// Search the newly indexed content
							const results = scraper.search(query);

							console.log("Found matches:", results.length);
							results.forEach((r, i) => console.log(`Match ${i + 1}:`, r.content));

							return {
								matches: results.map((r) => r.content),
								message: results.length > 0 ? results.map((r) => r.content).join("\n---\n") : "No relevant information found",
								indexed: true,
								timestamp: result.timestamp,
							};
						} catch (error) {
							console.error("Error in scrapeAndQuery:", error);
							throw error;
						}
					},
				}),
			},
			system: `You are an expert web analyzer that can scrape and analyze web pages.
			
			When analyzing a webpage:
			1. ALWAYS scrape and reindex the entire page content
			2. Search through both source code and rendered text
			3. Provide detailed, relevant responses based on the actual page content
			
			Remember:
			- The entire page content is stored and searchable
			- You can find information in both the HTML source and rendered text
			- Be thorough in your search and analysis
			
			Your goal is to provide accurate, detailed responses based on the complete page content.`,
		});

		// Handle the response
		if (response && response.text) {
			console.log("\nAI Response:\n" + response.text);
			return response.text;
		} else if (response && response.toolResults && response.toolResults.length > 0) {
			const results = response.toolResults.map((result) => {
				if (typeof result.result === "string") return result.result;
				return result.result.message || JSON.stringify(result.result);
			});
			const finalResponse = results.join("\n\n");
			console.log("\nAI Response:\n" + finalResponse);
			return finalResponse;
		} else {
			console.log("\nRaw response:", response);
			throw new Error("Invalid response format from model");
		}
	} catch (error) {
		console.error("Error:", error);
		if (error.cause) console.error("Cause:", error.cause);
		return "Sorry, there was an error processing your request.";
	}
}

// Parse command line arguments
const args = process.argv.slice(2);
const userInput = args.join(" ") || "Please provide a URL and what you'd like to know about it";
console.log("User Input:", userInput);
runAgent(userInput).catch(console.error);
