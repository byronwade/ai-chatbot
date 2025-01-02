import { logWithTimestamp } from '@/lib/utils';

export class WebpageScraper {
	async scrapeWebsite(url: string, userId: string) {
		logWithTimestamp('[WebpageScraper] Starting scrape:', { url, userId });
		
		try {
			logWithTimestamp('[WebpageScraper] Fetching URL:', { url });
			const response = await fetch(url);
			
			if (!response.ok) {
				logWithTimestamp('[WebpageScraper] Fetch failed:', { 
					status: response.status, 
					statusText: response.statusText 
				});
				throw new Error(`Failed to fetch URL: ${response.statusText}`);
			}
			
			logWithTimestamp('[WebpageScraper] URL fetched successfully, extracting HTML');
			const html = await response.text();
			
			// Extract metadata
			logWithTimestamp('[WebpageScraper] Extracting title');
			const title = this.extractTitle(html);
			logWithTimestamp('[WebpageScraper] Title extracted:', { title });
			
			logWithTimestamp('[WebpageScraper] Extracting meta description');
			const description = this.extractMetaDescription(html);
			logWithTimestamp('[WebpageScraper] Description extracted:', { description });
			
			logWithTimestamp('[WebpageScraper] Extracting headings');
			const headings = this.extractHeadings(html);
			logWithTimestamp('[WebpageScraper] Headings extracted:', { 
				count: headings.length,
				headings 
			});
			
			logWithTimestamp('[WebpageScraper] Extracting main content');
			const mainContent = this.extractMainContent(html);
			logWithTimestamp('[WebpageScraper] Main content extracted:', { 
				contentLength: mainContent.length 
			});
			
			const result = {
				url,
				title,
				description,
				headings,
				mainContent,
				timestamp: new Date().toISOString()
			};
			
			logWithTimestamp('[WebpageScraper] Scrape completed successfully:', { result });
			return result;
		} catch (error) {
			logWithTimestamp('[WebpageScraper] Error during scrape:', { error, url });
			throw error;
		}
	}

	private extractTitle(html: string): string {
		logWithTimestamp('[WebpageScraper] Extracting title using regex');
		const titleMatch = html.match(/<title>(.*?)<\/title>/i);
		const title = titleMatch ? titleMatch[1].trim() : '';
		logWithTimestamp('[WebpageScraper] Title extraction result:', { title });
		return title;
	}

	private extractMetaDescription(html: string): string {
		logWithTimestamp('[WebpageScraper] Extracting meta description using regex');
		const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i);
		const description = descMatch ? descMatch[1].trim() : '';
		logWithTimestamp('[WebpageScraper] Meta description extraction result:', { description });
		return description;
	}

	private extractHeadings(html: string): string[] {
		logWithTimestamp('[WebpageScraper] Extracting headings using regex');
		const headingMatches = html.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi) || [];
		const headings = headingMatches.map(heading => {
			// Remove HTML tags and trim
			return heading.replace(/<[^>]*>/g, '').trim();
		});
		logWithTimestamp('[WebpageScraper] Headings extraction result:', { 
			count: headings.length,
			headings 
		});
		return headings;
	}

	private extractMainContent(html: string): string {
		logWithTimestamp('[WebpageScraper] Starting main content extraction');
		// First try to find main content in semantic elements
		let content = '';
		const mainMatch = html.match(/<main[^>]*>(.*?)<\/main>/is);
		if (mainMatch) {
			logWithTimestamp('[WebpageScraper] Found content in <main> tag');
			content = mainMatch[1];
		} else {
			// Fallback to article or first large text block
			const articleMatch = html.match(/<article[^>]*>(.*?)<\/article>/is);
			if (articleMatch) {
				logWithTimestamp('[WebpageScraper] Found content in <article> tag');
				content = articleMatch[1];
			} else {
				logWithTimestamp('[WebpageScraper] Falling back to <body> content');
				// Get the largest text block
				const bodyContent = html.match(/<body[^>]*>(.*?)<\/body>/is);
				content = bodyContent ? bodyContent[1] : '';
			}
		}
		
		logWithTimestamp('[WebpageScraper] Cleaning content');
		// Clean up the content
		content = content
			.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
			.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove styles
			.replace(/<[^>]+>/g, ' ') // Remove remaining HTML tags
			.replace(/\s+/g, ' ') // Normalize whitespace
			.trim();
		
		logWithTimestamp('[WebpageScraper] Content extraction complete:', { 
			contentLength: content.length 
		});
		return content;
	}
}
