# AllTheLLMs

A Discord bot that enables interaction with multiple Large Language Models (LLMs) within Discord servers.

## Overview

AllTheLLMs allows server members to engage with various AI personalities, each powered by different LLM providers (OpenAI, Anthropic, and Google's Gemini). Users can interact with these AI personalities using specific aliases or through random interactions based on configured probabilities.

The primary users are Discord server members and administrators:
- Server administrators can manage which bot personalities are enabled on their servers 
- Members can chat with these personalities
- Each AI personality has its own distinct behavior, avatar, and response patterns

## Architecture

The codebase is organized around a service-oriented architecture:

### Core Services

1. **DiscordService** (`services/discord.ts`): 
   - Central orchestrator for handling Discord interactions
   - Manages bot personalities, message processing, and response generation
   - Controls typing indicators and webhook management for custom bot responses

2. **LLMService** (`services/llm.ts`):
   - Handles interactions with different LLM providers (OpenAI, Anthropic, Gemini)
   - Provides a unified interface for generating responses
   - Manages API key decryption and prompt construction

3. **DatabaseService** (`services/database.ts`):
   - Interfaces with Supabase database
   - Manages persistent storage of bot configurations, server information, and relationships

### Design Patterns

The application uses several design patterns:

1. **Singleton Pattern**: Service instances are created once and reused throughout the application
   ```typescript
   // Singleton instances of services
   let discordService: DiscordService | null = null;
   ```

2. **Service Pattern**: Core functionality is organized into specialized services with clear responsibilities

3. **Repository Pattern**: The DatabaseService acts as a repository layer for database operations

4. **Strategy Pattern**: The LLMService implements different strategies for each LLM provider
   ```typescript
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
   ```

5. **Observer Pattern**: Event handling in the Discord service follows the observer pattern

6. **Factory Pattern**: Service creation and initialization in services/index.ts

### Project Structure

- `/services`: Core services (Discord, LLM, Database)
- `/commands`: Discord slash command implementations
- `/events`: Discord event handlers
- `/database`: Database models, migrations, and client setup
- `/utils`: Utility functions for encryption, logging, etc.
- `/clients`: API client implementations

## Setup and Usage

1. Clone the repository
2. Install dependencies: `npm install`
3. Configure environment variables (see `.env.example`)
4. Run database migrations: `npm run migrate`
5. Start the bot: `npm start`

## Commands

- `/config <alias>`: Enable a bot personality for a server
- `/list`: List all enabled bot personalities in a server
- `/start`: Resume bot responses in a server
- `/stop`: Stop bot responses in a server

## Documentation

- [Technical Specification](SPEC.md): Detailed technical documentation
- [Database Migrations](database/migrations/README.md): Information about database migrations
