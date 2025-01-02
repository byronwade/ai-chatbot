export class StructuredDataGenerator {
	async generate(topic: string, content: string) {
		const baseStructuredData = {
			"@context": "https://schema.org",
			author: {
				"@type": "Person",
				name: "Blog Factory AI",
			},
			publisher: {
				"@type": "Organization",
				name: "Blog Factory",
				logo: {
					"@type": "ImageObject",
					url: "https://blogfactory.com/logo.png",
				},
			},
			datePublished: new Date().toISOString(),
			dateModified: new Date().toISOString(),
			headline: topic,
			mainEntityOfPage: {
				"@type": "WebPage",
				"@id": "https://blogfactory.com/blog/" + encodeURIComponent(topic.toLowerCase().replace(/\s+/g, "-")),
			},
		};

		return {
			Article: {
				...baseStructuredData,
				"@type": "Article",
			},
			BlogPosting: {
				...baseStructuredData,
				"@type": "BlogPosting",
				wordCount: content.split(/\s+/).length,
				articleBody: content,
			},
			NewsArticle: {
				...baseStructuredData,
				"@type": "NewsArticle",
				dateline: new Date().toLocaleDateString(),
				printEdition: "Online",
			},
		};
	}
}
