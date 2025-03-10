# Technical Specification

## System Overview
The system is a Discord bot designed to manage and interact with various bot personalities across multiple servers. It facilitates enabling, disabling, and managing bot responses, integrates with Large Language Models (LLMs) for generating responses, and handles various Discord-specific operations such as message processing, command execution, and event handling. The main components include the Discord client, service classes for business logic, database interactions, utility functions, and external API integrations for LLMs.

## Core Functionality

### Database Interactions
- **DatabaseService Class** (`services/database.ts`)
  - Handles all database operations using Supabase.
  - **Primary Functions:**
    - `getAllBotConfigs`: Fetches all bot configurations.
    - `getBotConfigByAlias`: Fetches a bot configuration by alias.
    - `getServerBots`: Fetches bot configurations enabled for a specific server.
    - `enableBotForServer`: Enables a bot for a specific server.
    - `getServerByDiscordId`: Fetches a server record by Discord ID.
    - `updateServerInfo`: Updates server information.
    - `setServerStopped`: Sets the stopped state for a server.
    - `isServerStopped`: Checks the stopped state for a server.
    - `getAllStoppedServers`: Fetches all servers where the bot is stopped.

### Discord-Specific Operations
- **DiscordService Class** (`services/discord.ts`)
  - Manages bot personalities, message processing, and Discord interactions.
  - **Primary Functions:**
    - `initialize`: Initializes the Discord service.
    - `loadStoppedServers`: Loads servers where the bot should not respond.
    - `updateServerInfo`: Updates server information in the database.
    - `enableBotForServer`: Enables a bot personality for a specific server.
    - `getServerBots`: Retrieves all bot personalities enabled for a specific server.
    - `stopRespondingInServer`: Stops the bot from responding in a specific server.
    - `resumeRespondingInServer`: Resumes the bot responding in a specific server.
    - `processMessage`: Processes a Discord message to determine if a response is needed.
    - `respondWithBot`: Generates and sends a response using a specific bot personality.
    - `checkRandomResponse`: Checks if a random response should be generated.

### Large Language Model (LLM) Interactions
- **LLMService Class** (`services/llm.ts`)
  - Handles interactions with different LLM providers.
  - **Primary Functions:**
    - `generateResponse`: Generates a response from an LLM based on the provided bot configuration and message history.
    - `generateOpenAIResponse`: Generates a response using OpenAI's API.
    - `generateAnthropicResponse`: Generates a response using Anthropic's API.
    - `generateGeminiResponse`: Generates a response using Google's Gemini API.

### Command Handling
- **Command Modules** (`commands/`)
  - Handle various Discord commands.
  - **Primary Commands:**
    - `config.ts`: Enables a bot personality for a server.
    - `list.ts`: Displays all bot personalities enabled for a server.
    - `start.ts`: Resumes the bot responding to messages in a server.
    - `stop.ts`: Stops the bot from responding to messages in a server.

### Event Handling
- **Event Modules** (`events/`)
  - Handle various Discord events.
  - **Primary Events:**
    - `messageCreate.ts`: Processes incoming messages.
    - `ready.ts`: Initializes the bot when it is ready.
    - `error.ts`: Logs errors.

## Architecture

### Data Flow
1. **Initialization:**
   - The bot initializes by loading environment variables and setting up the Discord client (`index.ts`).
   - Registers commands and events using `registerCommands` and `registerEvents`.
   - Initializes services using `initializeServices` from `services/index.ts`.

2. **Command Execution:**
   - When a command is executed, the corresponding command module (`commands/`) is invoked.
   - Commands like `config`, `list`, `start`, and `stop` interact with the `DiscordService` to perform their operations.

3. **Event Handling:**
   - Events like `messageCreate` are handled by the `events/messageCreate.ts` module.
   - The `DiscordService` processes messages and determines if a response is needed.

4. **Database Interactions:**
   - All database operations are handled by the `DatabaseService`.
   - Data is fetched, updated, and managed using Supabase.

5. **LLM Interactions:**
   - Responses from LLMs are generated using the `LLMService`.
   - The `generateResponse` function handles the core logic for generating responses based on bot configurations and message history.

6. **Error Handling:**
   - Errors are logged using the custom logger utility defined in `utils/logger.ts`.

### Component Interaction
- The `DiscordService` interacts with the `DatabaseService` to load and update server information, enable/disable bots, and retrieve bot configurations.
- The `LLMService` interacts with encryption utilities for decrypting API keys and with the logger for logging errors and information.
- The `index.ts` file orchestrates the initialization and operation of the Discord bot, registering events and commands, and handling the client connection.