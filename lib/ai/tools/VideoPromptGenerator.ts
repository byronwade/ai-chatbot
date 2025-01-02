export class VideoPromptGenerator {
	async generate(topic: string, content: string) {
		const sections = content.split(/\n#{2,3}\s+/);
		return sections
			.map((section, index) => {
				const sectionName = section.split("\n")[0].trim();
				return [
					{
						section: sectionName,
						duration: 30,
						prompt: `Create a 30-second video explaining ${sectionName} from ${topic}. Include motion graphics, text overlays, and professional voiceover.`,
					},
					{
						section: sectionName,
						duration: 60,
						prompt: `Create a 1-minute detailed video about ${sectionName} from ${topic}. Include real footage, interviews, and expert insights.`,
					},
					{
						section: sectionName,
						duration: 15,
						prompt: `Create a 15-second social media teaser about ${sectionName} from ${topic}. Fast-paced, engaging, with captions.`,
					},
				];
			})
			.flat();
	}
}
