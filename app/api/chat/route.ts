import { auth } from '@/app/(auth)/auth';
import { logWithTimestamp } from '@/lib/utils';
import { type CoreMessage } from 'ai';
import { getModel, type ModelId } from '@/lib/ai/models';
import { SEOAgent } from '@/lib/ai/agent';

// Force the route to be dynamic and allow streaming responses
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const systemPrompt = `You are a friendly and helpful AI assistant specialized in website analysis and SEO optimization.`;

interface ChatMessage {
  id?: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  createdAt?: Date;
}

interface ChatRequest {
  messages: ChatMessage[];
  modelId: string;
  chatId: string;
}

const TOOL_SUPPORTED_MODELS = ['llama2', 'codellama', 'mistral'] as const;

export async function POST(request: Request) {
  try {
    logWithTimestamp('Received POST request to /api/chat');
    const json = await request.json() as ChatRequest;
    logWithTimestamp('Request payload:', json);

    const { messages, modelId, chatId } = json;

    // Get the session
    const session = await auth();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Convert messages to CoreMessage format
    const systemMessage: CoreMessage = {
      role: 'system',
      content: systemPrompt,
    };

    logWithTimestamp('Converting messages to CoreMessage format');
    const convertedMessages: CoreMessage[] = messages.map((msg: ChatMessage) => {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      return { role: msg.role, content } as CoreMessage;
    });

    const coreMessages: CoreMessage[] = [systemMessage, ...convertedMessages];
    logWithTimestamp('Prepared messages for model:', { 
      messageCount: coreMessages.length,
      roles: coreMessages.map(m => m.role)
    });

    try {
      // Get the model configuration
      const model = getModel(modelId as ModelId);
      logWithTimestamp('[AI Info] Using model:', model);

      // Create agent instance with required IDs
      const agent = new SEOAgent({
        modelId: model.id,
        chatId,
        userId: session.user.id,
        disableTools: !model.supportsTools
      });

      // Stream the response using the agent
      const result = await agent.chat(coreMessages);

      // Return the stream response
      return result;

    } catch (error) {
      logWithTimestamp('Error streaming response:', error);
      
      // Check for specific error types
      if (error instanceof Error) {
        // Handle tool support error
        if (error.message?.includes('does not support tools')) {
          return new Response(
            JSON.stringify({
              error: 'Model Tool Support Error',
              message: `The selected model "${modelId}" does not support advanced tools. Please switch to one of these models that support tools: ${TOOL_SUPPORTED_MODELS.join(', ')}.`,
              details: error.message,
              type: 'TOOL_SUPPORT_ERROR',
              supportedModels: TOOL_SUPPORTED_MODELS
            }),
            { 
              status: 400,
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );
        }
      }
      
      throw error;
    }

  } catch (error) {
    logWithTimestamp('Fatal error processing request:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        type: 'GENERAL_ERROR'
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
} 