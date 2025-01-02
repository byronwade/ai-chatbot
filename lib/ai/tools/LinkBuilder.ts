export class LinkBuilder {
	async suggest(topic: string, websiteUrl: string) {
		return {
			internal: [
				{
					url: `${websiteUrl}/blog/related-post-1`,
					title: "Related Post 1",
					relevance: 0.9,
				},
				{
					url: `${websiteUrl}/blog/related-post-2`,
					title: "Related Post 2",
					relevance: 0.8,
				},
			],
			external: [
				{
					url: "https://example.com/reference-1",
					title: "Expert Reference 1",
					authority: 0.9,
				},
				{
					url: "https://example.com/reference-2",
					title: "Expert Reference 2",
					authority: 0.85,
				},
			],
			both: [
				{
					url: `${websiteUrl}/blog/related-post-1`,
					title: "Related Post 1",
					type: "internal",
					score: 0.9,
				},
				{
					url: "https://example.com/reference-1",
					title: "Expert Reference 1",
					type: "external",
					score: 0.9,
				},
			],
		};
	}
}
