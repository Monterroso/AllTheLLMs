import { logger } from '../utils/logger';
import type { BotConfig } from '../database/models';
import { decrypt } from '../utils/encryption';

/**
 * Service for handling interactions with different LLM providers
 * Supports different LLM types and handles API calls
 */
export class LLMService {
  /**
   * Generate a response from an LLM based on the bot configuration
   * @param botConfig The bot configuration
   * @param messages Array of previous messages for context
   * @returns The generated response
   */
  async generateResponse(
    botConfig: BotConfig, 
    messages: Array<{ role: string; content: string }>
  ): Promise<string> {
    try {
      // Decrypt the API key
      const apiKey = decrypt(botConfig.encrypted_api_key);
      
      // Add the system prompt as the first message if it's not already there
      if (messages.length === 0 || messages[0].role !== 'system') {
        messages.unshift({
          role: 'system',
          content: botConfig.system_prompt
        });
      }
      
      // Generate response based on the LLM type
      switch (botConfig.llm_type.toLowerCase()) {
        case 'openai':
          return await this.generateOpenAIResponse(apiKey, messages);
        case 'anthropic':
          return await this.generateAnthropicResponse(apiKey, messages);
        case 'gemini':
          return await this.generateGeminiResponse(apiKey, messages);
        default:
          throw new Error(`Unsupported LLM type: ${botConfig.llm_type}`);
      }
    } catch (error) {
      logger.error(`Error generating LLM response: ${error}`);
      return "I'm sorry, I encountered an error while processing your request.";
    }
  }
  
  /**
   * Generate a response using OpenAI's API
   * @param apiKey The OpenAI API key
   * @param messages Array of messages for context
   * @returns The generated response
   */
  private async generateOpenAIResponse(
    apiKey: string, 
    messages: Array<{ role: string; content: string }>
  ): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        temperature: 0.7,
        max_tokens: 1000
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${JSON.stringify(errorData)}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  }
  
  /**
   * Generate a response using Anthropic's API
   * @param apiKey The Anthropic API key
   * @param messages Array of messages for context
   * @returns The generated response
   */
  private async generateAnthropicResponse(
    apiKey: string, 
    messages: Array<{ role: string; content: string }>
  ): Promise<string> {
    // Convert messages to Anthropic format
    const anthropicMessages = messages.map(msg => ({
      role: msg.role === 'system' ? 'assistant' : msg.role,
      content: msg.content
    }));
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-opus-20240229',
        messages: anthropicMessages,
        max_tokens: 1000
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Anthropic API error: ${JSON.stringify(errorData)}`);
    }
    
    const data = await response.json();
    return data.content[0].text;
  }
  
  /**
   * Generate a response using Google's Gemini API
   * @param apiKey The Gemini API key
   * @param messages Array of messages for context
   * @returns The generated response
   */
  private async generateGeminiResponse(
    apiKey: string, 
    messages: Array<{ role: string; content: string }>
  ): Promise<string> {
    // Convert messages to Gemini format
    const geminiMessages = messages.map(msg => ({
      role: msg.role === 'system' ? 'user' : msg.role,
      parts: [{ text: msg.content }]
    }));
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: geminiMessages,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000
        }
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini API error: ${JSON.stringify(errorData)}`);
    }
    
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }
} 