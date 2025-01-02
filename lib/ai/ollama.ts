import { createOllama } from 'ollama-ai-provider';
import { type CoreMessage } from 'ai';
import { logWithTimestamp } from '../utils';

// Constants
const OLLAMA_BASE_URL = 'http://localhost:11434/api';

// Helper function to check Ollama connection
async function checkOllamaConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/version`);
    if (!response.ok) {
      logWithTimestamp('[Ollama] Service check failed:', response.statusText);
      return false;
    }
    const data = await response.json();
    logWithTimestamp('[Ollama] Service version:', data.version);
    return true;
  } catch (error) {
    logWithTimestamp('[Ollama] Connection check error:', error);
    return false;
  }
}

// Initialize Ollama provider with streaming configuration
export const ollama = createOllama({
  baseURL: 'http://localhost:11434/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  }
});

// Perform initial connection check
checkOllamaConnection().then(isAvailable => {
  if (!isAvailable) {
    logWithTimestamp('[Ollama] Warning: Ollama service is not available');
  } else {
    logWithTimestamp('[Ollama] Successfully connected to Ollama service');
  }
}).catch(error => {
  logWithTimestamp('[Ollama] Error checking connection:', error);
});

// Memory types
type Memory = {
  shortTerm: CoreMessage[];
  longTerm: string[];
};

// Memory management
class AIMemory {
  private store: Record<string, Memory> = {};

  initializeMemory(chatId: string) {
    logWithTimestamp('[Memory] Initializing memory for chat:', { chatId });
    this.store[chatId] = {
      shortTerm: [],
      longTerm: [],
    };
  }

  async addToMemory(chatId: string, message: CoreMessage) {
    if (!this.store[chatId]) {
      logWithTimestamp('[Memory] Chat not found, initializing memory:', { chatId });
      this.initializeMemory(chatId);
    }

    // Add to short-term memory
    this.store[chatId].shortTerm.push(message);
    logWithTimestamp('[Memory] Added message to short-term memory:', { 
      chatId, 
      messageRole: message.role,
      shortTermCount: this.store[chatId].shortTerm.length 
    });

    // Process messages and update long-term memory if needed
    if (this.store[chatId].shortTerm.length >= 5) {
      logWithTimestamp('[Memory] Processing short-term memory for long-term storage:', { chatId });
      const facts = await this.processMessages(this.store[chatId].shortTerm);
      this.store[chatId].longTerm.push(...facts);
      this.store[chatId].shortTerm = [];
      logWithTimestamp('[Memory] Updated long-term memory:', { 
        chatId, 
        newFactsCount: facts.length,
        totalFactsCount: this.store[chatId].longTerm.length 
      });
    }
  }

  getMemory(chatId: string): Memory | undefined {
    return this.store[chatId];
  }

  private async processMessages(messages: CoreMessage[]): Promise<string[]> {
    // Format messages into a conversation string
    const conversation = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    
    try {
      logWithTimestamp('[Memory] Processing messages for fact extraction');
      const response = await fetch(`${OLLAMA_BASE_URL}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama2',
          prompt: `Extract key facts from this conversation and return them as a list, with each fact on a new line starting with a dash (-):

${conversation}`,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const result = await response.json();
      const content = result.response;

      // Parse the response into individual facts
      const facts = content
        .split('\n')
        .filter((line: string) => line.trim().startsWith('-'))
        .map((line: string) => line.trim().substring(1).trim());

      logWithTimestamp('[Memory] Extracted facts:', { count: facts.length });
      return facts;

    } catch (error) {
      logWithTimestamp('[Memory] Error processing messages:', error);
      return [];
    }
  }
}

// Export singleton instance
export const aiMemory = new AIMemory(); 