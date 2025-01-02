import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import type { Element as DomElement } from 'domhandler';

// Simple logging function
const logWithTimestamp = (message: string, data?: any) => {
	const timestamp = new Date().toISOString();
	console.log(`[${timestamp}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
};

interface ContentSection {
	type: 'heading' | 'paragraph' | 'list' | 'code' | 'table';
	content: string;
	importance: number; // 1-10, higher means more important
	context?: string; // parent heading or section
}

interface SEOAnalysis {
	score: number;  // 0-100
	title: {
		length: number;
		score: number;
		suggestions: string[];
	};
	description: {
		length: number;
		score: number;
		suggestions: string[];
	};
	headings: {
		structure: string[];
		score: number;
		suggestions: string[];
	};
	content: {
		wordCount: number;
		readabilityScore: number;
		keywordDensity: { [keyword: string]: number };
		suggestions: string[];
	};
	structuredData: {
		types: string[];
		score: number;
		suggestions: string[];
		recommended: {
			type: string;
			data: any;
		}[];
	};
	links: {
		internal: number;
		external: number;
		broken: number;
		score: number;
		suggestions: string[];
	};
	images: {
		withAlt: number;
		withoutAlt: number;
		score: number;
		suggestions: string[];
	};
	performance: {
		contentLength: number;
		score: number;
		suggestions: string[];
	};
}

interface ScrapedPage {
	url: string;
	title: string;
	description: string;
	headings: string[];
	sections: ContentSection[];
	summary: string;
	metadata: {
		keywords?: string;
		author?: string;
		robots?: string;
		[key: string]: string | undefined;
	};
	images: { src: string; alt: string }[];
	timestamp: string;
	seoAnalysis: SEOAnalysis;
}

export class WebpageScraper {
	private seen = new Set<string>();
	private maxDepth: number;
	private maxPages: number;
	private readonly CHUNK_SIZE = 1000; // Characters per chunk

	constructor(maxDepth = 2, maxPages = 10) {
		this.maxDepth = maxDepth;
		this.maxPages = maxPages;
	}

	async scrapeWebsite(url: string, userId: string, depth = 0): Promise<ScrapedPage> {
		if (this.seen.has(url) || depth > this.maxDepth || this.seen.size >= this.maxPages) {
			throw new Error('Scraping limits reached or URL already seen');
		}

		logWithTimestamp('[WebpageScraper] Starting scrape:', { url, userId, depth });
		this.seen.add(url);

		try {
			const response = await fetch(url);
			if (!response.ok) throw new Error(`Failed to fetch URL: ${response.statusText}`);

			const html = await response.text();
			const $ = cheerio.load(html);

			const metadata = this.extractMetadata($);
			const sections = this.extractContentSections($);
			const summary = this.generateSummary(sections);
			const headings = this.extractHeadings($);

			const result: ScrapedPage = {
				url,
				title: $('title').text().trim(),
				description: metadata.description || '',
				headings,
				sections,
				summary,
				metadata,
				images: this.extractImages($),
				timestamp: new Date().toISOString(),
				seoAnalysis: this.analyzeSEO($, {
					title: $('title').text().trim(),
					description: metadata.description,
					headings,
					sections
				})
			};

			logWithTimestamp('[WebpageScraper] Scrape completed successfully:', { 
				url,
				sectionsFound: sections.length,
				imagesFound: result.images.length,
				seoScore: result.seoAnalysis.score
			});

			return result;
		} catch (error) {
			logWithTimestamp('[WebpageScraper] Error during scrape:', { error, url });
			throw error;
		}
	}

	private extractContentSections($: cheerio.CheerioAPI): ContentSection[] {
		const sections: ContentSection[] = [];
		let currentContext = '';

		// Process main content areas first
		const mainSelectors = ['main', 'article', '[role="main"]', '.content', '#content'];
		let $content = $('body');

		for (const selector of mainSelectors) {
			const $selected = $(selector);
			if ($selected.length) {
				$content = $selected as cheerio.Cheerio<DomElement>;
				break;
			}
		}

		// Extract sections with context
		$content.find('*').each((_, element) => {
			if (!(element as DomElement).tagName) return;
			
			const $el = $(element);
			const tagName = (element as DomElement).tagName.toLowerCase();

			// Update context with headings
			if (tagName.match(/^h[1-6]$/)) {
				currentContext = $el.text().trim();
				sections.push({
					type: 'heading',
					content: currentContext,
					importance: 10 - parseInt(tagName[1]), // h1 = 9, h2 = 8, etc.
					context: currentContext
				});
			}

			// Process different content types
			else if (tagName === 'p') {
				const text = $el.text().trim();
				if (text.length > 0) {
					sections.push({
						type: 'paragraph',
						content: text,
						importance: this.calculateImportance(text),
						context: currentContext
					});
				}
			}
			else if (tagName === 'pre' || tagName === 'code') {
				const code = $el.text().trim();
				if (code.length > 0) {
					sections.push({
						type: 'code',
						content: code,
						importance: 8, // Code samples are usually important
						context: currentContext
					});
				}
			}
			else if (tagName === 'ul' || tagName === 'ol') {
				const items = $el.find('li').map((_, li) => $(li).text().trim()).get();
				if (items.length > 0) {
					sections.push({
						type: 'list',
						content: items.join('\n'),
						importance: 7,
						context: currentContext
					});
				}
			}
			else if (tagName === 'table') {
				const tableContent = this.extractTableContent($, $el);
				if (tableContent.length > 0) {
					sections.push({
						type: 'table',
						content: tableContent,
						importance: 7,
						context: currentContext
					});
				}
			}
		});

		return sections;
	}

	private calculateImportance(text: string): number {
		let importance = 5; // Default importance

		// Increase importance based on various factors
		if (text.length > 200) importance += 1;
		if (text.includes('important') || text.includes('note') || text.includes('warning')) importance += 2;
		if (text.match(/\b(must|should|need|required)\b/i)) importance += 1;
		if (text.match(/\b(example|e\.g\.|i\.e\.)\b/i)) importance += 1;

		return Math.min(importance, 10);
	}

	private extractTableContent($: cheerio.CheerioAPI, $table: cheerio.Cheerio<DomElement>): string {
		const rows: string[] = [];
		$table.find('tr').each((_, row) => {
			const cells = $(row).find('th, td')
				.map((_, cell) => $(cell).text().trim())
				.get();
			rows.push(cells.join(' | '));
		});
		return rows.join('\n');
	}

	private generateSummary(sections: ContentSection[]): string {
		// Get the most important sections
		const importantSections = sections
			.filter(s => s.importance >= 7)
			.slice(0, 5)
			.map(s => s.content)
			.join('\n\n');

		return importantSections;
	}

	private extractMetadata($: cheerio.CheerioAPI): { [key: string]: string } {
		const metadata: { [key: string]: string } = {};
		$('meta').each((_, el) => {
			const name = $(el).attr('name') || $(el).attr('property');
			const content = $(el).attr('content');
			if (name && content) {
				metadata[name] = content;
			}
		});
		return metadata;
	}

	private extractHeadings($: cheerio.CheerioAPI): string[] {
		const headings: string[] = [];
		$('h1, h2, h3, h4, h5, h6').each((_, el) => {
			const text = $(el).text().trim();
			if (text) headings.push(text);
		});
		return headings;
	}

	private extractImages($: cheerio.CheerioAPI): { src: string; alt: string }[] {
		const images: { src: string; alt: string }[] = [];
		$('img').each((_, el) => {
			const src = $(el).attr('src');
			const alt = $(el).attr('alt') || '';
			if (src) images.push({ src, alt });
		});
		return images;
	}

	private analyzeSEO($: cheerio.CheerioAPI, page: Partial<ScrapedPage>): SEOAnalysis {
		const title = page.title || '';
		const description = page.description || '';
		const headings = page.headings || [];
		const content = page.sections?.map(s => s.content).join(' ') || '';
		
		const analysis: SEOAnalysis = {
			score: 0,
			title: this.analyzeTitleSEO(title),
			description: this.analyzeDescriptionSEO(description),
			headings: this.analyzeHeadingsSEO(headings),
			content: this.analyzeContentSEO(content),
			structuredData: this.analyzeStructuredData($),
			links: this.analyzeLinksSEO($),
			images: this.analyzeImagesSEO($),
			performance: this.analyzePerformanceSEO(content)
		};

		// Calculate overall score
		analysis.score = Math.round(
			(analysis.title.score +
			analysis.description.score +
			analysis.headings.score +
			analysis.links.score +
			analysis.images.score +
			analysis.performance.score) / 6
		);

		return analysis;
	}

	private analyzeTitleSEO(title: string) {
		const score = {
			length: title.length,
			score: 0,
			suggestions: [] as string[]
		};

		if (title.length < 30) {
			score.score = 50;
			score.suggestions.push("Title is too short (< 30 chars). Add more descriptive keywords.");
		} else if (title.length > 60) {
			score.score = 70;
			score.suggestions.push("Title might be truncated in search results (> 60 chars).");
		} else {
			score.score = 100;
		}

		return score;
	}

	private analyzeDescriptionSEO(description: string) {
		const score = {
			length: description.length,
			score: 0,
			suggestions: [] as string[]
		};

		if (description.length < 120) {
			score.score = 50;
			score.suggestions.push("Meta description is too short (< 120 chars). Add more content.");
		} else if (description.length > 155) {
			score.score = 70;
			score.suggestions.push("Meta description might be truncated (> 155 chars).");
		} else {
			score.score = 100;
		}

		return score;
	}

	private analyzeHeadingsSEO(headings: string[]) {
		const score = {
			structure: headings,
			score: 0,
			suggestions: [] as string[]
		};

		if (headings.length === 0) {
			score.score = 0;
			score.suggestions.push("No headings found. Add hierarchical headings for better structure.");
		} else if (!headings.some(h => h.length > 0)) {
			score.score = 50;
			score.suggestions.push("Add more descriptive headings with keywords.");
		} else {
			score.score = 100;
		}

		return score;
	}

	private analyzeContentSEO(content: string) {
		const words = content.split(/\s+/);
		const wordCount = words.length;
		
		// Simple keyword density calculation
		const keywordDensity: { [key: string]: number } = {};
		words.forEach(word => {
			word = word.toLowerCase();
			if (word.length > 3) {  // Ignore small words
				keywordDensity[word] = (keywordDensity[word] || 0) + 1;
			}
		});

		// Convert to percentages
		Object.keys(keywordDensity).forEach(key => {
			keywordDensity[key] = +(keywordDensity[key] / wordCount * 100).toFixed(2);
		});

		// Sort by frequency and get top keywords
		const topKeywords = Object.entries(keywordDensity)
			.sort(([,a], [,b]) => b - a)
			.slice(0, 10)
			.reduce((obj, [k, v]) => ({ ...obj, [k]: v }), {});

		return {
			wordCount,
			readabilityScore: this.calculateReadabilityScore(content),
			keywordDensity: topKeywords,
			suggestions: this.generateContentSuggestions(wordCount, content)
		};
	}

	private calculateReadabilityScore(text: string): number {
		// Simplified Flesch Reading Ease score calculation
		const words = text.split(/\s+/).length;
		const sentences = text.split(/[.!?]+/).length;
		const syllables = text.split(/[aeiou]+/i).length;

		if (words === 0 || sentences === 0) return 0;

		const wordsPerSentence = words / sentences;
		const syllablesPerWord = syllables / words;

		return Math.max(0, Math.min(100, 
			206.835 - (1.015 * wordsPerSentence) - (84.6 * syllablesPerWord)
		));
	}

	private generateContentSuggestions(wordCount: number, content: string): string[] {
		const suggestions: string[] = [];

		if (wordCount < 300) {
			suggestions.push("Content is too short. Add more comprehensive information (aim for 300+ words).");
		}
		if (content.split(/[.!?]+/).some(s => s.split(/\s+/).length > 25)) {
			suggestions.push("Some sentences are too long. Consider breaking them down for better readability.");
		}
		if (content.match(/\b(very|really|quite|basically|actually)\b/gi)) {
			suggestions.push("Consider removing filler words to make content more concise.");
		}

		return suggestions;
	}

	private analyzeLinksSEO($: cheerio.CheerioAPI) {
		const internal = $('a[href^="/"], a[href^="."], a[href^="#"]').length;
		const external = $('a[href^="http"]').length;
		
		return {
			internal,
			external,
			broken: 0, // Would require actual link checking
			score: Math.min(100, Math.max(0, (internal + external) * 10)),
			suggestions: this.generateLinkSuggestions(internal, external)
		};
	}

	private generateLinkSuggestions(internal: number, external: number): string[] {
		const suggestions: string[] = [];
		
		if (internal === 0) {
			suggestions.push("Add internal links to improve site structure and user navigation.");
		}
		if (external === 0) {
			suggestions.push("Consider adding relevant external links to authoritative sources.");
		}
		if (internal + external > 100) {
			suggestions.push("High number of links detected. Ensure they're all relevant and valuable.");
		}

		return suggestions;
	}

	private analyzeImagesSEO($: cheerio.CheerioAPI) {
		const withAlt = $('img[alt]').length;
		const total = $('img').length;
		const withoutAlt = total - withAlt;

		return {
			withAlt,
			withoutAlt,
			score: Math.round((withAlt / Math.max(total, 1)) * 100),
			suggestions: this.generateImageSuggestions(withAlt, withoutAlt)
		};
	}

	private generateImageSuggestions(withAlt: number, withoutAlt: number): string[] {
		const suggestions: string[] = [];

		if (withoutAlt > 0) {
			suggestions.push(`Add alt text to ${withoutAlt} image(s) for better accessibility and SEO.`);
		}
		if (withAlt + withoutAlt === 0) {
			suggestions.push("Consider adding relevant images to make content more engaging.");
		}

		return suggestions;
	}

	private analyzePerformanceSEO(content: string) {
		const contentLength = content.length;
		
		return {
			contentLength,
			score: Math.min(100, Math.max(0, (contentLength > 100 ? 100 : contentLength))),
			suggestions: this.generatePerformanceSuggestions(contentLength)
		};
	}

	private generatePerformanceSuggestions(contentLength: number): string[] {
		const suggestions: string[] = [];

		if (contentLength > 50000) {
			suggestions.push("Content is very long. Consider breaking it into multiple pages.");
		}
		if (contentLength < 1000) {
			suggestions.push("Content might be too thin. Add more valuable information.");
		}

		return suggestions;
	}

	private analyzeStructuredData($: cheerio.CheerioAPI) {
		const types: string[] = [];
		const recommended: { type: string; data: any }[] = [];

		$('script[type="application/ld+json"]').each((_, el) => {
			const script = $(el).html();
			if (script) {
				try {
					const data = JSON.parse(script);
					if (data['@type']) {
						types.push(data['@type']);
					}
					if (data['@recommended']) {
						recommended.push({
							type: data['@recommended'],
							data: data['@recommended']
						});
					}
				} catch (error) {
					console.error('Error parsing structured data:', error);
				}
			}
		});

		return {
			types,
			score: 0,
			suggestions: [],
			recommended
		};
	}
}
