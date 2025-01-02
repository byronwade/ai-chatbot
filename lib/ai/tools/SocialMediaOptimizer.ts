export class SocialMediaOptimizer {
	async optimize(topic: string, content: string) {
		const summary = content.slice(0, 280);
		const hashtags = topic
			.toLowerCase()
			.split(/\s+/)
			.map((word) => `#${word.replace(/[^\w]/g, "")}`)
			.join(" ");

		return {
			twitter: {
				text: `${summary.slice(0, 240)}... ${hashtags}`,
				mediaType: "image",
				schedule: "best",
			},
			facebook: {
				text: `${content.slice(0, 500)}...`,
				mediaType: "video",
				schedule: "peak",
			},
			linkedin: {
				text: `${content.slice(0, 1000)}...`,
				mediaType: "article",
				schedule: "business",
			},
			instagram: {
				text: `${summary.slice(0, 200)}... ${hashtags}`,
				mediaType: "carousel",
				schedule: "evening",
			},
		};
	}
}
