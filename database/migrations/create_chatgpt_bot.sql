-- Migration: 000_create_chatgpt_bot
-- Description: Creates a ChatGPT bot without an encrypted API key

-- Insert a new ChatGPT bot into the bot_configs table
INSERT INTO bot_configs (
  alias,
  llm_type,
  encrypted_api_key,
  response_probability,
  system_prompt,
  respond_to_bots,
  avatar_url,
  message_history_count
) VALUES (
  'ChatGPT',                                                -- alias
  'gpt-4',                                                  -- llm_type
  '',                                                       -- encrypted_api_key (empty as requested)
  75.00,                                                    -- response_probability (75%)
  'You are ChatGPT, a helpful AI assistant created by OpenAI. Respond to user queries in a friendly and informative manner.', -- system_prompt
  FALSE,                                                    -- respond_to_bots
  'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/ChatGPT_logo.svg/1200px-ChatGPT_logo.svg.png', -- avatar_url
  10                                                        -- message_history_count
);

-- Insert this migration record
INSERT INTO migrations (name, batch) 
VALUES ('000_create_chatgpt_bot', 1); 