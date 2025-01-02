import { createOpenAI } from '@ai-sdk/openai';
import { logWithTimestamp } from '../utils';

// Initialize OpenAI provider with environment variables
export const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  compatibility: 'strict',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  }
});

// Helper function to check OpenAI connection
async function checkOpenAIConnection(): Promise<boolean> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    if (!response.ok) {
      logWithTimestamp('[OpenAI] Service check failed:', response.statusText);
      return false;
    }
    const data = await response.json();
    logWithTimestamp('[OpenAI] Service available, models:', data.data.length);
    return true;
  } catch (error) {
    logWithTimestamp('[OpenAI] Connection check error:', error);
    return false;
  }
}

// Perform initial connection check
checkOpenAIConnection().then(isAvailable => {
  if (!isAvailable) {
    logWithTimestamp('[OpenAI] Warning: OpenAI service is not available');
  } else {
    logWithTimestamp('[OpenAI] Successfully connected to OpenAI service');
  }
}).catch(error => {
  logWithTimestamp('[OpenAI] Error checking connection:', error);
}); 