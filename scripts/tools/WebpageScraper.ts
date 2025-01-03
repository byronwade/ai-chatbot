import { JSDOM } from "jsdom";
import axios from "axios";

interface WebsiteContent {
	url: string;
	title: string;
	description: string;
	sourceCode: string;
	analysis: {
		content: {
			headings: HeadingElement[];
			text: TextElement[];
			links: LinkElement[];
			images: ImageElement[];
			scripts: ScriptElement[];
			styles: StyleElement[];
			resources: ResourceElement[];
		};
		techStack: {
			frameworks: TechFramework[];
			styling: StyleFramework[];
			libraries: Library[];
			buildTools: string[];
			meta: MetaInfo[];
		};
	};
}

interface HeadingElement {
	text: string;
	level: number;
	path: string;
}

interface TextElement {
	content: string;
	context: string;
	path: string;
	importance: number;
}

interface LinkElement {
	text: string;
	href: string;
	type: string;
	context: string;
}

interface ImageElement {
	src: string;
	alt: string;
	dimensions?: {
		width: number;
		height: number;
	};
	type: string;
}

interface ScriptElement {
	src?: string;
	type?: string;
	content?: string;
	purpose: string;
}

interface StyleElement {
	href?: string;
	content?: string;
	framework?: string;
}

interface ResourceElement {
	url: string;
	type: string;
	purpose: string;
}

interface TechFramework {
	type: string;
	name: string;
	version?: string;
	confidence: number;
	evidence: string[];
}

interface StyleFramework {
	type: string;
	name: string;
	version?: string;
	purpose: string;
	evidence: string[];
}

interface Library {
	name: string;
	version?: string;
	purpose: string;
}

interface MetaInfo {
	name: string;
	content: string;
	purpose: string;
}

interface SearchResult {
	type: string;
	content: any;
	confidence: number;
	explanation: string;
}

class WebpageScraper {
	private websites: Map<string, WebsiteContent> = new Map();

	async scrapeWebsite(url: string): Promise<WebsiteContent> {
		try {
			console.log(`🌐 Accessing: ${url}`);
			const response = await fetch(url);
			const html = await response.text();
			console.log(`✅ Retrieved content`);

			const dom = new JSDOM(html);
			const document = dom.window.document;
			console.log(`🔍 Processing DOM structure...`);

			const content = {
				headings: this.extractHeadings(document),
				text: this.extractText(document),
				links: this.extractLinks(document),
				images: this.extractImages(document),
				scripts: this.extractScripts(document),
				styles: this.extractStyles(document),
				resources: this.extractResources(document),
			};

			const techStack = this.analyzeTechStack(document, html);

			const websiteContent: WebsiteContent = {
				url,
				title: document.title,
				description: document.querySelector('meta[name="description"]')?.getAttribute("content") || "",
				sourceCode: html,
				analysis: {
					content,
					techStack,
				},
			};

			this.websites.set(url, websiteContent);
			return websiteContent;
		} catch (error) {
			console.error("❌ Access error:", error);
			throw error;
		}
	}

	search(query: string): SearchResult[] {
		console.log(`\n🔍 Searching: "${query}"`);
		const results: SearchResult[] = [];

		for (const website of this.websites.values()) {
			// Tech stack specific queries
			if (query.toLowerCase().includes("tech stack") || query.toLowerCase().includes("framework") || query.toLowerCase().includes("tailwind")) {
				const techResults = this.handleTechStackQuery(query, website);
				results.push(...techResults);
			}

			// Content queries
			const contentResults = this.handleContentQuery(query, website);
			results.push(...contentResults);
		}

		return results.sort((a, b) => b.confidence - a.confidence);
	}

	private handleTechStackQuery(query: string, website: WebsiteContent): SearchResult[] {
		const results: SearchResult[] = [];
		const techStack = website.analysis.techStack;

		// Check for specific tech
		const techTerms = query.toLowerCase().split(" ");

		// Check frameworks
		techStack.frameworks.forEach((framework) => {
			if (techTerms.some((term) => framework.name.toLowerCase().includes(term))) {
				results.push({
					type: "framework",
					content: framework,
					confidence: framework.confidence,
					explanation: `Found framework "${framework.name}" with evidence: ${framework.evidence.join(", ")}`,
				});
			}
		});

		// Check styling frameworks
		techStack.styling.forEach((style) => {
			if (techTerms.some((term) => style.name.toLowerCase().includes(term))) {
				results.push({
					type: "styling",
					content: style,
					confidence: 0.9,
					explanation: `Found styling framework "${style.name}" used for ${style.purpose}`,
				});
			}
		});

		// Check libraries
		techStack.libraries.forEach((library) => {
			if (techTerms.some((term) => library.name.toLowerCase().includes(term))) {
				results.push({
					type: "library",
					content: library,
					confidence: 0.8,
					explanation: `Found library "${library.name}" used for ${library.purpose}`,
				});
			}
		});

		// If no specific matches but asking about tech stack, return everything
		if (results.length === 0 && query.toLowerCase().includes("tech stack")) {
			results.push({
				type: "tech-stack",
				content: techStack,
				confidence: 1,
				explanation: "Complete technology stack analysis",
			});
		}

		return results;
	}

	private handleContentQuery(query: string, website: WebsiteContent): SearchResult[] {
		const results: SearchResult[] = [];
		const content = website.analysis.content;

		// Search through headings
		content.headings.forEach((heading) => {
			if (heading.text.toLowerCase().includes(query.toLowerCase())) {
				results.push({
					type: "heading",
					content: heading,
					confidence: 1,
					explanation: `Found matching heading: ${heading.text}`,
				});
			}
		});

		// Search through text content
		content.text.forEach((text) => {
			if (text.content.toLowerCase().includes(query.toLowerCase())) {
				results.push({
					type: "text",
					content: text,
					confidence: 0.8,
					explanation: `Found matching text content in ${text.context}`,
				});
			}
		});

		// Search through links
		content.links.forEach((link) => {
			if (link.text.toLowerCase().includes(query.toLowerCase())) {
				results.push({
					type: "link",
					content: link,
					confidence: 0.9,
					explanation: `Found matching link: ${link.text}`,
				});
			}
		});

		return results;
	}

	getWebsite(url: string): WebsiteContent | undefined {
		return this.websites.get(url);
	}

	clearCache(url: string) {
		this.websites.delete(url);
	}

	private extractHeadings(document: Document): HeadingElement[] {
		return Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((heading) => ({
			text: heading.textContent?.trim() || "",
			level: parseInt(heading.tagName[1]),
			path: this.getElementPath(heading),
		}));
	}

	private getElementPath(element: Element): string {
		const path: string[] = [];
		let current = element;

		while (current && current !== document.documentElement) {
			let selector = current.tagName.toLowerCase();
			if (current.id) {
				selector += `#${current.id}`;
			} else if (current.classList.length > 0) {
				selector += `.${Array.from(current.classList).join(".")}`;
			}
			path.unshift(selector);
			current = current.parentElement as Element;
		}

		return path.join(" > ");
	}

	private extractLinks(document: Document): LinkElement[] {
		return Array.from(document.querySelectorAll("a")).map((link) => ({
			text: link.textContent?.trim() || "",
			href: link.getAttribute("href") || "",
			type: this.determineLinkType(link),
			context: this.getLinkContext(link),
		}));
	}

	private determineLinkType(link: Element): string {
		if (link.closest("nav")) return "navigation";
		if (link.closest("footer")) return "footer";
		if (link.closest("header")) return "header";
		return "content";
	}

	private getLinkContext(element: Element): string {
		const section = element.closest('section, article, div[class*="section"]');
		return section?.getAttribute("class") || "main";
	}

	private extractImages(document: Document): ImageElement[] {
		return Array.from(document.querySelectorAll("img")).map((img) => ({
			src: img.getAttribute("src") || "",
			alt: img.getAttribute("alt") || "",
			dimensions: img.width && img.height ? { width: img.width, height: img.height } : undefined,
			type: this.determineImageType(img),
		}));
	}

	private determineImageType(img: HTMLImageElement): string {
		if (img.closest("header")) return "header";
		if (img.closest("footer")) return "footer";
		if (img.width > 800 || img.height > 600) return "hero";
		if (img.width < 100 || img.height < 100) return "icon";
		return "content";
	}

	private extractText(document: Document): TextElement[] {
		const textElements: TextElement[] = [];
		const textNodes = document.evaluate('//text()[normalize-space(.)!=""]', document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

		for (let i = 0; i < textNodes.snapshotLength; i++) {
			const node = textNodes.snapshotItem(i);
			if (node && node.parentElement) {
				const element = node.parentElement;
				if (!["script", "style"].includes(element.tagName.toLowerCase())) {
					textElements.push({
						content: node.textContent?.trim() || "",
						context: this.getTextContext(element),
						path: this.getElementPath(element),
						importance: this.calculateTextImportance(element),
					});
				}
			}
		}

		return textElements;
	}

	private getTextContext(element: Element): string {
		const section = element.closest('section, article, main, div[class*="section"]');
		return section?.getAttribute("class") || "main";
	}

	private calculateTextImportance(element: Element): number {
		let importance = 0.5;

		if (element.tagName.match(/^H[1-6]$/)) {
			importance += 0.5 - (parseInt(element.tagName[1]) - 1) * 0.1;
		}
		if (element.tagName === "P") importance += 0.2;
		if (element.closest("main")) importance += 0.1;
		if (element.getAttribute("role")) importance += 0.1;

		return Math.min(importance, 1);
	}

	private extractScripts(document: Document): ScriptElement[] {
		return Array.from(document.querySelectorAll("script")).map((script) => ({
			src: script.getAttribute("src") || undefined,
			type: script.getAttribute("type") || undefined,
			content: script.textContent || undefined,
			purpose: script.getAttribute("data-purpose") || "unknown",
		}));
	}

	private extractStyles(document: Document): StyleElement[] {
		const styles: StyleElement[] = [];

		document.querySelectorAll("style").forEach((style) => {
			styles.push({
				content: style.textContent || undefined,
				framework: style.getAttribute("data-framework") || undefined,
			});
		});

		document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
			styles.push({
				href: link.getAttribute("href") || undefined,
				framework: link.getAttribute("data-framework") || undefined,
			});
		});

		return styles;
	}

	private extractResources(document: Document): ResourceElement[] {
		const resources: ResourceElement[] = [];

		document.querySelectorAll("img").forEach((img) => {
			resources.push({
				url: img.getAttribute("src") || "",
				type: "image",
				purpose: img.getAttribute("data-purpose") || "content",
			});
		});

		document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
			resources.push({
				url: link.getAttribute("href") || "",
				type: "stylesheet",
				purpose: link.getAttribute("data-purpose") || "styling",
			});
		});

		document.querySelectorAll("script[src]").forEach((script) => {
			resources.push({
				url: script.getAttribute("src") || "",
				type: "script",
				purpose: script.getAttribute("data-purpose") || "functionality",
			});
		});

		return resources;
	}

	private analyzeTechStack(
		document: Document,
		html: string
	): {
		frameworks: TechFramework[];
		styling: StyleFramework[];
		libraries: Library[];
		buildTools: string[];
		meta: MetaInfo[];
	} {
		const frameworks: TechFramework[] = [];
		const styling: StyleFramework[] = [];
		const libraries: Library[] = [];
		const buildTools: string[] = [];
		const meta: MetaInfo[] = [];

		// Analyze meta tags
		document.querySelectorAll("meta").forEach((metaTag) => {
			const name = metaTag.getAttribute("name");
			const content = metaTag.getAttribute("content");
			if (name && content) {
				meta.push({
					name,
					content,
					purpose: this.determineMetaPurpose(name),
				});
			}
		});

		// Analyze scripts
		document.querySelectorAll("script").forEach((script) => {
			const src = script.getAttribute("src");
			if (src) {
				this.detectFramework(src, frameworks);
				this.detectLibrary(src, libraries);
			}
		});

		// Analyze styles
		document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
			const href = link.getAttribute("href");
			if (href) {
				this.detectStyleFramework(href, styling);
			}
		});

		return {
			frameworks,
			styling,
			libraries,
			buildTools,
			meta,
		};
	}

	private determineMetaPurpose(name: string): string {
		if (name.includes("description")) return "SEO";
		if (name.includes("keywords")) return "SEO";
		if (name.includes("viewport")) return "Responsive";
		if (name.includes("robots")) return "Crawling";
		if (name.includes("author")) return "Attribution";
		return "Other";
	}

	private detectFramework(src: string, frameworks: TechFramework[]): void {
		const frameworkPatterns = {
			React: /react(-dom)?\.(?:production|development)\.min\.js$/,
			"Vue.js": /vue(@[0-9]+)?\.(?:runtime|common)\.js$/,
			Angular: /angular(?:\.min)?\.js$/,
			"Next.js": /_next\/static/,
		};

		for (const [name, pattern] of Object.entries(frameworkPatterns)) {
			if (pattern.test(src)) {
				frameworks.push({
					type: "frontend",
					name,
					confidence: 0.9,
					evidence: [src],
				});
			}
		}
	}

	private detectStyleFramework(href: string, styling: StyleFramework[]): void {
		const stylePatterns = {
			"Tailwind CSS": /tailwind/,
			Bootstrap: /bootstrap/,
			"Material UI": /material/,
			Foundation: /foundation/,
		};

		for (const [name, pattern] of Object.entries(stylePatterns)) {
			if (pattern.test(href)) {
				styling.push({
					type: "css",
					name,
					purpose: "styling",
					evidence: [href],
				});
			}
		}
	}

	private detectLibrary(src: string, libraries: Library[]): void {
		const libraryPatterns = {
			jQuery: /jquery/,
			Lodash: /lodash/,
			"Moment.js": /moment/,
			Axios: /axios/,
		};

		for (const [name, pattern] of Object.entries(libraryPatterns)) {
			if (pattern.test(src)) {
				libraries.push({
					name,
					purpose: "utility",
				});
			}
		}
	}
}
