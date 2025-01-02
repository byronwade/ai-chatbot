export class ImagePromptGenerator {
	async generate(topic: string, content: string) {
		const sections = content.split(/\n#{2,3}\s+/);
		return sections
			.map((section, index) => {
				const sectionName = section.split("\n")[0].trim();
				return [
					{
						section: sectionName,
						style: "realistic",
						prompt: `Create a realistic photo illustrating ${sectionName} from ${topic}. High quality, professional lighting, 4K resolution.`,
					},
					{
						section: sectionName,
						style: "minimalist",
						prompt: `Create a minimalist illustration of ${sectionName} from ${topic}. Clean lines, simple shapes, modern design.`,
					},
					{
						section: sectionName,
						style: "artistic",
						prompt: `Create an artistic interpretation of ${sectionName} from ${topic}. Creative, expressive, unique style.`,
					},
				];
			})
			.flat();
	}
}
