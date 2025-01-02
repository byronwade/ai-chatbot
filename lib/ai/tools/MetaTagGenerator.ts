export class MetaTagGenerator {
	async generate(topic: string, content: string) {
		const description = content.slice(0, 160).trim() + "...";
		const keywords = content
			.toLowerCase()
			.split(/\W+/)
			.filter((word) => word.length > 3)
			.slice(0, 10)
			.join(", ");

		return {
			general: {
				title: `${topic} | Blog Factory`,
				description,
				keywords,
				author: "Blog Factory AI",
				robots: "index, follow",
				viewport: "width=device-width, initial-scale=1",
				"content-type": "text/html; charset=utf-8",
				"content-language": "en",
			},
			facebook: {
				"og:title": topic,
				"og:description": description,
				"og:type": "article",
				"og:url": `https://blogfactory.com/blog/${encodeURIComponent(topic.toLowerCase().replace(/\s+/g, "-"))}`,
				"og:site_name": "Blog Factory",
				"og:image": "https://blogfactory.com/og-image.jpg",
				"article:published_time": new Date().toISOString(),
				"article:author": "https://facebook.com/blogfactory",
			},
			twitter: {
				"twitter:card": "summary_large_image",
				"twitter:site": "@blogfactory",
				"twitter:creator": "@blogfactory",
				"twitter:title": topic,
				"twitter:description": description,
				"twitter:image": "https://blogfactory.com/twitter-card.jpg",
			},
		};
	}
}
