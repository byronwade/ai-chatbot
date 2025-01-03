"use strict";

import { JSDOM } from "jsdom";
import axios from "axios";

export class WebpageScraper {
	private websites: Map<string, Website> = new Map();

	async scrapeWebsite(url: string): Promise<Website> {
		try {
			console.log(`🌐 Fetching ${url}`);
			const response = await axios.get(url);
			console.log(`✅ Received response from ${url}`);

			const dom = new JSDOM(response.data);
			const document = dom.window.document;

			const title = document.querySelector("title")?.textContent || "";
			const description = document.querySelector('meta[name="description"]')?.getAttribute("content") || "";

			console.log(`📝 Extracted metadata from ${url}`);

			// Extract content
			const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((h) => ({
				level: parseInt(h.tagName[1]),
				text: h.textContent || "",
				path: this.getXPath(h),
			}));

			const links = Array.from(document.querySelectorAll("a")).map((a) => ({
				text: a.textContent || "",
				href: a.href,
				context: this.getContext(a),
			}));

			const textNodes = Array.from(document.querySelectorAll("p, div, span, article")).map((node) => ({
				content: node.textContent || "",
				context: this.getContext(node),
				importance: this.calculateImportance(node),
			}));

			console.log(`📊 Analyzed content structure of ${url}`);

			return {
				url,
				title,
				description,
				sourceCode: response.data,
				analysis: {
					content: {
						headings,
						text: textNodes,
						links,
					},
					techStack: this.analyzeTechStack(document, response.headers),
				},
			};
		} catch (error) {
			console.error(`❌ Error scraping ${url}:`, error);
			throw error;
		}
	}

	private getXPath(element: Element): string {
		const parts: string[] = [];
		let current: Element | null = element;

		while (current && current.nodeType === 1) {
			let part = current.tagName.toLowerCase();

			if (current.id) {
				part += `[@id="${current.id}"]`;
				parts.unshift(part);
				break;
			} else {
				const siblings = Array.from(current.parentElement?.children || []).filter((el) => el.tagName === current.tagName);

				if (siblings.length > 1) {
					const index = siblings.indexOf(current) + 1;
					part += `[${index}]`;
				}

				parts.unshift(part);
				current = current.parentElement;
			}
		}

		return `/${parts.join("/")}`;
	}

	private getContext(element: Element): string {
		const parent = element.parentElement;
		if (!parent) return "";

		const siblings = Array.from(parent.childNodes)
			.filter((node) => node.nodeType === 3 || (node.nodeType === 1 && node !== element))
			.map((node) => node.textContent?.trim())
			.filter((text) => text)
			.join(" ");

		return siblings.substring(0, 100);
	}

	private calculateImportance(element: Element): number {
		let importance = 1;

		// Boost importance based on various factors
		if (element.tagName === "ARTICLE") importance += 2;
		if (element.closest("main")) importance += 1;
		if (element.closest("header")) importance += 1;
		if (element.closest("footer")) importance -= 1;
		if (element.closest("aside")) importance -= 1;

		// Consider text length
		const textLength = element.textContent?.length || 0;
		importance += Math.min(textLength / 500, 2); // Cap at +2 for length

		return Math.max(0, Math.min(5, importance)); // Clamp between 0-5
	}

	private analyzeTechStack(document: Document, headers: any): TechStack {
		const meta = Array.from(document.querySelectorAll("meta")).map((m) => ({
			name: m.getAttribute("name") || "",
			content: m.getAttribute("content") || "",
		}));

		const frameworks = [];
		const styling = [];
		const libraries = [];
		const buildTools = [];

		// Detect Next.js
		if (document.querySelector("#__next")) {
			frameworks.push({ name: "Next.js", confidence: 0.9 });
		}

		// Detect React
		if (document.querySelector("[data-reactroot]")) {
			frameworks.push({ name: "React", confidence: 0.9 });
		}

		// Detect Tailwind
		if (document.querySelector('[class*="text-"]') && document.querySelector('[class*="bg-"]')) {
			styling.push({ name: "Tailwind CSS", confidence: 0.8 });
		}

		return {
			frameworks,
			styling,
			libraries,
			buildTools,
			meta,
		};
	}

	getAllWebsites(): Map<string, Website> {
		return this.websites;
	}
}

export interface Website {
	url: string;
	title: string;
	description: string;
	sourceCode: string;
	analysis: {
		content: {
			headings: Array<{
				level: number;
				text: string;
				path: string;
			}>;
			text: Array<{
				content: string;
				context: string;
				importance: number;
			}>;
			links: Array<{
				text: string;
				href: string;
				context: string;
			}>;
		};
		techStack: TechStack;
	};
}

export interface TechStack {
	frameworks: Array<{
		name: string;
		confidence: number;
	}>;
	styling: Array<{
		name: string;
		confidence: number;
	}>;
	libraries: Array<{
		name: string;
		confidence: number;
	}>;
	buildTools: string[];
	meta: Array<{
		name: string;
		content: string;
	}>;
}

export interface MetaInfo {
	name: string;
	content: string;
}
