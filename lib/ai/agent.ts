import { type CoreMessage, streamText, type LanguageModelV1, type LanguageModelV1CallOptions, type LanguageModelV1StreamPart } from 'ai';
import { getModel, type ModelId, type AIModel } from './models';
import { logWithTimestamp } from '../utils';
import { tools } from './tools';

export interface SEOAgentOptions {
  modelId: string;
  chatId: string;
  userId: string;
}

export class SEOAgent {
  private model: AIModel;
  private chatId: string;
  private userId: string;

  constructor(options: SEOAgentOptions) {
    if (!options.chatId || !options.userId) {
      throw new Error('Chat ID and User ID are required');
    }

    this.chatId = options.chatId;
    this.userId = options.userId;
    this.model = getModel(options.modelId as ModelId);

    logWithTimestamp('[SEOAgent] Initializing agent', {
      chatId: this.chatId,
      modelId: options.modelId,
      userId: this.userId
    });
  }

  async chat(messages: CoreMessage[]) {
    logWithTimestamp('[SEOAgent] Starting chat', {
      messageCount: messages.length,
      modelId: this.model.id,
      chatId: this.chatId
    });

    // Add system message to help model understand tool usage
    const systemMessage: CoreMessage = {
      role: 'system',
      content: `You are an AI assistant specialized in website analysis and SEO optimization. When analyzing websites, ALWAYS use the provided tools to gather data. NEVER make assumptions or analyze without using tools first.

For example, when asked to analyze a website:
1. Use the 'analyze' tool to get SEO data
2. Wait for the tool results
3. Provide insights based on the actual data

DO NOT proceed without using tools. If you need to analyze a website, ALWAYS use the tools first.

Available tools:
${Object.entries(tools).map(([name, tool]) => `- ${name}: Use this tool to analyze websites`).join('\n')}`
    };

    // Extract URL from the last message
    const lastMessage = messages[messages.length - 1];
    const url = typeof lastMessage.content === 'string' 
      ? lastMessage.content.match(/https?:\/\/[^\s]+/)?.[0] || ''
      : '';

    const ollamaModel: LanguageModelV1 = {
      specificationVersion: 'v1',
      provider: 'ollama',
      modelId: this.model.apiIdentifier,
      defaultObjectGenerationMode: 'json',
      doGenerate: async () => {
        throw new Error('Not implemented');
      },
      doStream: async (options: LanguageModelV1CallOptions) => {
        const response = await fetch('http://localhost:11434/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.model.apiIdentifier,
            messages: [
              systemMessage,
              ...messages,
              {
                role: 'assistant',
                content: 'I will help you analyze the website. Let me use the appropriate tools to gather data.',
                function_call: {
                  name: 'analyze',
                  arguments: JSON.stringify({
                    url
                  })
                }
              }
            ],
            options: {
              temperature: 0.7,
              num_predict: 4096
            },
            stream: true
          })
        });

        if (!response.ok) {
          throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
        }

        // Transform the raw response stream into the expected format
        const transformStream = new TransformStream({
          async transform(chunk, controller) {
            try {
              const text = new TextDecoder().decode(chunk);
              const lines = text.split('\n').filter(Boolean);
              
              for (const line of lines) {
                const json = JSON.parse(line);
                logWithTimestamp('[SEOAgent] Received chunk:', json);
                
                // Handle text content
                if (json.message?.content) {
                  controller.enqueue({
                    type: 'text-delta',
                    textDelta: json.message.content
                  } satisfies LanguageModelV1StreamPart);
                }
                
                // Handle function calls
                if (json.message?.function_call) {
                  const toolCallId = crypto.randomUUID();
                  logWithTimestamp('[SEOAgent] Tool call:', {
                    toolName: json.message.function_call.name,
                    args: json.message.function_call.arguments,
                    toolCallId
                  });
                  
                  // Send the tool call as a delta
                  controller.enqueue({
                    type: 'tool-call-delta',
                    toolCallType: 'function',
                    toolCallId,
                    toolName: json.message.function_call.name,
                    argsTextDelta: json.message.function_call.arguments
                  } satisfies LanguageModelV1StreamPart);
                }
              }
            } catch (e) {
              logWithTimestamp('[SEOAgent] Error transforming chunk:', e);
            }
          }
        });

        const stream = response.body?.pipeThrough(transformStream) as ReadableStream<LanguageModelV1StreamPart>;

        // Convert headers to a plain object
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });

        return {
          stream,
          rawCall: {
            rawPrompt: messages as unknown,
            rawSettings: {
              temperature: 0.7,
              maxTokens: 4096
            }
          },
          rawResponse: {
            headers,
            status: response.status,
            statusText: response.statusText
          }
        };
      }
    };

    const result = await streamText({
      model: ollamaModel,
      messages: [systemMessage, ...messages],
      tools,
      maxSteps: 10,
      experimental_toolCallStreaming: true,
      onStepFinish: ({ text, toolCalls, toolResults, finishReason, usage }) => {
        logWithTimestamp('[SEOAgent] Chat step:', {
          textLength: text?.length,
          text: text?.slice(0, 100) + (text?.length > 100 ? '...' : ''),
          toolCalls: toolCalls?.map(call => ({
            toolName: call.toolName,
            args: call.args
          })),
          toolResults: toolResults?.map(result => ({
            toolName: result.toolName,
            result: result.result
          })),
          finishReason,
          usage: {
            promptTokens: usage?.promptTokens,
            completionTokens: usage?.completionTokens,
            totalTokens: usage?.totalTokens
          }
        });
      }
    });

    return result.toTextStreamResponse();
  }
} 