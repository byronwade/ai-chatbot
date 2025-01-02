import { SEOAgent } from "./agent";
import { type AIModel } from "./models";
import { getModel, type ModelId } from "./models";
import { logWithTimestamp } from "../utils";
import { ollama } from "ollama-ai-provider";

export function customModel(modelId: ModelId) {
	const model = getModel(modelId);
	logWithTimestamp("[Model] Creating custom model:", { modelId });

	if (model.provider === "openai") {
		// Handle OpenAI case
		return model;
	} else {
		// Use direct Ollama provider
		return {
			...model,
			provider: ollama(model.apiIdentifier),
		};
	}
}

export { SEOAgent };
export type { AIModel };
