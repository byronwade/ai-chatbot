import { logWithTimestamp } from '../utils';

export type ModelId = 'llama2' | 'llama3' | 'llama3.1' | 'llama3.3' | 'llama3-gradient' | 'codellama' | 'mistral' | 'mixtral' | 'dolphin-mixtral' | 'stable-code' | 'deepseek-coder' | 'openhermes';

export const DEFAULT_MODEL_NAME = 'llama2';

export interface AIModel {
  id: ModelId;
  name: string;
  apiIdentifier: string;
  endpoint: string;
  description: string;
  supportsTools?: boolean;
}

export const models: AIModel[] = [
  {
    id: 'openhermes',
    name: 'OpenHermes',
    apiIdentifier: 'openhermes',
    endpoint: '/api/generate',
    description: 'Fine-tuned model with enhanced function calling capabilities',
    supportsTools: false
  },
  {
    id: 'mixtral',
    name: 'Mixtral 8x7B',
    apiIdentifier: 'mixtral',
    endpoint: '/api/generate',
    description: 'Most capable model with 47B parameters, excellent for complex tasks',
    supportsTools: false
  },
  {
    id: 'dolphin-mixtral',
    name: 'Dolphin Mixtral',
    apiIdentifier: 'dolphin-mixtral',
    endpoint: '/api/generate',
    description: 'Dolphin-tuned version of Mixtral 47B, optimized for chat and instruction following',
    supportsTools: false
  },
  {
    id: 'llama3.3',
    name: 'Llama 3.3',
    apiIdentifier: 'llama3.3',
    endpoint: '/api/generate',
    description: 'Latest Llama 3 model with 70.6B parameters, excellent for general tasks',
    supportsTools: false
  },
  {
    id: 'llama3-gradient',
    name: 'Llama 3 Gradient',
    apiIdentifier: 'llama3-gradient',
    endpoint: '/api/generate',
    description: 'Gradient-tuned Llama 3 8B model for improved performance',
    supportsTools: false
  },
  {
    id: 'llama3.1',
    name: 'Llama 3.1',
    apiIdentifier: 'llama3.1',
    endpoint: '/api/generate',
    description: 'Llama 3.1 with 8B parameters, balanced performance and speed',
    supportsTools: false
  },
  {
    id: 'llama3',
    name: 'Llama 3',
    apiIdentifier: 'llama3',
    endpoint: '/api/generate',
    description: 'Base Llama 3 model with 8B parameters',
    supportsTools: false
  },
  {
    id: 'llama2',
    name: 'Llama 2',
    apiIdentifier: 'llama2',
    endpoint: '/api/generate',
    description: 'Stable and efficient 7B parameter model',
    supportsTools: false
  },
  {
    id: 'mistral',
    name: 'Mistral 7B',
    apiIdentifier: 'mistral',
    endpoint: '/api/generate',
    description: 'High-performance 7B model with strong reasoning capabilities',
    supportsTools: false
  },
  {
    id: 'codellama',
    name: 'Code Llama',
    apiIdentifier: 'codellama',
    endpoint: '/api/generate',
    description: 'Specialized 7B model for code generation and understanding',
    supportsTools: false
  },
  {
    id: 'stable-code',
    name: 'StableCode 3B',
    apiIdentifier: 'stable-code',
    endpoint: '/api/generate',
    description: 'Lightweight 3B model optimized for code generation',
    supportsTools: false
  },
  {
    id: 'deepseek-coder',
    name: 'DeepSeek Coder',
    apiIdentifier: 'deepseek-coder',
    endpoint: '/api/generate',
    description: 'Efficient 1.3B model specialized for coding tasks',
    supportsTools: false
  }
];

export function getModel(modelId: ModelId) {
  logWithTimestamp('[AI Info] Creating custom model:', { modelId });
  const model = models.find(m => m.id === modelId);
  if (!model) {
    throw new Error(`Model ${modelId} not found`);
  }
  logWithTimestamp('[AI Info] Using model:', { 
    id: model.id, 
    name: model.name, 
    apiIdentifier: model.apiIdentifier 
  });
  return model;
}
