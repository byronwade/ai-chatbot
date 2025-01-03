import { logWithTimestamp } from '../utils';

export type ModelId =
	// Ollama Models
	| "llama3.3"
	| "llama3.1"
	| "mistral"
	| "mixtral"
	// OpenAI Models
	| "gpt-4-turbo"
	| "gpt-4"
	| "gpt-3.5-turbo"
	| "gpt-4-vision"
	// Google Models
	| "gemini-1.5-flash"
	| "gemini-1.5-pro";

export const DEFAULT_MODEL_NAME = "gemini-1.5-flash";

export interface AIModel {
	id: ModelId;
	name: string;
	apiIdentifier: string;
	endpoint: string;
	description: string;
	provider: "ollama" | "openai" | "google";
	supportsTools?: boolean;
	supportsVision?: boolean;
	maxTokens?: number;
}

export const models: AIModel[] = [
	// OpenAI Models
	{
		id: "gpt-4-turbo",
		name: "GPT-4 Turbo",
		apiIdentifier: "gpt-4-turbo-preview",
		endpoint: "https://api.openai.com/v1/chat/completions",
		description: "Most capable GPT-4 model, optimized for speed and cost",
		provider: "openai",
		supportsTools: true,
		maxTokens: 128000,
	},
	{
		id: "gpt-4",
		name: "GPT-4",
		apiIdentifier: "gpt-4",
		endpoint: "https://api.openai.com/v1/chat/completions",
		description: "Most capable GPT-4 model for complex tasks",
		provider: "openai",
		supportsTools: true,
		maxTokens: 8192,
	},
	{
		id: "gpt-3.5-turbo",
		name: "GPT-3.5 Turbo",
		apiIdentifier: "gpt-3.5-turbo",
		endpoint: "https://api.openai.com/v1/chat/completions",
		description: "Fast and efficient model for most tasks",
		provider: "openai",
		supportsTools: true,
		maxTokens: 4096,
	},
	{
		id: "gpt-4-vision",
		name: "GPT-4 Vision",
		apiIdentifier: "gpt-4-vision-preview",
		endpoint: "https://api.openai.com/v1/chat/completions",
		description: "GPT-4 model with vision capabilities",
		provider: "openai",
		supportsTools: true,
		supportsVision: true,
		maxTokens: 128000,
	},
	// Google Models
	{
		id: "gemini-1.5-flash",
		name: "Gemini 1.5 Flash",
		apiIdentifier: "gemini-1.5-flash-latest",
		endpoint: "https://generativelanguage.googleapis.com/v1beta",
		description: "Fast and efficient model optimized for quick responses and tool use",
		provider: "google",
		supportsTools: true,
		maxTokens: 32768,
	},
	{
		id: "gemini-1.5-pro",
		name: "Gemini 1.5 Pro",
		apiIdentifier: "gemini-1.5-pro-latest",
		endpoint: "https://generativelanguage.googleapis.com/v1beta",
		description: "Most capable Gemini model for complex tasks and reasoning",
		provider: "google",
		supportsTools: true,
		maxTokens: 32768,
	},
	// Ollama Models with Tool Support
	{
		id: "llama3.3",
		name: "Llama 3.3",
		apiIdentifier: "llama3.3",
		endpoint: "/api/generate",
		description: "Latest Llama 3 model with 70.6B parameters, excellent for general tasks and tool use",
		provider: "ollama",
		supportsTools: true,
		maxTokens: 8192,
	},
	{
		id: "llama3.1",
		name: "Llama 3.1",
		apiIdentifier: "llama3.1",
		endpoint: "/api/generate",
		description: "Llama 3.1 with 8B parameters, balanced performance and tool usage",
		provider: "ollama",
		supportsTools: true,
		maxTokens: 8192,
	},
	{
		id: "mistral",
		name: "Mistral 7B",
		apiIdentifier: "mistral",
		endpoint: "/api/generate",
		description: "High-performance 7B model with strong reasoning and tool capabilities",
		provider: "ollama",
		supportsTools: true,
		maxTokens: 8192,
	},
	{
		id: "mixtral",
		name: "Mixtral 8x7B",
		apiIdentifier: "mixtral",
		endpoint: "/api/generate",
		description: "Most capable model with 47B parameters, excellent for complex tasks and tool use",
		provider: "ollama",
		supportsTools: true,
		maxTokens: 32768,
	},
];

export function getModel(modelId: ModelId) {
	logWithTimestamp("[AI Info] Creating custom model:", { modelId });
	const model = models.find((m) => m.id === modelId);
	if (!model) {
		throw new Error(`Model ${modelId} not found`);
	}
	logWithTimestamp("[AI Info] Using model:", {
		id: model.id,
		name: model.name,
		provider: model.provider,
		apiIdentifier: model.apiIdentifier,
	});
	return model;
}
