import { ollama } from './ollama';
import { getModel, type ModelId } from './models';
import { logWithTimestamp } from '../utils';

export function customModel(modelId: ModelId) {
  const model = getModel(modelId);
  logWithTimestamp('[AI Info] Creating custom model:', { modelId });
  logWithTimestamp('[AI Info] Using model:', { 
    id: model.id,
    name: model.name,
    apiIdentifier: model.apiIdentifier
  });
  
  return ollama(model.apiIdentifier);
}

export * from './models';
